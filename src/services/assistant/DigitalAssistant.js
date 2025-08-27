import webSocketService from '../connection/ConnectionManager'
import audioService from './AudioService'
import chatService from '../chat/ChatService'
import sttTtsService from './STTTTSService'
import senceVoiceService from './SenceVoiceService'
import streamingAudioService from './StreamingAudioService'
import streamingSTTService from './StreamingSTTService'
import unifiedStreamingSTT from '../voice/UnifiedStreamingSTT'
import llmConfig from '../../config/llmConfig'
import appConfig from '../../config/AppConfig'

class DigitalAssistant {
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
    this.textOnlyMode = false // 纯文本模式标志
    this._isProcessingRecording = false // 防止重复处理录音的标志
    this._isAISpeaking = false // 标记AI是否在说话，用于回音消除
    this.streamingMode = false // 是否使用流式STT-to-LLM模式
    this.isStreamingActive = false // 流式模式是否激活
    this.isManualRecording = false // 手动录音状态
    this.pttMode = true // PTT (Push-to-Talk) 模式标志
    this.autoStopAI = true // PTT模式下自动停止AI语音输出

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

    // 立即断开任何 WebSocket 连接
    this.forceDisconnectWebSocket()

    this.setupWebSocketCallbacks()
    this.setupTTSCallbacks() // 设置TTS回调
    this.setupSenceVoiceCallbacks()
  }

  // 强制断开所有 WebSocket 连接
  forceDisconnectWebSocket() {
    console.log('🛑 强制断开所有 WebSocket 连接...')
    try {
      // 断开 webSocketService (ConnectionManager)
      if (webSocketService) {
        webSocketService.disconnect()
        console.log('✅ webSocketService 已断开')
      }

      // 断开 senceVoiceService 的 WebSocket
      if (senceVoiceService) {
        try {
          senceVoiceService.disconnect()
          console.log('✅ senceVoiceService 已断开')
        } catch (e) {
          console.log('senceVoiceService 断开操作:', e.message)
        }
      }
    } catch (error) {
      console.log('强制断开 WebSocket 操作:', error.message)
    }
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

        // 确保AI已停止说话再开始录音
        if (this._isAISpeaking) {
          console.log('⏸️ 等待AI说话完成...')
          await this.waitForAISpeechComplete()
        }

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

          // 基础语音活动检测逻辑
          if (this._isAISpeaking) {
            const timeSinceStart = now - lastVoiceActivity

            // 简单的用户打断检测（延迟检测避免误判）
            if (timeSinceStart > 800) { // 800ms延迟检测
              console.log('🎯 检测用户打断')
              const wasInterrupted = await this.handleUserInterruption()
              if (wasInterrupted) {
                console.log('🛑 用户打断AI')
                speechDetected = false
                silenceStartTime = null
                lastVoiceActivity = now
              }
            }
            return
          }

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
    // 防重复处理标志
    if (this._isProcessingRecording) {
      console.log('🔄 录音处理已在进行中，跳过重复请求')
      return false
    }

    try {
      this._isProcessingRecording = true // 设置处理标志

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
    } finally {
      this._isProcessingRecording = false // 清除处理标志
    }
  }

  // 等待AI回复完成 - 专门为智能对话优化
  async waitForAIResponseComplete() {
    return new Promise((resolve) => {
      const maxWaitTime = 10000 // 最多等待10秒
      const startTime = Date.now()

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
    if (this.streamingMode) return 'streaming_stt_llm'
    if (this.smartConversationMode) return 'smart_conversation'
    if (this.continuousMode) return 'continuous_listening'
    if (this.pttMode) return 'push_to_talk'
    return 'manual'
  }

  // ==================== PTT模式控制 ====================

  // 启用PTT模式
  enablePTTMode() {
    console.log('🎤 启用PTT (Push-to-Talk) 模式')
    this.pttMode = true
    this.autoStopAI = true
    console.log('✅ PTT模式已启用 - 按住说话，松开发送')
    return { success: true, message: 'PTT模式已启用' }
  }

  // 禁用PTT模式
  disablePTTMode() {
    console.log('🎤 禁用PTT模式')
    this.pttMode = false
    this.autoStopAI = false
    console.log('✅ PTT模式已禁用')
    return { success: true, message: 'PTT模式已禁用' }
  }

  // 设置PTT配置
  setPTTConfig(config = {}) {
    const { autoStopAI = true } = config
    this.autoStopAI = autoStopAI
    console.log('🔧 PTT配置已更新:', { autoStopAI: this.autoStopAI })
    return { success: true, config: { autoStopAI: this.autoStopAI } }
  }

  // 检查是否在PTT模式
  isInPTTMode() {
    return this.pttMode
  }

  // 获取语音活动状态
  getVADState() {
    return this.vadState
  }

  // ==================== 流式STT-to-LLM模式 ====================

  // 启用流式STT-to-LLM模式
  async enableStreamingMode() {
    if (this.streamingMode) {
      console.log('流式模式已启用')
      return { success: true, message: '流式模式已启用' }
    }

    // 关闭其他模式
    if (this.smartConversationMode) {
      await this.disableSmartConversation()
    }
    if (this.continuousMode) {
      await this.disableContinuousMode()
    }

    console.log('🚀 启用流式STT-to-LLM模式')
    this.streamingMode = true
    this.isStreamingActive = true

    // 初始化统一流式STT服务
    const sttInitResult = await unifiedStreamingSTT.initialize()
    if (!sttInitResult.success) {
      console.warn('⚠️ 统一流式STT初始化失败，将使用传统方式')
    } else {
      console.log(`✅ 统一流式STT初始化成功: ${sttInitResult.provider}`)
    }

    // 根据STT类型设置不同的处理方式
    const sttStatus = unifiedStreamingSTT.getCurrentStatus()
    if (sttStatus.isRealStreaming) {
      // 真流式STT：直接使用Web Speech API等
      console.log('🎯 使用真流式STT处理模式')
      this.setupRealStreamingSTT()
    } else {
      // 伪流式STT：需要音频流配合
      console.log('🎯 使用准流式STT处理模式')
      await this.setupPseudoStreamingSTT()
    }

    // 设置统一的STT回调
    unifiedStreamingSTT.setCallbacks({
      onPartialResult: (result) => {
        this.handlePartialTranscript(result)
      },
      onFinalResult: (result) => {
        this.handleFinalTranscript(result)
      },
      onError: (error) => {
        console.error('❌ 统一流式STT错误:', error)
        this.notifyError(`流式语音识别失败: ${error.message}`)
      },
    })

    this.notifyMessage('system', '流式语音模式已启用！说话内容将实时转换为文字并发送给AI')
    return { success: true, message: '流式模式已启用' }
  }

  // 设置真流式STT处理（如Web Speech API）
  setupRealStreamingSTT() {
    console.log('🎤 配置真流式STT处理模式')
    // 真流式STT不需要音频流，直接通过浏览器API处理
    this.realStreamingMode = true
  }

  // 设置伪流式STT处理（需要音频流配合）
  async setupPseudoStreamingSTT() {
    console.log('🎤 配置准流式STT处理模式')
    this.realStreamingMode = false

    // 初始化流式音频服务
    await streamingAudioService.initializeStreaming()

    // 设置流式音频回调
    streamingAudioService.setOnAudioChunk(async (audioChunk) => {
      if (this.isStreamingActive) {
        await unifiedStreamingSTT.addAudioChunk(audioChunk)
      }
    })

    streamingAudioService.setOnStreamingEnd((result) => {
      if (this.isStreamingActive) {
        unifiedStreamingSTT.stopStreaming()
      }
    })
  }

  // 关闭流式STT-to-LLM模式
  async disableStreamingMode() {
    if (!this.streamingMode && !this.isStreamingActive) {
      console.log('流式模式已关闭')
      return { success: true, message: '流式模式已关闭' }
    }

    console.log('🔄 关闭流式STT-to-LLM模式...')

    this.streamingMode = false
    this.isStreamingActive = false

    // 停止统一流式服务
    await unifiedStreamingSTT.cleanup()
    if (!this.realStreamingMode) {
      await streamingAudioService.forceStopStreaming()
    }

    // 重置状态
    await this.forceResetState()

    console.log('🔄 流式模式已关闭')
    this.notifyMessage('system', '流式语音模式已关闭')
    return { success: true, message: '流式模式已关闭' }
  }

  // 开始流式语音对话
  async startStreamingConversation() {
    try {
      if (!this.streamingMode) {
        return { success: false, error: '请先启用流式模式' }
      }

      if (this.isConversing) {
        console.log('已有对话进行中，先停止当前对话')
        await this.stopStreamingConversation()
        await this.delay(200)
      }

      console.log('🎤 开始流式语音对话...')
      this.isConversing = true
      this.currentStatus = 'recording'
      this.notifyStatusChange('recording')
      this.notifyConversationStart()

      // 根据STT类型启动不同的服务
      if (this.realStreamingMode) {
        // 真流式STT：直接启动语音识别
        const sttResult = await unifiedStreamingSTT.startStreaming()
        if (!sttResult.success) {
          throw new Error(sttResult.error || '真流式STT启动失败')
        }
        console.log(`✅ 真流式STT已启动: ${sttResult.description}`)
      } else {
        // 伪流式STT：先启动音频流再启动STT
        const audioResult = await streamingAudioService.startStreaming()
        if (!audioResult.success) {
          throw new Error(audioResult.error || '流式音频启动失败')
        }

        const sttResult = await unifiedStreamingSTT.startStreaming()
        if (!sttResult.success) {
          throw new Error(sttResult.error || '准流式STT启动失败')
        }
        console.log(`✅ 准流式STT已启动: ${sttResult.description}`)
      }

      console.log('✅ 流式语音对话已开始')
      return {
        success: true,
        mode: audioResult.mode,
        message: '流式语音对话已开始',
      }
    } catch (error) {
      console.error('❌ 启动流式对话失败:', error)
      this.isConversing = false
      this.currentStatus = 'idle'
      this.notifyStatusChange('idle')
      this.notifyError(`启动流式对话失败: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  // 停止流式语音对话
  async stopStreamingConversation() {
    try {
      if (!this.isConversing) {
        console.log('没有进行中的流式对话')
        return { success: true }
      }

      console.log('🛑 停止流式语音对话...')

      // 根据STT类型停止不同的服务
      let sttResult
      if (this.realStreamingMode) {
        // 真流式STT：只需停止STT
        sttResult = await unifiedStreamingSTT.stopStreaming()
      } else {
        // 伪流式STT：停止音频流和STT
        await streamingAudioService.stopStreaming()
        sttResult = await unifiedStreamingSTT.stopStreaming()
      }

      this.isConversing = false
      this.currentStatus = 'idle'
      this.notifyStatusChange('idle')
      this.notifyConversationEnd()

      console.log('✅ 流式对话已停止')

      if (sttResult.success && sttResult.finalText) {
        console.log(`📝 最终识别文本: ${sttResult.finalText}`)
        return { success: true, finalText: sttResult.finalText }
      }

      return { success: true }
    } catch (error) {
      console.error('❌ 停止流式对话失败:', error)
      this.isConversing = false
      this.currentStatus = 'idle'
      this.notifyStatusChange('idle')
      return { success: false, error: error.message }
    }
  }

  // 处理部分转录结果
  handlePartialTranscript(transcript) {
    if (!this.isStreamingActive) return

    try {
      console.log(`📝 实时识别: ${transcript.text}`)

      // 通知UI更新部分转录内容
      this.notifyMessage('user_partial', transcript.text)

      // 当部分转录足够长时，可以开始发送给LLM
      if (transcript.text.length >= 10) {
        this.sendPartialToLLM(transcript.text)
      }
    } catch (error) {
      console.error('❌ 处理部分转录失败:', error)
    }
  }

  // 处理最终转录结果
  async handleFinalTranscript(transcript) {
    if (!this.isStreamingActive) return

    try {
      console.log(`📝 最终识别: ${transcript.text}`)

      // 通知UI显示最终用户输入
      this.notifyMessage('user', transcript.text)

      // 发送最终文本给LLM获取流式响应
      await this.sendFinalToLLMStreaming(transcript.text)
    } catch (error) {
      console.error('❌ 处理最终转录失败:', error)
      this.notifyError(`处理语音转录失败: ${error.message}`)
    }
  }

  // 发送部分文本给LLM（可选的预处理）
  async sendPartialToLLM(partialText) {
    try {
      // 对于部分文本，可以进行预处理或缓存
      // 这里暂时只记录，不发送给LLM，避免过多请求
      console.log(`📋 缓存部分文本: ${partialText}`)
    } catch (error) {
      console.error('❌ 发送部分文本失败:', error)
    }
  }

  // 发送最终文本给LLM并获取流式响应
  async sendFinalToLLMStreaming(finalText) {
    try {
      if (!finalText || finalText.trim().length === 0) {
        console.warn('最终转录文本为空，跳过LLM请求')
        return
      }

      this.currentStatus = 'processing'
      this._isAISpeaking = true // 标记AI开始响应
      this.notifyStatusChange('processing')

      console.log('📤 发送最终文本到LLM进行流式处理...')

      // 使用语音专用LLM请求（包含emoji过滤）
      await this.sendVoiceLLMRequest(
        finalText.trim(),
        (partialResponse) => {
          this.handleStreamingLLMResponse(partialResponse)
        },
        true, // 启用流式响应
      )
    } catch (error) {
      console.error('❌ 流式LLM请求失败:', error)
      this.notifyError(`AI响应失败: ${error.message}`)
      this.currentStatus = 'idle'
      this._isAISpeaking = false
      this.notifyStatusChange('idle')
    }
  }

  // 处理流式LLM响应 - 用于流式模式
  async handleStreamingLLMResponse(partialResponse) {
    try {
      if (partialResponse.isFinal) {
        // 最终响应 - 开始TTS
        console.log('✅ LLM流式响应完成，开始语音合成')

        this.currentStatus = 'speaking'
        this.notifyStatusChange('speaking')
        this.notifyMessage('assistant', partialResponse.text)

        // 使用现有TTS服务
        const ttsResult = await sttTtsService.intelligentTTS(partialResponse.text)

        if (!ttsResult.success) {
          console.warn('❌ 语音合成失败:', ttsResult.error)
          this.currentStatus = 'idle'
          this._isAISpeaking = false
          this.notifyStatusChange('idle')
        }
      } else {
        // 部分响应 - 实时显示
        this.notifyMessage('assistant_partial', partialResponse.text)
      }
    } catch (error) {
      console.error('❌ 处理流式响应失败:', error)
    }
  }

  // ==================== 改进的流式TTS实现 ====================

  // 初始化流式TTS状态
  initStreamingTTS() {
    this.streamingText = '' // 累积的文本
    this.processedLength = 0 // 已处理的文本长度
    this.ttsQueue = [] // TTS播放队列
    this.isPlayingTTS = false // 是否正在播放TTS
    console.log('🎵 初始化流式TTS')
  }

  // 处理流式LLM响应并触发TTS
  async handleStreamingLLMWithTTS(partialResponse) {
    try {
      // 更新累积文本
      this.streamingText = partialResponse.text

      // 显示部分响应
      if (partialResponse.isFinal) {
        this.notifyMessage('assistant', partialResponse.text)
        this.currentStatus = 'speaking'
        this.notifyStatusChange('speaking')
        // 处理最终的剩余文本
        await this.processPendingSentences(true)
      } else {
        this.notifyMessage('assistant_partial', partialResponse.text)
        // 检测并处理新的完整句子
        await this.processPendingSentences(false)
      }
    } catch (error) {
      console.error('❌ 流式响应处理失败:', error)
    }
  }

  // 移除文本中的所有emoji和符号
  removeEmojisAndSymbols(text) {
    if (!text) return ''
    
    // 移除所有emoji (包括复合emoji)
    let cleanText = text
      // 移除标准emoji范围
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // 表情符号
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // 杂项符号和象形文字
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // 交通和地图符号
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // 旗帜
      .replace(/[\u{2600}-\u{26FF}]/gu, '')   // 杂项符号
      .replace(/[\u{2700}-\u{27BF}]/gu, '')   // 装饰符号
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // 变体选择符
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // 补充符号和象形文字
      .replace(/[\u{1F018}-\u{1F270}]/gu, '') // 扩展符号
      // 移除零宽度连接符 (用于复合emoji)
      .replace(/[\u{200D}]/gu, '')
      // 移除其他常见符号
      .replace(/[👍👎❤️💕🌟⭐]/gu, '')
      // 移除颜文字相关符号
      .replace(/[≥﹏≤╮╯╰╭∀]/gu, '')
    
    return cleanText.trim()
  }

  // 检测并处理待处理的句子
  async processPendingSentences(isFinal = false) {
    const newText = this.streamingText.substring(this.processedLength)
    if (!newText && !isFinal) return

    // 检测完整句子
    const sentences = this.extractCompleteSentences(this.streamingText, this.processedLength, isFinal)

    // 将新句子添加到TTS队列 (过滤emoji)
    for (const sentence of sentences) {
      const cleanSentence = this.removeEmojisAndSymbols(sentence.trim())
      if (cleanSentence.length > 0) {
        this.ttsQueue.push(cleanSentence)
        console.log(`📝 检测到句子: "${cleanSentence}"`)
      }
    }

    // 开始播放TTS队列
    this.playTTSQueue()
  }

  // 提取完整句子
  extractCompleteSentences(fullText, startIndex, isFinal) {
    const sentences = []
    const sentenceRegex = /[。！？\n]/g

    let match
    let lastIndex = startIndex
    sentenceRegex.lastIndex = startIndex

    // 查找句子结束标记
    while ((match = sentenceRegex.exec(fullText)) !== null) {
      const sentence = fullText.substring(lastIndex, match.index + 1)
      sentences.push(sentence)
      lastIndex = match.index + 1
    }

    // 更新已处理长度
    this.processedLength = lastIndex

    // 如果是最终响应，也包含剩余文本
    if (isFinal && lastIndex < fullText.length) {
      const remainingText = fullText.substring(lastIndex)
      if (remainingText.trim().length > 0) {
        sentences.push(remainingText)
        this.processedLength = fullText.length
      }
    }

    return sentences
  }

  // 播放TTS队列（并行处理优化 - 边播放边转换）
  async playTTSQueue() {
    if (this.isPlayingTTS || this.ttsQueue.length === 0) return

    this.isPlayingTTS = true
    this.preloadedTTS = new Map() // 预加载的TTS缓存

    while (this.ttsQueue.length > 0 || this.preloadedTTS.size > 0) {
      const sentence = this.ttsQueue.shift()
      
      if (!sentence) {
        // 如果队列为空但有预加载的，等待一下
        await this.delay(10)
        continue
      }

      try {
        console.log(`🔊 TTS播放: "${sentence}"`)

        // 并行处理：开始预加载下一句
        if (this.ttsQueue.length > 0) {
          const nextSentence = this.ttsQueue[0]
          this.preloadNextTTS(nextSentence)
        }

        // 播放当前句子（优先使用预加载的音频）
        await this.playTTSWithCompletion(sentence)

        // 句子间极短停顿
        await this.delay(10)
      } catch (error) {
        console.error('❌ TTS播放失败:', error)
        // 继续播放下一句
      }
    }

    this.isPlayingTTS = false
    this.preloadedTTS = null

    // 如果队列清空，设置状态为idle
    if (this.ttsQueue.length === 0) {
      this.currentStatus = 'idle'
      this._isAISpeaking = false
      this.notifyStatusChange('idle')
      console.log('✅ 流式TTS播放完成')
    }
  }

  // 预加载下一句TTS音频（并行处理）
  async preloadNextTTS(sentence) {
    if (!sentence || this.preloadedTTS.has(sentence)) return

    try {
      // 在后台开始TTS转换，不等待完成
      const ttsPromise = this.generateTTSAudio(sentence)
      this.preloadedTTS.set(sentence, ttsPromise)
    } catch (error) {
      console.warn('⚠️ TTS预加载失败:', error)
    }
  }

  // 生成TTS音频数据（不播放）
  async generateTTSAudio(text) {
    const siliconFlowTTS = require('../voice/SiliconFlowTTS').default
    return await siliconFlowTTS.textToSpeech(text, { playImmediately: false })
  }

  // 播放单句TTS并等待真正的播放完成
  async playTTSWithCompletion(sentence) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`🔊 开始播放: "${sentence}"`)

        if (this.useSenceVoice) {
          // 设置播放完成回调
          const originalCallback = senceVoiceService.onSpeechComplete
          senceVoiceService.onSpeechComplete = () => {
            console.log('✅ SenceVoice播放完成')
            if (originalCallback) originalCallback()
            resolve()
          }

          const ttsResult = await senceVoiceService.textToSpeech(sentence)
          if (!ttsResult.success) {
            senceVoiceService.onSpeechComplete = originalCallback
            throw new Error(ttsResult.error)
          }
        } else {
          // 使用SiliconFlow TTS的播放完成检测
          const siliconFlowTTS = require('../voice/SiliconFlowTTS').default

          // 检查是否有预加载的音频
          if (this.preloadedTTS && this.preloadedTTS.has(sentence)) {
            try {
              const preloadedResult = await this.preloadedTTS.get(sentence)
              this.preloadedTTS.delete(sentence)
              
              if (preloadedResult.success && preloadedResult.audioUri) {
                console.log('✅ 使用预加载音频播放')
                // 直接播放预加载的音频并等待完成
                await siliconFlowTTS.playAudioUri(preloadedResult.audioUri)
                resolve()
                return
              }
            } catch (error) {
              console.warn('⚠️ 预加载音频播放失败，使用实时生成:', error)
            }
          }

          // 设置播放完成回调
          const originalCallback = siliconFlowTTS.onSpeechComplete
          siliconFlowTTS.onSpeechComplete = () => {
            console.log('✅ SiliconFlow播放完成')
            if (originalCallback) originalCallback()
            siliconFlowTTS.onSpeechComplete = originalCallback
            resolve()
          }

          const ttsResult = await sttTtsService.intelligentTTS(sentence)
          if (!ttsResult.success) {
            siliconFlowTTS.onSpeechComplete = originalCallback
            throw new Error(ttsResult.error)
          }
        }

        // 设置安全超时，防止回调丢失
        const timeoutId = setTimeout(() => {
          console.warn('⚠️ TTS播放完成回调超时，强制继续')
          resolve()
        }, Math.max(sentence.length * 300, 10000))

        // 清理超时的包装器
        const originalResolve = resolve
        resolve = () => {
          clearTimeout(timeoutId)
          originalResolve()
        }
      } catch (error) {
        console.error('❌ TTS播放失败:', error)
        reject(error)
      }
    })
  }

  // 清理流式TTS状态
  cleanupStreamingTTS() {
    this.streamingText = ''
    this.processedLength = 0
    this.ttsQueue = []
    this.isPlayingTTS = false
    console.log('🧹 清理流式TTS状态')
  }

  // ==================== 语音专用LLM请求 ====================

  // 语音专用LLM请求 - 添加语音输出限制
  async sendVoiceLLMRequest(userInput, onPartialResponse = null, isStreaming = false) {
    // 创建语音专用的系统提示
    const voiceSystemPrompt = this.createVoiceSystemPrompt()

    try {
      if (isStreaming && onPartialResponse) {
        // 流式请求
        return await this.sendVoiceStreamingRequest(userInput, voiceSystemPrompt, onPartialResponse)
      }
      // 常规请求
      return await this.sendVoiceRegularRequest(userInput, voiceSystemPrompt)
    } catch (error) {
      console.error('❌ 语音LLM请求失败:', error)
      throw error
    }
  }

  // 创建语音专用系统提示
  createVoiceSystemPrompt() {
    const basePrompt = appConfig.gabalong.system_prompt || ''

    // 添加强化的语音输出限制
    const voiceConstraints = `

【强制语音输出规则 - 必须严格遵守】
以下内容在语音对话中绝对禁止使用：
❌ 完全禁止任何emoji符号：😊 😄 🎉 👍 ❤️ 🌟 ⭐ 👩‍💻 🔍 🤔 等
❌ 完全禁止复合emoji：👩‍💻 👨‍🔬 🏃‍♂️ 🙋‍♀️ 等
❌ 完全禁止任何Unicode表情符号
❌ 禁止颜文字符号：^_^ ≥﹏≤ ╮(╯_╰)╭ (・∀・) 等  
❌ 禁止装饰符号：★ ♪ ♥ ☆ ◆ ○ ● 等
❌ 禁止英文表情：:) :( :D =) 等

✅ 语音对话要求：
- 只使用纯文字回答，不添加任何符号装饰
- 使用标准中文标点：。！？，、；：
- 保持自然对话语调，简洁明了
- 语言要口语化，适合语音播报

【重要】这是语音TTS系统，任何emoji、符号都会严重影响语音效果！
请严格只使用汉字、数字、英文字母和基本标点符号回答。`

    return basePrompt + voiceConstraints
  }

  // 发送语音流式请求 - 直接构建带语音限制的消息
  async sendVoiceStreamingRequest(userInput, systemPrompt, onPartialResponse) {
    // 直接调用ChatService的内部方法，传入自定义系统提示
    return await this.callChatServiceWithCustomPrompt(userInput, systemPrompt, onPartialResponse, true)
  }

  // 发送语音常规请求 - 直接构建带语音限制的消息
  async sendVoiceRegularRequest(userInput, systemPrompt) {
    // 直接调用ChatService的内部方法，传入自定义系统提示
    return await this.callChatServiceWithCustomPrompt(userInput, systemPrompt, null, false)
  }

  // 使用自定义系统提示调用ChatService
  async callChatServiceWithCustomPrompt(userInput, systemPrompt, onPartialResponse, isStreaming) {
    // 直接构建消息，绕过ChatService的默认系统提示
    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userInput,
      },
    ]


    try {
      if (isStreaming && onPartialResponse) {
        // 使用模拟流式，但确保使用自定义系统提示
        const originalPrompt = appConfig.gabalong.system_prompt
        appConfig.gabalong.system_prompt = systemPrompt
        
        try {
          const response = await chatService.sendMessage(userInput, [])
          if (response.success) {
            // 模拟流式显示
            await this.simulateVoiceStreaming(response.message, onPartialResponse)
          }
          return response
        } finally {
          appConfig.gabalong.system_prompt = originalPrompt
        }
      }
      // 临时替换系统提示的方法（确保时序正确）
      const originalPrompt = appConfig.gabalong.system_prompt
      appConfig.gabalong.system_prompt = systemPrompt

      try {
        const result = await chatService.sendMessage(userInput, [])
        console.log('📞 语音LLM响应已接收')
        return result
      } finally {
        appConfig.gabalong.system_prompt = originalPrompt
      }
    } catch (error) {
      console.error('❌ 自定义提示LLM调用失败:', error)
      throw error
    }
  }

  // 模拟语音流式显示
  async simulateVoiceStreaming(message, onPartialResponse) {
    const sentences = message.split(/([。！？\n])/g)
    let accumulatedText = ''

    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i]) {
        accumulatedText += sentences[i]

        onPartialResponse({
          text: accumulatedText,
          isFinal: i === sentences.length - 1,
          timestamp: Date.now(),
        })

        // 如果是句子结束，稍作停顿让TTS有时间处理
        const isSentenceEnd = /[。！？\n]/.test(sentences[i])
        await this.delay(isSentenceEnd ? 400 : 100)
      }
    }
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
    this._isProcessingRecording = false // 重置防重复处理标志
    this._isAISpeaking = false // 重置AI说话状态

    try {
      // 强制停止录音服务
      await audioService.forceStopRecording()

      // 强制停止AI说话
      const siliconFlowTTS = require('../voice/SiliconFlowTTS').default
      await siliconFlowTTS.stopCurrentPlayback()
    } catch (error) {
      console.log('强制停止服务失败:', error.message)
    }

    this.notifyStatusChange('idle')
  }

  // 等待AI说话完成
  async waitForAISpeechComplete() {
    return new Promise((resolve) => {
      if (!this._isAISpeaking) {
        resolve()
        return
      }

      const checkInterval = setInterval(() => {
        if (!this._isAISpeaking) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)

      // 最多等待10秒
      setTimeout(() => {
        clearInterval(checkInterval)
        this._isAISpeaking = false
        resolve()
      }, 10000)
    })
  }

  // 检测用户打断并处理
  async handleUserInterruption() {
    if (this._isAISpeaking) {
      console.log('🛑 用户打断检测')

      // 停止当前TTS播放
      const siliconFlowTTS = require('../voice/SiliconFlowTTS').default
      await siliconFlowTTS.stopCurrentPlayback()

      // 重置状态
      this._isAISpeaking = false
      this.currentStatus = 'idle'

      return true
    }
    return false
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
    this.activeTimers.forEach((timerId) => {
      clearTimeout(timerId)
    })
    this.activeTimers.clear()

    // 清理所有setInterval
    this.activeIntervals.forEach((intervalId) => {
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

  // 手动录音方法 - PTT模式按下麦克风按钮时调用
  async startManualVoiceRecording() {
    try {
      // PTT模式下立即停止AI语音输出
      if (this.pttMode && this.autoStopAI && this._isAISpeaking) {
        console.log('🛑 PTT模式: 立即停止AI语音输出')
        const siliconFlowTTS = require('../voice/SiliconFlowTTS').default
        await siliconFlowTTS.stopCurrentPlayback()
        this._isAISpeaking = false
        this.currentStatus = 'idle'
        // 给AI停止一点时间，避免音频冲突
        await this.delay(100)
      }

      // 设置手动录音状态
      this.isManualRecording = true
      this.currentStatus = 'recording'
      this.notifyStatusChange('recording')

      // PTT模式提供即时反馈
      if (this.pttMode) {
        this.notifyMessage('system', '🎤 正在录音，松开发送...')
      }

      // 初始化音频服务
      await audioService.initializeAudio()

      // 开始录音
      const result = await audioService.startRecording()
      if (!result.success) {
        this.isManualRecording = false
        this.currentStatus = 'idle'
        this.notifyStatusChange('idle')
        return { success: false, error: result.error }
      }

      return {
        success: true,
        message: `${this.pttMode ? 'PTT' : '手动'}录音已开始`,
        mode: this.pttMode ? 'PTT' : 'manual',
      }
    } catch (error) {
      console.error('❌ 语音录制启动失败:', error)
      this.isManualRecording = false
      this.currentStatus = 'idle'
      this.notifyStatusChange('idle')
      return { success: false, error: error.message }
    }
  }

  // 停止手动录音并处理 - PTT模式松开按钮时调用
  async stopManualVoiceRecording() {
    try {
      if (!this.isManualRecording) {
        return { success: true, message: `没有进行中的${this.pttMode ? 'PTT' : '手动'}录音` }
      }

      // 清理之前的流式TTS状态
      this.cleanupStreamingTTS()

      this.isManualRecording = false
      this.currentStatus = 'processing'
      this.notifyStatusChange('processing')

      // PTT模式提供处理反馈
      if (this.pttMode) {
        this.notifyMessage('system', '🔄 正在处理语音...')
      }

      // 停止录音
      const audioUri = await audioService.stopRecording()
      if (!audioUri || audioUri.includes('simulation://')) {
        console.log('使用模拟音频或录音失败')
        this.currentStatus = 'idle'
        this.notifyStatusChange('idle')
        return { success: false, error: '录音失败或使用模拟模式' }
      }

      // 处理录音
      const processResult = await this.processManualRecording(audioUri)

      this.currentStatus = 'idle'
      this.notifyStatusChange('idle')

      return processResult
    } catch (error) {
      console.error('❌ 手动语音录制停止失败:', error)
      this.isManualRecording = false
      this.currentStatus = 'idle'
      this.notifyStatusChange('idle')
      return { success: false, error: error.message }
    }
  }

  // 处理手动录音
  async processManualRecording(audioUri) {
    try {
      // STT - 语音转文字
      let transcription
      if (this.useSenceVoice) {
        const sttResult = await senceVoiceService.transcribeAudio(audioUri)
        transcription = sttResult.success ? sttResult.text : null
      } else {
        const sttResult = await sttTtsService.intelligentSTT(audioUri)
        transcription = sttResult.success ? sttResult.text : null
      }

      if (!transcription || transcription.trim() === '') {
        console.log('⚠️ 未识别到语音内容')
        this.notifyMessage('system', '未识别到语音内容，请重试')
        return { success: false, error: '语音识别失败' }
      }

      this.notifyMessage('user', transcription)

      // LLM流式处理 - 使用流式响应提升用户体验
      this.currentStatus = 'processing'
      this._isAISpeaking = true // 标记AI开始响应
      this.notifyStatusChange('processing')

      // 初始化流式TTS状态
      this.initStreamingTTS()

      try {
        // 使用语音专用的流式LLM，边生成边检测句子进行TTS
        await this.sendVoiceLLMRequest(
          transcription.trim(),
          (partialResponse) => {
            this.handleStreamingLLMWithTTS(partialResponse)
          },
          true, // 流式模式
        )
      } catch (streamError) {
        // 流式失败，降级到常规模式
        console.warn('流式LLM失败，使用常规模式')
        const llmResult = await this.sendVoiceLLMRequest(transcription.trim(), null, false)
        if (!llmResult.success) {
          console.error('❌ LLM处理失败:', llmResult.error)
          this.notifyMessage('system', 'AI处理失败，请重试')
          return { success: false, error: 'LLM处理失败' }
        }

        this.notifyMessage('assistant', llmResult.message)

        // 一次性TTS
        this.currentStatus = 'speaking'
        this.notifyStatusChange('speaking')
        this._isAISpeaking = true

        if (this.useSenceVoice) {
          await senceVoiceService.textToSpeech(llmResult.message)
        } else {
          await sttTtsService.intelligentTTS(llmResult.message)
        }
      }

      return { success: true, message: '语音处理完成' }
    } catch (error) {
      console.error('❌ 处理手动录音失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 设置TTS回调
  setupTTSCallbacks() {
    // 引入SiliconFlowTTS
    const siliconFlowTTS = require('../voice/SiliconFlowTTS').default

    // 设置播放完成回调
    siliconFlowTTS.setSpeechCompleteCallback(() => {
      this._isAISpeaking = false
      this.currentStatus = 'idle'
      this.notifyStatusChange('idle')
    })

    // 设置被打断回调
    siliconFlowTTS.setInterruptedCallback(() => {
      this._isAISpeaking = false
      this.currentStatus = 'idle'
      this.notifyStatusChange('idle')
    })
  }

  setupWebSocketCallbacks() {
    // 暂时禁用 WebSocket 相关功能
    console.log('⚠️ WebSocket 回调已禁用，使用纯 API 模式')

    // 确保 WebSocket 服务完全断开
    try {
      webSocketService.disconnect()
    } catch (error) {
      console.log('WebSocket 断开操作:', error.message)
    }

    // webSocketService.setOnConnect(() => {
    //   this.isConnected = true
    //   this.notifyStatusChange('connected')
    //   console.log('数字人服务已连接')
    // })

    // webSocketService.setOnDisconnect(() => {
    //   this.isConnected = false
    //   this.notifyStatusChange('disconnected')
    //   console.log('数字人服务已断开')
    // })

    // webSocketService.setOnError((error) => {
    //   this.notifyError(`WebSocket连接错误: ${error.message}`)
    // })

    // webSocketService.setOnMessage((data) => {
    //   this.handleWebSocketMessage(data)
    // })
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

      // 解析配置选项
      const {
        textOnlyMode = false, // 新增：纯文本模式标志
        skipAudio = false, // 跳过音频服务初始化
        skipWebSocket = false, // 跳过WebSocket连接
      } = config

      // 在纯文本模式下，强制跳过音频和WebSocket
      const shouldSkipAudio = textOnlyMode || skipAudio
      const shouldSkipWebSocket = textOnlyMode || skipWebSocket

      // 保存配置状态
      this.textOnlyMode = textOnlyMode

      if (textOnlyMode) {
        console.log('🔤 启用纯文本模式 - 跳过音频和WebSocket服务')
      }

      // 首先强制断开所有 WebSocket 连接
      this.forceDisconnectWebSocket()

      // 暂时禁用 SenceVoice 服务连接
      console.log('⚠️ SenceVoice 服务已禁用，使用纯文本模式')
      this.useSenceVoice = false

      // 配置各个服务
      console.log('初始化ResponseLLM服务...')
      let llmInitialized = false
      if (config.llm) {
        llmInitialized = await chatService.initialize(config.llm)
      } else {
        llmInitialized = await chatService.initialize()
      }

      if (!llmInitialized) {
        console.error('❌ ResponseLLM服务初始化失败')
        // 获取服务状态以便调试
        const status = chatService.getStatus()
        console.log('ChatService 状态:', JSON.stringify(status, null, 2))

        // 如果是 SiliconFlow 模式，这是一个严重错误
        if (status.provider === 'siliconflow') {
          throw new Error('SiliconFlow LLM 服务初始化失败，无法继续')
        } else {
          console.warn('WebSocket LLM服务初始化失败，但继续初始化其他服务')
        }
      } else {
        console.log('✅ ResponseLLM服务初始化成功')
      }

      // 只在非纯文本模式下初始化STT/TTS服务
      if (!shouldSkipAudio) {
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
      } else {
        console.log('🔇 跳过音频服务初始化（纯文本模式）')
      }

      // 只在需要时初始化WebSocket连接
      if (!shouldSkipWebSocket) {
        console.log('⚠️ 数字人动画 WebSocket 连接已禁用')
        // if (config.websocket_url) {
        //   try {
        //     webSocketService.connect(config.websocket_url)
        //   } catch (wsError) {
        //     console.warn('WebSocket连接失败:', wsError.message)
        //   }
        // }
      } else {
        console.log('🌐 跳过WebSocket连接（纯文本模式）')
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

      // 用户语音输入已经在STT服务中输出了，这里不重复

      this.notifyMessage('user', sttResult.text)

      // 发送给大模型
      const llmResult = await chatService.sendMessage(sttResult.text)
      if (!llmResult.success) {
        throw new Error(`大模型响应失败: ${llmResult.error}`)
      }

      // 移除LLM文本回复日志 - 用户只需要看到最终的语音输出

      this.notifyMessage('assistant', llmResult.message)

      // 语音合成处理 - 添加说话状态标记
      this.currentStatus = 'speaking'
      this._isAISpeaking = true // 标记AI开始说话
      this.notifyStatusChange('speaking')

      const ttsResult = await sttTtsService.intelligentTTS(llmResult.message)
      if (!ttsResult.success) {
        console.warn('❌ 语音合成失败:', ttsResult.error)
        this.currentStatus = 'idle'
        this._isAISpeaking = false // AI停止说话
        this.notifyStatusChange('idle')
      } else {
        // 如果是Expo Speech，需要等待播放完成
        if (ttsResult.provider === 'expo') {
          const estimatedDuration = this.estimateSpeechDuration(llmResult.message)
          setTimeout(() => {
            this.currentStatus = 'idle'
            this._isAISpeaking = false // AI停止说话
            this.notifyStatusChange('idle')
          }, estimatedDuration)
        } else {
          // 其他提供商通常有回调机制
          this.currentStatus = 'idle'
          this._isAISpeaking = false // AI停止说话
          this.notifyStatusChange('idle')
        }
      }

      this.isConversing = false
      this.notifyConversationEnd()

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

  async sendTextMessage(text, options = {}) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('消息内容为空')
      }

      // 解析选项，默认情况下在文本界面不使用TTS
      const { useTTS = false } = options

      // 检查服务状态，如果有问题则尝试修复
      const healthCheck = this.performHealthCheck()
      if (!healthCheck.healthy) {
        console.warn('🚨 检测到服务健康问题:', healthCheck.issues)
        console.log('🔧 尝试自动修复...')
        await this.autoRepair()
      }

      this.currentStatus = 'processing'
      this.notifyStatusChange('processing')
      this.notifyMessage('user', text)

      // 发送给大模型
      const llmResult = await chatService.sendMessage(text)
      if (!llmResult.success) {
        throw new Error(`大模型响应失败: ${llmResult.error}`)
      }

      console.log('AI回复:', llmResult.message)
      this.notifyMessage('assistant', llmResult.message)

      // 根据选项决定是否使用语音合成
      if (useTTS) {
        // 语音合成回复
        this.currentStatus = 'speaking'
        this.notifyStatusChange('speaking')

        const ttsResult = await sttTtsService.intelligentTTS(llmResult.message)
        if (!ttsResult.success) {
          console.warn('语音合成失败，但文本消息成功:', ttsResult.error)
          this.currentStatus = 'idle'
          this.notifyStatusChange('idle')
        } else {
          console.log(`✅ 语音合成成功 (${ttsResult.provider})`)

          // 如果是Expo Speech，需要等待播放完成
          if (ttsResult.provider === 'expo') {
            const estimatedDuration = this.estimateSpeechDuration(llmResult.message)
            setTimeout(() => {
              this.currentStatus = 'idle'
              this.notifyStatusChange('idle')
            }, estimatedDuration)
          } else {
            // 其他提供商通常有回调机制
            this.currentStatus = 'idle'
            this.notifyStatusChange('idle')
          }
        }
      } else {
        // 纯文本模式，不使用TTS
        console.log('🔊 跳过语音合成（纯文本模式）')
        this.currentStatus = 'idle'
        this.notifyStatusChange('idle')
      }

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
      const messageObj = {
        role,
        message,
        timestamp: new Date().toLocaleTimeString(),
      }
      this.conversationCallbacks.onMessage(messageObj)
    } else {
      console.warn('⚠️ DigitalAssistant: No onMessage callback registered, message lost:', { role, message })
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

    // 只在非纯文本模式下检查WebSocket连接
    if (!this.textOnlyMode && !webSocketService.isConnected()) {
      issues.push('WebSocket连接断开')
      fixes.push('WebSocket需要重新连接')
    }

    // 只在非纯文本模式下检查音频服务状态
    if (!this.textOnlyMode) {
      const audioStatus = audioService.getRecordingStatus()
      if (audioStatus.lastError) {
        issues.push(`音频服务错误: ${audioStatus.lastError}`)
        fixes.push('音频服务需要重新初始化')
      }
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
      timestamp: Date.now(),
      textOnlyMode: this.textOnlyMode, // 添加模式信息
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
      streamingMode: this.streamingMode,
      isStreamingActive: this.isStreamingActive,
      pttMode: this.pttMode,
      autoStopAI: this.autoStopAI,
      isManualRecording: this.isManualRecording,
      audioStatus: audioService.getRecordingStatus(),
      streamingAudioStatus: streamingAudioService.getStreamingStatus(),
      streamingSTTStatus: streamingSTTService.getCurrentTranscription(),
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
      this.streamingMode = false
      this.isStreamingActive = false
      this.isConversing = false
      this.vadState = 'idle'
      this.currentStatus = 'idle'

      // 清理所有定时器，防止内存泄漏
      this.clearAllTimers()

      // 清理各个服务
      await audioService.cleanup()
      await streamingAudioService.cleanup()
      await streamingSTTService.cleanup()
      webSocketService.disconnect()

      if (chatService && typeof chatService.cleanup === 'function') {
        chatService.cleanup()
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
const digitalAssistant = new DigitalAssistant()
export default digitalAssistant
