import { Audio } from 'expo-av'

class WebSocketService {
  constructor() {
    this.ws = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 3
    this.reconnectDelay = 1000
    this.onMessageCallback = null
    this.onErrorCallback = null
    this.onConnectCallback = null
    this.onDisconnectCallback = null
    this.isConnecting = false
    this.isManuallyDisconnected = false
    this.reconnectTimer = null
  }

  connect(url = 'ws://localhost:3000/ws') {
    try {
      // 防止重复连接
      if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
        console.log('WebSocket已在连接中或已连接，跳过')
        return true
      }

      console.log(`尝试连接WebSocket: ${url}`)
      this.isConnecting = true
      this.isManuallyDisconnected = false

      // 清除之前的重连定时器
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }

      // 如果已有连接，先关闭
      if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
        this.ws.close()
      }

      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        console.log('✅ WebSocket连接已建立')
        console.log('连接详情:', {
          url: this.ws.url,
          readyState: this.ws.readyState,
          protocol: this.ws.protocol,
        })
        // 连接成功后等待一段时间再重置重连次数，防止立即断开的情况
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.reconnectAttempts = 0
          }
        }, 5000) // 5秒后如果连接仍然稳定才重置

        this.isConnecting = false

        // 发送连接测试消息
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.send({
                type: 'ping',
                timestamp: Date.now(),
              })
              console.log('📡 发送连接测试消息')
            } catch (error) {
              console.warn('发送测试消息失败:', error)
            }
          }
        }, 2000) // 延迟到2秒，给服务器更多初始化时间

        if (this.onConnectCallback) {
          try {
            this.onConnectCallback()
          } catch (callbackError) {
            console.error('WebSocket连接回调错误:', callbackError)
          }
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('📨 收到WebSocket消息:', data)
          if (this.onMessageCallback) {
            this.onMessageCallback(data)
          }
        } catch (error) {
          console.error('❌ 解析WebSocket消息失败:', error)
          console.error('原始消息:', event.data)
        }
      }

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket错误:', error)
        console.error('错误详情:', {
          message: error.message,
          type: error.type,
          target: error.target ? {
            readyState: error.target.readyState,
            url: error.target.url,
          } : null,
        })
        if (this.onErrorCallback) {
          try {
            this.onErrorCallback(error)
          } catch (callbackError) {
            console.error('WebSocket错误回调异常:', callbackError)
          }
        }
      }

      this.ws.onclose = (event) => {
        const errorMessages = {
          0: '连接未建立或网络中断',
          1000: '正常关闭',
          1001: '终端离开',
          1002: '协议错误',
          1003: '不支持的数据类型',
          1006: '连接异常关闭',
          1011: '服务器内部错误',
          1012: '服务重启',
          1013: '服务过载',
        }

        const errorDesc = errorMessages[event.code] || '未知错误'
        console.log(`⚠️ WebSocket连接已关闭: 代码=${event.code} (${errorDesc}), 原因=${event.reason || '未知'}`)

        if (this.onDisconnectCallback) {
          try {
            this.onDisconnectCallback(event)
          } catch (callbackError) {
            console.error('WebSocket断开回调错误:', callbackError)
          }
        }

        this.isConnecting = false

        // 只有在非手动断开且非正常关闭时才尝试重连
        if (!this.isManuallyDisconnected && event.code !== 1000) {
          this.handleReconnect(url)
        } else if (event.code === 1000) {
          // 正常关闭，重置重连次数
          this.reconnectAttempts = 0
        }
      }

      return true
    } catch (error) {
      console.error('❌ WebSocket连接初始化失败:', error)
      if (this.onErrorCallback) {
        try {
          this.onErrorCallback(error)
        } catch (callbackError) {
          console.error('WebSocket错误回调异常:', callbackError)
        }
      }
      return false
    }
  }

  handleReconnect(url = 'ws://localhost:3000/ws') {
    // 如果已经在连接中或手动断开，则不重连
    if (this.isConnecting || this.isManuallyDisconnected) {
      return
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`🔄 尝试重连 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)

      this.reconnectTimer = setTimeout(() => {
        if (!this.isManuallyDisconnected) {
          console.log(`🔄 执行第${this.reconnectAttempts}次重连...`)
          this.connect(url)
        }
      }, this.reconnectDelay * this.reconnectAttempts)
    } else {
      console.error('❌ WebSocket重连失败，已达到最大重连次数')
      this.reconnectAttempts = 0 // 重置重连次数，为下次手动连接做准备
    }
  }

  send(message) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const jsonMessage = JSON.stringify(message)
        this.ws.send(jsonMessage)
        console.log('📤 WebSocket消息已发送:', message)
        return true
      }
      const state = this.ws ? this.getReadyStateText() : '未创建'
      console.error(`❌ WebSocket未连接，无法发送消息 (状态: ${state})`)
      return false
    } catch (error) {
      console.error('❌ WebSocket发送消息失败:', error)
      return false
    }
  }

  getReadyStateText() {
    if (!this.ws) return '未创建'
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return '连接中'
      case WebSocket.OPEN: return '已连接'
      case WebSocket.CLOSING: return '关闭中'
      case WebSocket.CLOSED: return '已关闭'
      default: return '未知状态'
    }
  }

  sendAudio(audioData, type = 'audio') {
    const message = {
      type,
      data: audioData,
      timestamp: Date.now(),
    }
    return this.send(message)
  }

  disconnect() {
    console.log('🔌 手动断开WebSocket连接')
    this.isManuallyDisconnected = true

    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // 关闭连接
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.close(1000, '手动断开')
    }

    // 重置状态
    this.reconnectAttempts = 0
    this.isConnecting = false
  }

  // 重置连接状态，允许重新连接
  resetConnection() {
    this.isManuallyDisconnected = false
    this.reconnectAttempts = 0
    this.isConnecting = false

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  sendText(text, type = 'text') {
    const message = {
      type,
      data: text,
      timestamp: Date.now(),
    }
    return this.send(message)
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN
  }

  // 设置回调函数
  setOnMessage(callback) {
    this.onMessageCallback = callback
  }

  setOnError(callback) {
    this.onErrorCallback = callback
  }

  setOnConnect(callback) {
    this.onConnectCallback = callback
  }

  setOnDisconnect(callback) {
    this.onDisconnectCallback = callback
  }
}

// 创建单例实例
const webSocketService = new WebSocketService()
export default webSocketService
