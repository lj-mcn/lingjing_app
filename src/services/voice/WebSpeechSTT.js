class WebSpeechSTT {
  constructor() {
    this.recognition = null
    this.isSupported = this.checkSupport()
    this.isListening = false
    this.onPartialResult = null
    this.onFinalResult = null
    this.onError = null

    this.config = {
      continuous: true,
      interimResults: true, // 启用部分结果
      lang: 'zh-CN',
      maxAlternatives: 1,
    }
  }

  checkSupport() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    return !!SpeechRecognition
  }

  setCallbacks({ onPartialResult, onFinalResult, onError }) {
    this.onPartialResult = onPartialResult
    this.onFinalResult = onFinalResult
    this.onError = onError
  }

  async startStreaming() {
    try {
      if (!this.isSupported) {
        throw new Error('浏览器不支持Web Speech API')
      }

      if (this.isListening) {
        console.log('已在监听中')
        return { success: true }
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      this.recognition = new SpeechRecognition()

      // 配置识别器
      this.recognition.continuous = this.config.continuous
      this.recognition.interimResults = this.config.interimResults
      this.recognition.lang = this.config.lang
      this.recognition.maxAlternatives = this.config.maxAlternatives

      // 设置事件监听器
      this.setupEventListeners()

      // 开始识别
      this.recognition.start()
      this.isListening = true

      console.log('✅ Web Speech 流式STT已启动')
      return { success: true }
    } catch (error) {
      console.error('❌ Web Speech STT启动失败:', error)
      return { success: false, error: error.message }
    }
  }

  setupEventListeners() {
    this.recognition.onstart = () => {
      console.log('🎤 Web Speech 开始监听')
    }

    this.recognition.onresult = (event) => {
      let interimTranscript = ''
      let finalTranscript = ''

      // 处理识别结果
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const { transcript } = result[0]

        if (result.isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      // 触发部分结果回调
      if (interimTranscript && this.onPartialResult) {
        this.onPartialResult({
          text: interimTranscript.trim(),
          isFinal: false,
          timestamp: Date.now(),
          confidence: 0.8, // Web Speech API 通常不提供置信度
        })
      }

      // 触发最终结果回调
      if (finalTranscript && this.onFinalResult) {
        this.onFinalResult({
          text: finalTranscript.trim(),
          isFinal: true,
          timestamp: Date.now(),
          confidence: 0.9,
        })
      }
    }

    this.recognition.onerror = (event) => {
      console.error('❌ Web Speech 识别错误:', event.error)

      if (this.onError) {
        this.onError(new Error(`语音识别错误: ${event.error}`))
      }

      // 特定错误的处理
      if (event.error === 'no-speech') {
        console.log('未检测到语音，继续监听')
        // 可以选择重启识别
        this.restartRecognition()
      } else if (event.error === 'network') {
        console.error('网络错误，停止识别')
        this.stopStreaming()
      }
    }

    this.recognition.onend = () => {
      console.log('🔇 Web Speech 监听结束')
      this.isListening = false

      // 如果设置为持续模式且没有错误，自动重启
      if (this.config.continuous && !this.shouldStop) {
        setTimeout(() => {
          if (!this.shouldStop) {
            this.restartRecognition()
          }
        }, 100)
      }
    }
  }

  async restartRecognition() {
    try {
      if (this.recognition && !this.shouldStop) {
        this.recognition.start()
        this.isListening = true
      }
    } catch (error) {
      console.log('重启识别失败:', error.message)
      // 等待一段时间后重试
      setTimeout(() => {
        this.restartRecognition()
      }, 1000)
    }
  }

  async stopStreaming() {
    try {
      this.shouldStop = true
      this.isListening = false

      if (this.recognition) {
        this.recognition.stop()
        this.recognition = null
      }

      console.log('✅ Web Speech STT已停止')
      return { success: true }
    } catch (error) {
      console.error('❌ Web Speech STT停止失败:', error)
      return { success: false, error: error.message }
    }
  }

  isAvailable() {
    return this.isSupported
  }

  getCurrentStatus() {
    return {
      isSupported: this.isSupported,
      isListening: this.isListening,
      provider: 'web_speech',
    }
  }

  // 设置语言
  setLanguage(lang) {
    this.config.lang = lang
    if (this.recognition) {
      this.recognition.lang = lang
    }
  }

  // 设置持续模式
  setContinuous(continuous) {
    this.config.continuous = continuous
    if (this.recognition) {
      this.recognition.continuous = continuous
    }
  }
}

// 创建单例
const webSpeechSTT = new WebSpeechSTT()
export default webSpeechSTT
