class SenceVoiceService {
  constructor() {
    this.ws = null
    this.isConnected = false
    this.connectionStatus = {
      isConnected: false,
      url: null,
      lastError: null,
    }
    this.serverStatus = {
      kws_enabled: false,
      kws_activated: false,
      kws_keyword: '小智',
      sv_enabled: false,
      sv_enrolled: false,
    }
    this.callbacks = {
      onConnect: null,
      onDisconnect: null,
      onError: null,
      onStatusUpdate: null,
      onVoiceResponse: null,
      onEnrollmentResponse: null,
    }
    this.requestId = 0
    this.pendingRequests = new Map()
  }

  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks }
    console.log('🔧 SenceVoice回调已设置')
  }

  async connect(url) {
    try {
      console.log(`🔌 连接SenceVoice服务: ${url}`)

      if (this.isConnected && this.ws) {
        console.log('SenceVoice已连接，先断开现有连接')
        this.disconnect()
      }

      return new Promise((resolve, reject) => {
        try {
          this.ws = new WebSocket(url)
          this.connectionStatus.url = url

          const connectTimeout = setTimeout(() => {
            reject(new Error('SenceVoice连接超时'))
          }, 10000)

          this.ws.onopen = () => {
            clearTimeout(connectTimeout)
            this.isConnected = true
            this.connectionStatus.isConnected = true
            this.connectionStatus.lastError = null

            console.log('✅ SenceVoice连接成功')

            if (this.callbacks.onConnect) {
              this.callbacks.onConnect()
            }

            // 发送初始化请求获取服务状态
            this.sendStatusRequest()

            resolve(true)
          }

          this.ws.onmessage = (event) => {
            this.handleMessage(event.data)
          }

          this.ws.onclose = (event) => {
            this.isConnected = false
            this.connectionStatus.isConnected = false

            console.log(`⚠️ SenceVoice连接关闭: ${event.code} - ${event.reason}`)

            if (this.callbacks.onDisconnect) {
              this.callbacks.onDisconnect(event)
            }
          }

          this.ws.onerror = (error) => {
            clearTimeout(connectTimeout)
            this.connectionStatus.lastError = error.message || 'WebSocket错误'

            console.error('❌ SenceVoice连接错误:', error)

            if (this.callbacks.onError) {
              this.callbacks.onError(error)
            }

            reject(error)
          }
        } catch (error) {
          reject(error)
        }
      })
    } catch (error) {
      console.error('❌ SenceVoice连接失败:', error)
      this.connectionStatus.lastError = error.message
      throw error
    }
  }

  disconnect() {
    if (this.ws) {
      console.log('🔌 断开SenceVoice连接')
      this.ws.close(1000, '主动断开')
      this.ws = null
    }
    this.isConnected = false
    this.connectionStatus.isConnected = false
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data)
      console.log('📨 收到SenceVoice消息:', message.type)

      switch (message.type) {
        case 'status_update':
          this.handleStatusUpdate(message.data)
          break
        case 'voice_response':
          this.handleVoiceResponse(message)
          break
        case 'enrollment_response':
          this.handleEnrollmentResponse(message)
          break
        case 'error':
          console.error('SenceVoice服务错误:', message.error)
          if (this.callbacks.onError) {
            this.callbacks.onError(new Error(message.error))
          }
          break
        default:
          console.log('未知消息类型:', message.type)
      }
    } catch (error) {
      console.error('❌ SenceVoice消息解析失败:', error)
    }
  }

  handleStatusUpdate(data) {
    this.serverStatus = { ...this.serverStatus, ...data }
    console.log('📊 SenceVoice状态更新:', this.serverStatus)

    if (this.callbacks.onStatusUpdate) {
      this.callbacks.onStatusUpdate(this.serverStatus)
    }
  }

  handleVoiceResponse(message) {
    console.log('🎤 语音响应:', message)

    if (this.callbacks.onVoiceResponse) {
      this.callbacks.onVoiceResponse(message)
    }
  }

  handleEnrollmentResponse(message) {
    console.log('👤 声纹注册响应:', message)

    if (message.success) {
      this.serverStatus.sv_enrolled = true
    }

    if (this.callbacks.onEnrollmentResponse) {
      this.callbacks.onEnrollmentResponse(message)
    }
  }

  sendStatusRequest() {
    const message = {
      type: 'status_request',
      timestamp: Date.now(),
    }
    this.sendMessage(message)
  }

  async sendVoiceRequest(audioUri) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('SenceVoice服务未连接'))
        return
      }

      const requestId = ++this.requestId
      const message = {
        type: 'voice_request',
        requestId,
        data: {
          audio_uri: audioUri,
          enable_kws: this.serverStatus.kws_enabled,
          enable_sv: this.serverStatus.sv_enabled,
        },
        timestamp: Date.now(),
      }

      // 设置请求超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('语音请求超时'))
      }, 30000)

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout,
      })

      console.log('🎤 发送语音请求到SenceVoice')
      this.sendMessage(message)
    })
  }

  async sendEnrollmentRequest(audioUri) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('SenceVoice服务未连接'))
        return
      }

      const requestId = ++this.requestId
      const message = {
        type: 'enrollment_request',
        requestId,
        data: {
          audio_uri: audioUri,
        },
        timestamp: Date.now(),
      }

      // 设置请求超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('声纹注册请求超时'))
      }, 30000)

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout,
      })

      console.log('👤 发送声纹注册请求')
      this.sendMessage(message)
    })
  }

  sendMessage(message) {
    if (this.ws && this.isConnected) {
      try {
        this.ws.send(JSON.stringify(message))
        return true
      } catch (error) {
        console.error('❌ 发送消息失败:', error)
        return false
      }
    }
    console.error('❌ SenceVoice未连接，无法发送消息')
    return false
  }

  // 检查是否需要声纹注册
  isEnrollmentRequired() {
    return this.serverStatus.sv_enabled && !this.serverStatus.sv_enrolled
  }

  // 检查是否需要关键词激活
  isKeywordActivationRequired() {
    return this.serverStatus.kws_enabled && !this.serverStatus.kws_activated
  }

  // 获取唤醒关键词
  getWakeupKeyword() {
    return this.serverStatus.kws_keyword || '小智'
  }

  // 获取连接状态
  getConnectionStatus() {
    return {
      ...this.connectionStatus,
      isConnected: this.isConnected,
    }
  }

  // 获取服务器状态
  getServerStatus() {
    return { ...this.serverStatus }
  }

  // 重置关键词状态
  async resetKeywordStatus() {
    const message = {
      type: 'reset_keyword',
      timestamp: Date.now(),
    }

    console.log('🔄 重置关键词状态')
    return this.sendMessage(message)
  }

  // 清理资源
  cleanup() {
    try {
      console.log('🧹 清理SenceVoice服务...')

      // 清理待处理请求
      for (const [requestId, request] of this.pendingRequests.entries()) {
        clearTimeout(request.timeout)
        request.reject(new Error('服务已停止'))
      }
      this.pendingRequests.clear()

      // 断开连接
      this.disconnect()

      // 重置状态
      this.serverStatus = {
        kws_enabled: false,
        kws_activated: false,
        kws_keyword: '小智',
        sv_enabled: false,
        sv_enrolled: false,
      }

      console.log('✅ SenceVoice服务清理完成')
    } catch (error) {
      console.error('❌ SenceVoice服务清理失败:', error)
    }
  }
}

// 创建单例实例
const senceVoiceService = new SenceVoiceService()
export default senceVoiceService
