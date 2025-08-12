import webSocketService from './WebSocketService'
import audioService from './AudioService'
import responseLLMService from './ResponseLLMService'
import sttTtsService from './STTTTSService'
import llmConfig from '../config/llmConfig'

class DigitalHumanService {
  constructor() {
    this.isConnected = false
    this.isConversing = false
    this.conversationCallbacks = {
      onStart: null,
      onEnd: null,
      onMessage: null,
      onError: null,
      onStatusChange: null,
    }

    this.setupWebSocketCallbacks()
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

  async initialize(config = {}) {
    try {
      console.log('开始初始化数字人服务...')

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
      if (this.isConversing) {
        console.log('对话已在进行中')
        this.notifyError('对话已在进行中，请稍候')
        return { success: false, error: '对话已在进行中' }
      }

      this.isConversing = true
      this.notifyStatusChange('recording')
      this.notifyConversationStart()

      // 开始录音
      const recordingResult = await audioService.startRecording()
      if (!recordingResult.success) {
        throw new Error(recordingResult.error || '录音启动失败')
      }

      console.log(`✅ 语音对话已开始 (${recordingResult.mode}模式)`)
      if (recordingResult.mode === 'simulation') {
        this.notifyMessage('system', '使用模拟录音模式，点击停止来模拟语音输入')
      }

      return { success: true, mode: recordingResult.mode, message: recordingResult.message }
    } catch (error) {
      console.error('开始语音对话失败:', error)
      this.isConversing = false
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

      this.notifyStatusChange('processing')

      // 停止录音并获取音频文件
      const audioUri = await audioService.stopRecording()
      if (!audioUri) {
        throw new Error('录音失败')
      }

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
        this.notifyStatusChange('speaking')

        // 根据不同的TTS提供商处理播放
        if (ttsResult.provider === 'expo') {
          // Expo Speech直接播放，无需通过AudioService
          console.log('📱 Expo Speech已直接播放语音')
          // Expo Speech没有播放完成回调，使用估算时间
          const estimatedDuration = this.estimateSpeechDuration(llmResult.message)
          setTimeout(() => {
            this.notifyStatusChange('idle')
          }, estimatedDuration)
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
        this.notifyStatusChange('idle')
      }

      return true
    } catch (error) {
      console.error('语音对话处理失败:', error)
      this.isConversing = false
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
        this.notifyStatusChange('speaking')
      }

      this.notifyStatusChange('idle')
      return {
        success: true,
        message: llmResult.message,
      }
    } catch (error) {
      console.error('文本消息处理失败:', error)
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
    if (this.conversationCallbacks.onError) {
      this.conversationCallbacks.onError(error)
    }
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

  // 获取状态
  getStatus() {
    return {
      isConnected: this.isConnected,
      isConversing: this.isConversing,
      audioStatus: audioService.getRecordingStatus(),
      wsConnected: webSocketService.isConnected(),
    }
  }

  // 清理资源
  async cleanup() {
    try {
      this.isConversing = false
      await audioService.cleanup()
      webSocketService.disconnect()
      responseLLMService.cleanup()
      console.log('数字人服务清理完成')
    } catch (error) {
      console.error('数字人服务清理失败:', error)
    }
  }
}

// 创建单例实例
const digitalHumanService = new DigitalHumanService()
export default digitalHumanService
