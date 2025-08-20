import appConfig from '../../config/AppConfig'

class VoiceManager {
  constructor() {
    this.websocket = null
    this.isConnected = false
    this.config = appConfig.sttTts.voice_service
    this.requestId = 0
    this.pendingRequests = new Map()
    
    // 连接状态回调
    this.onConnect = null
    this.onDisconnect = null
    this.onError = null
  }

  async initialize() {
    try {
      console.log('🎵 初始化语音服务...')
      await this.connect()
      console.log('✅ 语音服务初始化成功')
      return true
    } catch (error) {
      console.error('❌ 语音服务初始化失败:', error)
      return false
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.config.websocket_url
      console.log(`🔌 连接语音服务: ${wsUrl}`)
      
      try {
        this.websocket = new WebSocket(wsUrl)
        
        this.websocket.onopen = () => {
          this.isConnected = true
          console.log('✅ 语音服务连接成功')
          if (this.onConnect) this.onConnect()
          resolve()
        }
        
        this.websocket.onmessage = (event) => {
          this.handleMessage(event.data)
        }
        
        this.websocket.onclose = () => {
          this.isConnected = false
          console.log('🔌 语音服务连接关闭')
          if (this.onDisconnect) this.onDisconnect()
          this.handleReconnect()
        }
        
        this.websocket.onerror = (error) => {
          console.error('❌ 语音服务连接错误:', error)
          if (this.onError) this.onError(error)
          reject(error)
        }
        
        // 连接超时
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('语音服务连接超时'))
          }
        }, this.config.timeout)
        
      } catch (error) {
        reject(error)
      }
    })
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data)
      
      if (message.type === 'welcome') {
        console.log('🎵 语音服务欢迎消息:', message.message)
        return
      }
      
      if (message.type === 'pong') {
        return
      }
      
      // 处理请求响应
      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const { resolve, reject, timeoutId } = this.pendingRequests.get(message.requestId)
        clearTimeout(timeoutId)
        this.pendingRequests.delete(message.requestId)
        
        if (message.success) {
          resolve(message)
        } else {
          reject(new Error(message.error || '语音服务处理失败'))
        }
      }
      
    } catch (error) {
      console.error('语音服务消息处理错误:', error)
    }
  }

  async handleReconnect() {
    if (!this.config.reconnectAttempts) return
    
    console.log('🔄 尝试重新连接语音服务...')
    
    for (let i = 0; i < this.config.reconnectAttempts; i++) {
      try {
        await new Promise(resolve => setTimeout(resolve, this.config.reconnectDelay))
        await this.connect()
        console.log('✅ 语音服务重连成功')
        return
      } catch (error) {
        console.warn(`重连尝试 ${i + 1}/${this.config.reconnectAttempts} 失败:`, error.message)
      }
    }
    
    console.error('❌ 语音服务重连失败')
  }

  async tryFallbackServers() {
    console.error('❌ 语音服务器连接失败，无备用服务器')
  }

  send(data) {
    if (!this.isConnected || !this.websocket) {
      throw new Error('语音服务未连接')
    }
    
    this.websocket.send(JSON.stringify(data))
    return true
  }

  /**
   * 文本转语音 - 使用Kokoro TTS
   */
  async textToSpeech(text, options = {}) {
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId
      
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('TTS请求超时'))
      }, this.config.timeout)
      
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeoutId
      })
      
      const requestData = {
        type: 'tts_request',
        requestId,
        data: {
          text,
          voice_style: options.voice_style || this.config.tts.voice_style,
          format: options.format || this.config.tts.format,
        },
        timestamp: Date.now()
      }
      
      try {
        this.send(requestData)
        console.log(`📢 发送TTS请求: ${text.substring(0, 30)}...`)
      } catch (error) {
        clearTimeout(timeoutId)
        this.pendingRequests.delete(requestId)
        reject(error)
      }
    })
  }

  /**
   * 语音转文本 - 使用SenseVoice
   */
  async speechToText(audioData, options = {}) {
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId
      
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('STT请求超时'))
      }, this.config.timeout)
      
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeoutId
      })
      
      const requestData = {
        type: 'stt_request',
        requestId,
        data: {
          audio_data: audioData, // base64编码的音频数据
          language: options.language || this.config.stt.language,
          enable_itn: options.enable_itn !== undefined ? options.enable_itn : this.config.stt.enable_itn,
        },
        timestamp: Date.now()
      }
      
      try {
        this.send(requestData)
        console.log('🎤 发送STT请求...')
      } catch (error) {
        clearTimeout(timeoutId)
        this.pendingRequests.delete(requestId)
        reject(error)
      }
    })
  }

  /**
   * 检查服务连接状态
   */
  isServiceReady() {
    return this.isConnected
  }

  /**
   * 获取服务状态
   */
  getServiceStatus() {
    return {
      connected: this.isConnected,
      url: this.config.websocket_url,
      pendingRequests: this.pendingRequests.size,
      models: {
        tts: this.config.tts.model,
        stt: this.config.stt.model
      }
    }
  }

  /**
   * 发送心跳检测
   */
  async ping() {
    if (!this.isConnected) {
      throw new Error('语音服务未连接')
    }
    
    const pingData = {
      type: 'ping',
      timestamp: Date.now()
    }
    
    this.send(pingData)
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 清理待处理请求
    for (const [requestId, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeoutId)
      request.reject(new Error('语音服务已停止'))
    }
    this.pendingRequests.clear()
    
    // 关闭WebSocket连接
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
    }
    
    this.isConnected = false
    console.log('🧹 语音服务已清理')
  }
}

// 创建单例实例
const voiceManager = new VoiceManager()
export default voiceManager