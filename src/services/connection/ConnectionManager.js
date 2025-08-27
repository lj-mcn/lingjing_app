import { Audio } from 'expo-av'

class ConnectionManager {
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
    this.isManuallyDisconnected = true // 禁用状态
    this.reconnectTimer = null
  }

  connect(url = 'ws://localhost:3000/ws') {
    // 禁用 WebSocket 连接
    console.log('⚠️ WebSocket 连接已禁用，使用 SiliconFlow API 模式')
    this.isManuallyDisconnected = true
    return false
  }

  handleReconnect(url = 'ws://localhost:3000/ws') {
    // 禁用重连
    console.log('⚠️ WebSocket 重连已禁用')
    this.reconnectAttempts = 0
    this.isManuallyDisconnected = true
  }

  send(message) {
    // 禁用发送
    return false
  }

  getReadyStateText() {
    return '已禁用'
  }

  sendAudio(audioData, type = 'audio') {
    return false
  }

  disconnect() {
    this.isManuallyDisconnected = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = 0
    this.isConnecting = false
  }

  resetConnection() {
    this.isManuallyDisconnected = true
    this.reconnectAttempts = 0
    this.isConnecting = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  isConnected() {
    return false
  }

  setOnMessage(callback) {
    this.onMessageCallback = callback
  }

  setOnConnect(callback) {
    this.onConnectCallback = callback
  }

  setOnDisconnect(callback) {
    this.onDisconnectCallback = callback
  }

  setOnError(callback) {
    this.onErrorCallback = callback
  }

  getConnectionStatus() {
    return {
      connected: false,
      readyState: '已禁用',
      url: null,
      reconnectAttempts: this.reconnectAttempts,
      isManuallyDisconnected: this.isManuallyDisconnected,
    }
  }
}

const connectionManager = new ConnectionManager()
export default connectionManager
