import webSocketService from './WebSocketService'
import audioService from './AudioService'
import responseLLMService from './ResponseLLMService'
import sttTtsService from './STTTTSService'
import senceVoiceService from './SenceVoiceService'
import llmConfig from '../config/llmConfig'

class DigitalHumanService {
  constructor() {
    this.isConnected = false
    this.isConversing = false
    this.useSenceVoice = false // 是否使用SenceVoice服务
    this.continuousMode = false // 是否开启持续模式
    this.continuousLoopActive = false // 循环是否激活
    this.smartConversationMode = false // 智能对话模式
    this.smartConversationActive = false // 智能对话是否激活
    this.autoRestartDelay = 1000 // 重启间隔(毫秒)
    this.maxWaitTime = 15000 // 最大等待时间(15秒)
    this.silenceTimeout = 3000 // 静音检测超时(3秒)
    this.maxConversationIdle = 30000 // 最大对话空闲时间(30秒)
    this.currentStatus = 'idle' // 当前状态: idle, recording, processing, speaking
    this.vadState = 'idle' // 语音活动检测状态: idle, listening, speaking, silence
    
    // 活跃的定时器追踪，防止内存泄漏
    this.activeTimers = new Set()
    this.activeIntervals = new Set()
    
    this.conversationCallbacks = {
      onStart: null,
      onEnd: null,
      onMessage: null,
      onError: null,
      onStatusChange: null,
    }

    this.setupWebSocketCallbacks()
    this.setupSenceVoiceCallbacks()
  }

  // 开启持续监听模式
  async enableContinuousMode() {
    if (this.continuousMode) {
      console.log('持续模式已启用')
      return { success: true, message: '持续模式已启用' }
    }

    this.continuousMode = true
    this.continuousLoopActive = true

    console.log('🔄 启用持续语音监听模式')
    this.notifyMessage('system', '已开启持续监听，无需手动点击，直接说话即可')

    // 启动持续循环
    this.startContinuousLoop()

    return { success: true, message: '持续监听已开启' }
  }

  // 关闭持续监听模式
  async disableContinuousMode() {
    console.log('🔄 正在关闭持续语音监听模式...')
    
    this.continuousMode = false
    this.continuousLoopActive = false

    // 强制重置所有状态，确保从持续模式完全退出
    await this.forceResetState()
    
    // 额外等待确保所有异步操作完成
    await this.delay(300)

    console.log('🔄 关闭持续语音监听模式')
    this.notifyMessage('system', '已关闭持续监听')

    return { success: true, message: '持续监听已关闭' }
  }

  // ==================== 智能对话模式 ====================

  // 开启智能对话模式 - 真正的连续对话体验
  async enableSmartConversation() {
    if (this.smartConversationMode) {
      console.log('智能对话模式已启用')
      return { success: true, message: '智能对话模式已启用' }
    }

    // 先关闭持续监听模式（如果开启的话）
    if (this.continuousMode) {
      await this.disableContinuousMode()
    }

    this.smartConversationMode = true
    this.smartConversationActive = true
    this.vadState = 'listening'

    console.log('🚀 启用智能对话模式 - 像真人对话一样自然')
    this.notifyMessage('system', '智能对话已开启！开始说话即可，无需任何操作')

    // 启动智能对话循环
    this.startSmartConversationLoop()

    return { success: true, message: '智能对话已开启' }
  }

  // 关闭智能对话模式
  async disableSmartConversation() {
    // 防止重复关闭
    if (!this.smartConversationMode && !this.smartConversationActive) {
      console.log('智能对话模式已经关闭，跳过')
      return { success: true, message: '智能对话已关闭' }
    }

    console.log('🔄 正在关闭智能对话模式...')
    
    // 先设置状态，停止循环
    this.smartConversationMode = false
    this.smartConversationActive = false
    this.vadState = 'idle'

    // 强制重置所有状态
    await this.forceResetState()
    await this.delay(100) // 减少延迟

    console.log('🔄 智能对话模式已关闭')
    this.notifyMessage('system', '智能对话已关闭')

    return { success: true, message: '智能对话已关闭' }
  }

  // 智能对话主循环
  async startSmartConversationLoop() {
    console.log('🚀 智能对话循环开始')
    
    while (this.smartConversationActive && this.smartConversationMode) {
      try {
        console.log('👂 等待用户说话...')
        this.vadState = 'listening'
        this.notifyStatusChange('listening')

        // 开始录音并等待语音活动
        const conversationResult = await this.waitForUserSpeechAndProcess()
        
        if (!conversationResult.success) {
          if (conversationResult.reason === 'timeout') {
            console.log('⏰ 对话超时，结束智能对话模式')
            break
          } else if (conversationResult.reason === 'exit_command') {
            console.log('👋 用户请求结束对话')
            break
          } else if (conversationResult.reason === 'no_activity') {
            console.log('😴 长时间无活动，结束智能对话模式')
            break
          } else if (conversationResult.reason === 'conversation_stopped') {
            console.log('🛑 智能对话已被用户停止')
            break
          } else {
            console.warn(`⚠️ 对话处理失败: ${conversationResult.reason || 'unknown'}`)
            if (conversationResult.error) {
              console.error('详细错误:', conversationResult.error)
            }
          }
          // 其他错误，短暂等待后重试
          await this.delay(1000)
          continue
        }

        // 成功处理一轮对话，准备下一轮
        console.log('✅ 对话轮次完成，准备下一轮')
        await this.delay(500) // 短暂间隔，让AI语音播放完成
        
      } catch (error) {
        console.error('❌ 智能对话循环出错:', error.message || error)
        console.log('🔄 重置状态并等待重试...')
        
        // 执行健康检查
        const healthCheck = this.performHealthCheck()
        if (!healthCheck.healthy) {
          console.warn('🚨 检测到服务健康问题:', healthCheck.issues)
          console.log('🔧 尝试自动修复...')
          await this.autoRepair()
        } else {
          await this.forceResetState()
        }
        
        // 错误类型分类处理
        if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
          console.log('⏰ 超时错误，延长等待时间')
          await this.delay(3000)
        } else if (error.name === 'NetworkError' || error.message?.includes('network')) {
          console.log('🌐 网络错误，等待网络恢复')
          await this.delay(5000)
        } else {
          console.log('🔧 一般错误，标准重试间隔')
          await this.delay(2000)
        }
      }
    }

    console.log('🔄 智能对话循环结束')
    // 不再自动调用disableSmartConversation，避免重复关闭
    // 循环结束通常是因为用户手动关闭或超时，状态已经被正确设置
  }

  // 等待用户说话并处理 - 智能对话核心逻辑
  async waitForUserSpeechAndProcess() {
    return new Promise(async (resolve) => {
      let isRecording = false
      let speechDetected = false
      let silenceStartTime = null
      let lastVoiceActivity = Date.now()
      let conversationTimeout = null
      let silenceCheckInterval = null

      try {
        // 设置最大对话超时
        conversationTimeout = this.safeSetTimeout(() => {
          console.log('⏰ 对话长时间无活动，自动结束')
          cleanup()
          resolve({ success: false, reason: 'timeout' })
        }, this.maxConversationIdle)

        // 开始录音
        console.log('🎤 开始智能录音检测')
        const startResult = await this.startVoiceConversation()
        if (!startResult.success) {
          cleanup()
          return resolve({ success: false, reason: 'recording_failed', error: startResult.error })
        }
        
        isRecording = true
        lastVoiceActivity = Date.now()

        // 模拟语音活动检测（实际项目中应该使用真实的VAD）
        silenceCheckInterval = this.safeSetInterval(async () => {
          const now = Date.now()
          
          // 检查智能对话模式是否被中途关闭
          if (!this.smartConversationMode || !this.smartConversationActive) {
            console.log('🛑 智能对话模式已关闭，停止语音检测')
            cleanup()
            resolve({ success: false, reason: 'conversation_stopped' })
            return
          }
          
          // 如果用户开始说话后静音超过设定时间，自动停止录音
          if (speechDetected && silenceStartTime && (now - silenceStartTime > this.silenceTimeout)) {
            console.log('🔇 检测到用户说话结束，自动停止录音')
            this.clearSafeInterval(silenceCheckInterval)
            silenceCheckInterval = null
            
            try {
              const processed = await this.processRecordingAndRespond()
              cleanup()
              if (processed) {
                console.log('✅ 语音处理完成，对话轮次成功')
                resolve({ success: true, reason: 'completed' })
              } else {
                console.warn('⚠️ 语音处理失败')
                resolve({ success: false, reason: 'processing_failed' })
              }
            } catch (error) {
              console.error('❌ 语音处理过程出错:', error.message)
              cleanup()
              resolve({ success: false, reason: 'processing_error', error: error.message })
            }
            return
          }

          // 检查是否长时间没有语音活动
          if (now - lastVoiceActivity > this.maxConversationIdle) {
            console.log('⏰ 长时间无语音活动，结束对话')
            cleanup()
            resolve({ success: false, reason: 'no_activity' })
            return
          }

          // 简单的语音活动模拟逻辑
          // 在实际应用中，这里应该集成真实的语音活动检测
          if (isRecording && !speechDetected) {
            // 模拟检测到用户开始说话（在实际中通过音频分析实现）
            const timeSinceStart = now - lastVoiceActivity
            if (timeSinceStart > 1000) { // 1秒后假设用户开始说话
              speechDetected = true
              silenceStartTime = null
              console.log('🗣️ 检测到用户开始说话')
              this.vadState = 'speaking'
              this.notifyStatusChange('speaking')
            }
          } else if (speechDetected && !silenceStartTime) {
            // 模拟检测到静音开始（在实际中通过音频分析实现）
            const speechDuration = now - (lastVoiceActivity + 1000)
            if (speechDuration > 2000) { // 假设说话2秒后开始静音
              silenceStartTime = now
              console.log('🤫 检测到静音开始')
              this.vadState = 'silence'
              this.notifyStatusChange('silence')
            }
          }
        }, 100) // 每100ms检查一次

        // 清理函数
        const cleanup = () => {
          if (conversationTimeout) {
            this.clearSafeTimeout(conversationTimeout)
            conversationTimeout = null
          }
          if (silenceCheckInterval) {
            this.clearSafeInterval(silenceCheckInterval)
            silenceCheckInterval = null
          }
        }

      } catch (error) {
        console.error('语音检测过程出错:', error)
        // 使用cleanup函数统一清理
        if (typeof cleanup === 'function') {
          cleanup()
        } else {
          if (conversationTimeout) clearTimeout(conversationTimeout)
          if (silenceCheckInterval) clearInterval(silenceCheckInterval)
        }
        resolve({ success: false, reason: 'detection_error', error: error.message })
      }
    })
  }

  // 处理录音并响应
  async processRecordingAndRespond() {
    try {
      // 检查智能对话模式状态
      if (!this.smartConversationMode || !this.smartConversationActive) {
        console.log('📴 智能对话模式已关闭，停止处理录音')
        return false
      }

      if (!this.isConversing) {
        console.log('📭 没有正在进行的录音')
        return false
      }

      this.vadState = 'processing'
      this.notifyStatusChange('processing')

      // 停止录音并处理
      const result = await this.stopVoiceConversation()
      
      if (result) {
        // 再次检查对话模式状态
        if (!this.smartConversationMode || !this.smartConversationActive) {
          console.log('📴 处理过程中智能对话模式被关闭')
          return false
        }
        
        // 等待AI回复完成
        await this.waitForAIResponseComplete()
        return true
      }
      
      console.log('🚫 语音对话处理失败')
      return false
    } catch (error) {
      console.error('❌ 处理录音失败:', error.message || error)
      
      // 错误恢复：重置状态
      this.vadState = 'idle'
      this.notifyStatusChange('idle')
      
      return false
    }
  }

  // 等待AI回复完成 - 专门为智能对话优化
  async waitForAIResponseComplete() {
    return new Promise((resolve) => {
      let maxWaitTime = 10000 // 最多等待10秒
      let startTime = Date.now()
      
      const checkStatus = () => {
        // 检查智能对话模式是否还活跃
        if (!this.smartConversationMode || !this.smartConversationActive) {
          console.log('📴 智能对话模式已关闭，停止等待AI回复')
          resolve()
          return
        }
        
        // 检查是否超时
        if (Date.now() - startTime > maxWaitTime) {
          console.log('⏰ 等待AI回复超时')
          this.currentStatus = 'idle'
          this.vadState = 'listening'
          resolve()
          return
        }
        
        if (this.currentStatus === 'speaking' || this.isConversing) {
          setTimeout(checkStatus, 200)
        } else {
          // AI回复完成，重置状态为监听
          this.currentStatus = 'idle'
          this.vadState = 'listening'
          console.log('🎵 AI回复完成，准备下一轮对话')
          resolve()
        }
      }

      // 给AI回复一些启动时间
      setTimeout(checkStatus, 300)
    })
  }

  // ==================== 便利方法 ====================

  // 智能开始对话 - 用户友好的接口
  async startSmartConversation() {
    return await this.enableSmartConversation()
  }

  // 停止智能对话 - 用户友好的接口  
  async stopSmartConversation() {
    return await this.disableSmartConversation()
  }

  // 检查当前是否在智能对话模式
  isInSmartConversationMode() {
    return this.smartConversationMode && this.smartConversationActive
  }

  // 获取当前模式状态
  getCurrentMode() {
    if (this.smartConversationMode) return 'smart_conversation'
    if (this.continuousMode) return 'continuous_listening'
    return 'manual'
  }

  // 获取语音活动状态
  getVADState() {
    return this.vadState
  }

  // 持续监听主循环
  async startContinuousLoop() {
    while (this.continuousLoopActive && this.continuousMode) {
      try {
        console.log('🎤 开始新一轮语音监听...')

        // 1. 自动开始录音
        const startResult = await this.startVoiceConversation()
        if (!startResult.success) {
          console.error('录音启动失败，退出持续模式')
          // 重置状态并退出
          await this.forceResetState()
          break
        }

        // 2. 等待用户语音输入 (带超时)
        const hasInput = await this.waitForVoiceInputWithTimeout()

        if (hasInput) {
          // 3. 自动停止并处理语音
          await this.stopVoiceConversation()

          // 4. 等待AI回复播放完成
          await this.waitForResponseComplete()

          // 5. 短暂延迟后继续下一轮
          await this.delay(this.autoRestartDelay)
        } else {
          // 超时，停止当前录音
          console.log('⏰ 语音输入超时，重新开始监听')
          await this.stopCurrentRecording()
          await this.delay(500) // 短暂延迟
        }
      } catch (error) {
        console.error('持续监听循环出错:', error)
        // 发生错误时强制重置状态
        await this.forceResetState()
        // 短暂暂停后重试
        await this.delay(2000)
      }
    }

    console.log('🔄 持续监听循环结束')
  }

  // 等待用户语音输入（带超时）
  async waitForVoiceInputWithTimeout() {
    return new Promise((resolve) => {
      // 设置超时定时器
      const timeout = setTimeout(() => {
        console.log('⏰ 等待语音输入超时')
        resolve(false) // 超时返回false
      }, this.maxWaitTime)

      // 监听录音状态变化
      const checkRecordingStatus = () => {
        // 如果用户手动停止录音或检测到语音活动
        if (!this.isConversing) {
          clearTimeout(timeout)
          resolve(true) // 有输入返回true
        } else if (this.continuousMode) {
          // 持续检查
          setTimeout(checkRecordingStatus, 100)
        } else {
          // 退出持续模式
          clearTimeout(timeout)
          resolve(false)
        }
      }

      // 开始检查
      checkRecordingStatus()
    })
  }

  // 等待AI回复完成
  async waitForResponseComplete() {
    return new Promise((resolve) => {
      const checkStatus = () => {
        // 检查是否还在播放语音或正在对话
        if (this.currentStatus === 'speaking' || this.isConversing) {
          setTimeout(checkStatus, 200) // 更频繁的检查
        } else {
          // 确保状态完全重置
          this.currentStatus = 'idle'
          resolve()
        }
      }

      // 在持续模式下，给更短的时间让TTS开始
      const initialDelay = this.continuousMode ? 300 : 1000
      setTimeout(checkStatus, initialDelay)
    })
  }

  // 停止当前录音（不处理）
  async stopCurrentRecording() {
    if (this.isConversing) {
      this.isConversing = false
      this.currentStatus = 'idle'
      try {
        await audioService.stopRecording() // 只停止，不处理音频
      } catch (error) {
        console.log('停止录音失败（可能已停止）:', error.message)
      }
      this.notifyStatusChange('idle')
    }
  }

  // 强制重置所有状态
  async forceResetState() {
    console.log('🔄 强制重置数字人服务状态')
    this.isConversing = false
    this.currentStatus = 'idle'
    this.vadState = 'idle'
    
    try {
      // 强制停止录音服务
      await audioService.forceStopRecording()
    } catch (error) {
      console.log('强制停止录音失败:', error.message)
    }
    
    this.notifyStatusChange('idle')
  }

  // 延迟函数
  async delay(ms) {
    return new Promise((resolve) => {
      const timerId = setTimeout(resolve, ms)
      this.activeTimers.add(timerId)
      // 定时器完成后从集合中移除
      setTimeout(() => this.activeTimers.delete(timerId), ms + 10)
    })
  }

  // 安全的setTimeout，自动追踪和清理
  safeSetTimeout(callback, delay) {
    const timerId = setTimeout(() => {
      this.activeTimers.delete(timerId)
      callback()
    }, delay)
    this.activeTimers.add(timerId)
    return timerId
  }

  // 安全的setInterval，自动追踪和清理
  safeSetInterval(callback, interval) {
    const intervalId = setInterval(callback, interval)
    this.activeIntervals.add(intervalId)
    return intervalId
  }

  // 清理特定定时器
  clearSafeTimeout(timerId) {
    if (timerId && this.activeTimers.has(timerId)) {
      clearTimeout(timerId)
      this.activeTimers.delete(timerId)
    }
  }

  // 清理特定间隔器
  clearSafeInterval(intervalId) {
    if (intervalId && this.activeIntervals.has(intervalId)) {
      clearInterval(intervalId)
      this.activeIntervals.delete(intervalId)
    }
  }

  // 清理所有定时器和间隔器
  clearAllTimers() {
    // 清理所有setTimeout
    this.activeTimers.forEach(timerId => {
      clearTimeout(timerId)
    })
    this.activeTimers.clear()

    // 清理所有setInterval
    this.activeIntervals.forEach(intervalId => {
      clearInterval(intervalId)
    })
    this.activeIntervals.clear()

    console.log('✅ 所有定时器已清理')
  }

  // 获取当前状态
  getCurrentStatus() {
    return this.currentStatus
  }

  // 包装原有的方法以支持持续模式
  async startVoiceRecording() {
    return await this.startVoiceConversation()
  }

  async stopVoiceRecording() {
    return await this.stopVoiceConversation()
  }

  setupWebSocketCallbacks() {
    webSocketService.setOnConnect(() => {
      this.isConnected = true
      this.notifyStatusChange('connected')
      console.log('数字人服务已连接')
    })

    webSocketService.setOnDisconnect(() => {
      this.isConnected = false
      this.notifyStatusChange('disconnected')
      console.log('数字人服务已断开')
    })

    webSocketService.setOnError((error) => {
      this.notifyError(`WebSocket连接错误: ${error.message}`)
    })

    webSocketService.setOnMessage((data) => {
      this.handleWebSocketMessage(data)
    })
  }

  setupSenceVoiceCallbacks() {
    senceVoiceService.setCallbacks({
      onConnect: () => {
        console.log('SenceVoice服务已连接')
        this.useSenceVoice = true
        this.notifyStatusChange('sencevoice_connected')
      },
      onDisconnect: () => {
        console.log('SenceVoice服务已断开')
        this.useSenceVoice = false
        this.notifyStatusChange('sencevoice_disconnected')
      },
      onError: (error) => {
        this.notifyError(`SenceVoice错误: ${error.message}`)
      },
      onStatusUpdate: (status) => {
        console.log('SenceVoice状态更新:', status)
        this.notifyMessage('system', this.formatSenceVoiceStatus(status))
      },
      onVoiceResponse: (response) => {
        this.handleSenceVoiceResponse(response)
      },
      onEnrollmentResponse: (response) => {
        this.handleEnrollmentResponse(response)
      },
    })
  }

  formatSenceVoiceStatus(status) {
    const features = []
    if (status.kws_enabled) {
      features.push(`关键词唤醒: ${status.kws_activated ? '已激活' : '未激活'} (${status.kws_keyword})`)
    }
    if (status.sv_enabled) {
      features.push(`声纹识别: ${status.sv_enrolled ? '已注册' : '未注册'}`)
    }
    return `SenceVoice服务状态:\n${features.join('\n')}`
  }

  handleSenceVoiceResponse(response) {
    if (response.success) {
      console.log('用户说:', response.asr_result)
      console.log('AI回复:', response.llm_response)

      this.notifyMessage('user', response.asr_result)
      this.notifyMessage('assistant', response.llm_response)

      if (response.response_type === 'voice_chat_success') {
        this.notifyStatusChange('speaking')
        // TTS音频已在SenceVoiceService中自动播放
        setTimeout(() => {
          this.notifyStatusChange('idle')
        }, this.estimateSpeechDuration(response.llm_response))
      }
    } else {
      console.error('SenceVoice响应错误:', response.error)
      this.notifyError(response.message || response.error)

      // 显示ASR结果（如果有）
      if (response.asr_result) {
        this.notifyMessage('user', response.asr_result)
      }
    }
  }

  handleEnrollmentResponse(response) {
    if (response.success) {
      console.log('声纹注册成功:', response.message)
      this.notifyMessage('system', response.message)
      this.notifyStatusChange('enrollment_success')
    } else {
      console.error('声纹注册失败:', response.error)
      this.notifyError(response.message || response.error)
      this.notifyStatusChange('enrollment_failed')
    }
  }

  async initialize(config = {}) {
    try {
      console.log('开始初始化数字人服务...')

      // 尝试连接SenceVoice服务
      if (config.sencevoice_url) {
        try {
          const senceVoiceConnected = await senceVoiceService.connect(config.sencevoice_url)
          if (senceVoiceConnected) {
            console.log('✅ SenceVoice服务连接成功')
            this.useSenceVoice = true
          }
        } catch (error) {
          console.warn('SenceVoice服务连接失败，回退到传统模式:', error)
        }
      }

      // 配置各个服务
      console.log('初始化ResponseLLM服务...')
      if (config.llm) {
        const llmInitialized = await responseLLMService.initialize(config.llm)
        if (!llmInitialized) {
          console.warn('ResponseLLM服务初始化失败，但继续初始化其他服务')
        }
      } else {
        const llmInitialized = await responseLLMService.initialize()
        if (!llmInitialized) {
          console.warn('ResponseLLM服务初始化失败，但继续初始化其他服务')
        }
      }

      console.log('配置STT/TTS服务...')
      const sttTtsConfig = {
        provider: llmConfig.sttTts.provider,
        openai: llmConfig.sttTts.openai,
        azure: llmConfig.sttTts.azure,
        google: llmConfig.sttTts.google,
        ...config.sttTts,
      }

      sttTtsService.setConfig(sttTtsConfig)

      // 检测可用服务
      await sttTtsService.detectAvailableServices()

      // 获取服务状态和推荐
      const serviceStatus = sttTtsService.getServiceStatus()
      const recommendations = sttTtsService.getServiceRecommendations()

      console.log('🎵 STT/TTS服务状态:', serviceStatus)
      console.log('💡 服务推荐:', recommendations)

      // 显示重要警告给用户
      recommendations.forEach((rec) => {
        if (rec.type === 'error' || rec.type === 'warning') {
          this.notifyError(`语音服务提示: ${rec.message}`)
        }
      })

      console.log('初始化音频服务...')
      // 音频服务初始化失败不应该阻止整个服务
      try {
        const audioResult = await audioService.initializeAudio()
        if (audioResult.success) {
          console.log(`✅ 音频服务初始化成功 (${audioResult.mode}模式): ${audioResult.message}`)
          if (audioResult.mode === 'simulation') {
            this.notifyError(`音频权限提示: ${audioResult.message}`)
          }
        } else {
          console.warn('音频服务初始化失败，但继续初始化')
          this.notifyError('音频服务不可用，部分功能可能受限')
        }
      } catch (audioError) {
        console.warn('音频服务初始化异常:', audioError.message)
        this.notifyError(`音频初始化异常: ${audioError.message}`)
      }

      // 连接WebSocket（如果提供了URL）
      if (config.websocket_url) {
        try {
          webSocketService.connect(config.websocket_url)
        } catch (wsError) {
          console.warn('WebSocket连接失败:', wsError.message)
        }
      }

      console.log('数字人服务初始化完成')
      return true
    } catch (error) {
      console.error('数字人服务初始化失败:', error)
      this.notifyError(`初始化失败: ${error.message}`)
      return false
    }
  }

  async startVoiceConversation() {
    try {
      // 在智能对话模式下，额外检查模式状态
      if (this.smartConversationMode && (!this.smartConversationActive)) {
        console.log('🛑 智能对话模式未激活，无法开始录音')
        return { success: false, error: '智能对话模式未激活' }
      }

      // 检查是否已经在录音中
      if (this.isConversing) {
        if (this.smartConversationMode || this.continuousMode) {
          console.log('智能/持续模式：强制重置状态并重新开始')
          // 强制重置所有状态
          await this.forceResetState()
          await this.delay(200)
        } else {
          console.log('已经在录音中，请先停止当前录音')
          this.notifyError('正在录音中，请先停止当前录音')
          return { success: false, error: '正在录音中，请先停止当前录音' }
        }
      }

      this.isConversing = true
      this.currentStatus = 'recording'
      this.notifyStatusChange('recording')
      this.notifyConversationStart()

      // 开始录音
      const recordingResult = await audioService.startRecording()
      if (!recordingResult.success) {
        throw new Error(recordingResult.error || '录音启动失败')
      }

      console.log(`✅ 语音对话已开始 (${recordingResult.mode}模式)`)

      // 如果使用SenceVoice且需要声纹注册，给用户提示
      if (this.useSenceVoice && senceVoiceService.isEnrollmentRequired()) {
        this.notifyMessage('system', '检测到需要声纹注册，请录制至少3秒的音频用于注册')
      } else if (this.useSenceVoice && senceVoiceService.isKeywordActivationRequired()) {
        const keyword = senceVoiceService.getWakeupKeyword()
        this.notifyMessage('system', `请说出唤醒词: "${keyword}" 来激活语音助手`)
      }
      if (recordingResult.mode === 'simulation') {
        this.notifyMessage('system', '使用模拟录音模式，点击停止来模拟语音输入')
      }

      return { success: true, mode: recordingResult.mode, message: recordingResult.message }
    } catch (error) {
      console.error('开始语音对话失败:', error)
      this.isConversing = false
      this.currentStatus = 'idle'
      this.notifyStatusChange('idle')
      this.notifyError(`无法开始对话: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  async stopVoiceConversation() {
    try {
      if (!this.isConversing) {
        console.log('没有正在进行的对话')
        return false
      }

      this.currentStatus = 'processing'
      this.notifyStatusChange('processing')

      // 停止录音并获取音频文件
      const audioUri = await audioService.stopRecording()
      if (!audioUri) {
        throw new Error('录音失败')
      }

      // 如果使用SenceVoice服务
      if (this.useSenceVoice && senceVoiceService.getConnectionStatus().isConnected) {
        try {
          // 检查是否需要声纹注册
          if (senceVoiceService.isEnrollmentRequired()) {
            console.log('执行声纹注册...')
            const enrollResult = await senceVoiceService.sendEnrollmentRequest(audioUri)
            console.log('声纹注册结果:', enrollResult)
            // 注册响应会通过回调处理
          } else {
            // 发送语音识别和对话请求
            console.log('发送语音请求到SenceVoice...')
            const voiceResult = await senceVoiceService.sendVoiceRequest(audioUri)
            console.log('SenceVoice响应:', voiceResult)
            // 语音响应会通过回调处理
          }

          this.isConversing = false
          this.notifyConversationEnd()
          return true
        } catch (senceVoiceError) {
          console.warn('SenceVoice处理失败，回退到传统模式:', senceVoiceError)
          this.notifyError(`SenceVoice处理失败: ${senceVoiceError.message}`)
        }
      }

      // 传统模式处理
      console.log('使用传统语音处理模式')
      // 语音转文字
      const sttResult = await sttTtsService.intelligentSTT(audioUri)
      if (!sttResult.success) {
        throw new Error(`语音识别失败: ${sttResult.error}`)
      }

      console.log('用户说:', sttResult.text)
      this.notifyMessage('user', sttResult.text)

      // 发送给大模型
      const llmResult = await responseLLMService.sendMessage(sttResult.text)
      if (!llmResult.success) {
        throw new Error(`大模型响应失败: ${llmResult.error}`)
      }

      console.log('AI回复:', llmResult.message)
      this.notifyMessage('assistant', llmResult.message)

      // 文字转语音
      const ttsResult = await sttTtsService.intelligentTTS(llmResult.message)
      if (ttsResult.success) {
        console.log('✅ 语音合成成功，提供商:', ttsResult.provider)
        this.currentStatus = 'speaking'
        this.notifyStatusChange('speaking')

        // 根据不同的TTS提供商处理播放
        if (ttsResult.provider === 'expo') {
          // Expo Speech直接播放，无需通过AudioService
          console.log('📱 Expo Speech已直接播放语音')
          // Expo Speech没有播放完成回调，使用估算时间
          const estimatedDuration = this.estimateSpeechDuration(llmResult.message)
          
          // 在持续模式下，立即设置为idle，不等待播放完成
          if (this.continuousMode) {
            // 短暂延迟后设置为idle，让TTS开始播放
            setTimeout(() => {
              this.currentStatus = 'idle'
              this.notifyStatusChange('idle')
            }, 500) // 减少延迟，让持续监听更快响应
          } else {
            // 非持续模式，按原逻辑等待播放完成
            setTimeout(() => {
              this.currentStatus = 'idle'
              this.notifyStatusChange('idle')
            }, estimatedDuration)
          }
        } else if (ttsResult.audioData) {
          // 其他提供商返回音频数据，通过AudioService播放
          try {
            await audioService.playAudioFromBase64(ttsResult.audioData)
            console.log('✅ 音频播放完成')
          } catch (playError) {
            console.error('音频播放失败:', playError)
          }
        } else {
          console.log('⚠️ TTS成功但无音频数据')
        }
      } else {
        console.error('❌ 语音合成失败:', ttsResult.error)
        this.notifyError(`语音合成失败: ${ttsResult.error}`)
      }

      this.isConversing = false
      this.notifyConversationEnd()

      // 注意：如果是Expo Speech，状态已经在setTimeout中设置为idle
      // 如果是其他提供商，现在设置为idle
      if (ttsResult.provider !== 'expo') {
        this.currentStatus = 'idle'
        this.notifyStatusChange('idle')
      }

      return true
    } catch (error) {
      // 使用console.log以避免触发任何可能的错误弹窗
      console.log('🎯 语音对话处理失败（已拦截）:', error.message || error)
      this.isConversing = false
      this.currentStatus = 'idle'
      this.notifyStatusChange('idle')
      this.notifyError(`对话处理失败: ${error.message}`)
      return false
    }
  }

  async sendTextMessage(text) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('消息内容为空')
      }

      this.currentStatus = 'processing'
      this.notifyStatusChange('processing')
      this.notifyMessage('user', text)

      // 发送给大模型
      const llmResult = await responseLLMService.sendMessage(text)
      if (!llmResult.success) {
        throw new Error(`大模型响应失败: ${llmResult.error}`)
      }

      console.log('AI回复:', llmResult.message)
      this.notifyMessage('assistant', llmResult.message)

      // 如果需要语音回复
      const ttsResult = await sttTtsService.intelligentTTS(llmResult.message)
      if (ttsResult.success) {
        await audioService.playAudioFromBase64(ttsResult.audioData)
        this.currentStatus = 'speaking'
        this.notifyStatusChange('speaking')
      }

      this.currentStatus = 'idle'
      this.notifyStatusChange('idle')
      return {
        success: true,
        message: llmResult.message,
      }
    } catch (error) {
      console.error('文本消息处理失败:', error)
      this.currentStatus = 'idle'
      this.notifyStatusChange('idle')
      this.notifyError(`消息处理失败: ${error.message}`)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  handleWebSocketMessage(data) {
    try {
      switch (data.type) {
        case 'stt_result':
          this.handleSTTResult(data)
          break
        case 'llm_response':
          this.handleLLMResponse(data)
          break
        case 'tts_result':
          this.handleTTSResult(data)
          break
        default:
          console.log('未知的WebSocket消息类型:', data.type)
      }
    } catch (error) {
      console.error('处理WebSocket消息失败:', error)
      this.notifyError(`消息处理失败: ${error.message}`)
    }
  }

  handleSTTResult(data) {
    if (data.success && data.text) {
      this.notifyMessage('user', data.text)
    } else {
      this.notifyError(`语音识别失败: ${data.error}`)
    }
  }

  handleLLMResponse(data) {
    if (data.success && data.message) {
      this.notifyMessage('assistant', data.message)
    } else {
      this.notifyError(`大模型响应失败: ${data.error}`)
    }
  }

  async handleTTSResult(data) {
    if (data.success && data.audioData) {
      try {
        await audioService.playAudioFromBase64(data.audioData)
        this.notifyStatusChange('speaking')
      } catch (error) {
        this.notifyError(`播放语音失败: ${error.message}`)
      }
    } else {
      this.notifyError(`语音合成失败: ${data.error}`)
    }
  }

  // 回调函数管理
  setCallbacks(callbacks) {
    this.conversationCallbacks = { ...this.conversationCallbacks, ...callbacks }
  }

  notifyConversationStart() {
    if (this.conversationCallbacks.onStart) {
      this.conversationCallbacks.onStart()
    }
  }

  notifyConversationEnd() {
    if (this.conversationCallbacks.onEnd) {
      this.conversationCallbacks.onEnd()
    }
  }

  notifyMessage(role, message) {
    if (this.conversationCallbacks.onMessage) {
      this.conversationCallbacks.onMessage({ role, message, timestamp: Date.now() })
    }
  }

  notifyError(error) {
    // 注释掉弹窗显示，但保留日志记录
    // 使用console.log以避免触发任何可能的错误弹窗
    console.log('🎯 数字人服务错误（已拦截）:', error)
    // if (this.conversationCallbacks.onError) {
    //   this.conversationCallbacks.onError(error)
    // }
  }

  notifyStatusChange(status) {
    if (this.conversationCallbacks.onStatusChange) {
      this.conversationCallbacks.onStatusChange(status)
    }
  }

  // 估算语音播放时长（毫秒）
  estimateSpeechDuration(text) {
    if (!text) return 1000

    // 中文：平均每个字符200ms，英文：平均每个单词500ms
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
    const punctuation = (text.match(/[。！？，、；：]/g) || []).length

    let duration = 0
    duration += chineseChars * 200 // 中文字符
    duration += englishWords * 500 // 英文单词
    duration += punctuation * 300 // 标点符号停顿

    // 最小1秒，最大30秒
    return Math.max(1000, Math.min(duration, 30000))
  }

  // SenceVoice特定方法
  async resetSenceVoiceKeyword() {
    if (this.useSenceVoice && senceVoiceService.getConnectionStatus().isConnected) {
      try {
        await senceVoiceService.resetKeywordStatus()
        this.notifyMessage('system', '关键词状态已重置')
      } catch (error) {
        this.notifyError(`重置关键词失败: ${error.message}`)
      }
    }
  }

  getSenceVoiceStatus() {
    if (this.useSenceVoice) {
      return {
        connectionStatus: senceVoiceService.getConnectionStatus(),
        serverStatus: senceVoiceService.getServerStatus(),
      }
    }
    return null
  }

  // 健康检查 - 检查服务状态并尝试自动修复
  performHealthCheck() {
    const issues = []
    const fixes = []

    // 检查WebSocket连接
    if (!webSocketService.isConnected()) {
      issues.push('WebSocket连接断开')
      fixes.push('WebSocket需要重新连接')
    }

    // 检查音频服务状态
    const audioStatus = audioService.getRecordingStatus()
    if (audioStatus.lastError) {
      issues.push(`音频服务错误: ${audioStatus.lastError}`)
      fixes.push('音频服务需要重新初始化')
    }

    // 检查状态一致性
    if (this.isConversing && this.currentStatus === 'idle') {
      issues.push('状态不一致：isConversing为true但currentStatus为idle')
      fixes.push('重置对话状态')
      this.isConversing = false
    }

    // 检查智能对话模式状态一致性
    if (this.smartConversationMode && !this.smartConversationActive) {
      issues.push('智能对话模式状态不一致')
      fixes.push('同步智能对话状态')
      this.smartConversationMode = false
    }

    // 检查定时器泄漏
    if (this.activeTimers.size > 10 || this.activeIntervals.size > 5) {
      issues.push(`定时器过多: timers=${this.activeTimers.size}, intervals=${this.activeIntervals.size}`)
      fixes.push('清理多余定时器')
    }

    return {
      healthy: issues.length === 0,
      issues,
      fixes,
      timestamp: Date.now()
    }
  }

  // 获取状态
  getStatus() {
    const healthCheck = this.performHealthCheck()
    
    const baseStatus = {
      isConnected: this.isConnected,
      isConversing: this.isConversing,
      currentStatus: this.currentStatus,
      mode: this.getCurrentMode(),
      vadState: this.vadState,
      smartConversationMode: this.smartConversationMode,
      smartConversationActive: this.smartConversationActive,
      continuousMode: this.continuousMode,
      continuousLoopActive: this.continuousLoopActive,
      audioStatus: audioService.getRecordingStatus(),
      wsConnected: webSocketService.isConnected(),
      useSenceVoice: this.useSenceVoice,
      healthCheck,
      activeTimers: this.activeTimers.size,
      activeIntervals: this.activeIntervals.size,
    }

    if (this.useSenceVoice) {
      baseStatus.senceVoiceStatus = this.getSenceVoiceStatus()
    }

    return baseStatus
  }

  // 尝试自动修复服务问题
  async autoRepair() {
    console.log('🔧 开始自动修复服务...')
    
    try {
      // 重置所有状态
      await this.forceResetState()
      
      // 重新连接WebSocket
      if (!webSocketService.isConnected()) {
        console.log('🔌 重新连接WebSocket...')
        webSocketService.resetConnection()
        await webSocketService.connect(this.modelConfig?.websocket_url || llmConfig.responseLLM.websocket_url)
      }
      
      // 重新初始化音频服务
      const audioStatus = audioService.getRecordingStatus()
      if (audioStatus.lastError) {
        console.log('🎵 重新初始化音频服务...')
        await audioService.initializeAudio()
      }
      
      // 清理多余的定时器
      if (this.activeTimers.size > 10 || this.activeIntervals.size > 5) {
        console.log('⏰ 清理多余定时器...')
        this.clearAllTimers()
      }
      
      console.log('✅ 自动修复完成')
      return true
    } catch (error) {
      console.error('❌ 自动修复失败:', error)
      return false
    }
  }

  // 清理资源
  async cleanup() {
    try {
      console.log('🧹 开始清理数字人服务资源...')
      
      // 停止所有模式
      this.smartConversationMode = false
      this.smartConversationActive = false
      this.continuousMode = false
      this.continuousLoopActive = false
      this.isConversing = false
      this.vadState = 'idle'
      this.currentStatus = 'idle'

      // 清理所有定时器，防止内存泄漏
      this.clearAllTimers()

      // 清理各个服务
      await audioService.cleanup()
      webSocketService.disconnect()
      
      if (responseLLMService && typeof responseLLMService.cleanup === 'function') {
        responseLLMService.cleanup()
      }

      if (this.useSenceVoice && senceVoiceService && typeof senceVoiceService.cleanup === 'function') {
        senceVoiceService.cleanup()
      }
      
      console.log('✅ 数字人服务清理完成')
    } catch (error) {
      console.error('❌ 数字人服务清理失败:', error)
    }
  }
}

// 创建单例实例
const digitalHumanService = new DigitalHumanService()
export default digitalHumanService
