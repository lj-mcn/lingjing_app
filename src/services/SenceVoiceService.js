import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system'
import audioService from './AudioService'

/**
 * SenceVoice WebSocket客户端服务
 * 支持语音识别、声纹识别、关键词唤醒和语音合成功能
 */
class SenceVoiceService {
  constructor() {
    this.ws = null
    this.isConnected = false
    this.isConnecting = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 3
    this.reconnectDelay = 1000
    this.requestId = 0
    this.pendingRequests = new Map()
    
    // 服务器状态
    this.serverStatus = {
      kws_enabled: false,
      kws_activated: false,
      sv_enabled: false,
      sv_enrolled: false,
      kws_keyword: '',
      sv_threshold: 0.35
    }
    
    // 回调函数
    this.callbacks = {
      onConnect: null,
      onDisconnect: null,
      onError: null,
      onStatusUpdate: null,
      onVoiceResponse: null,
      onEnrollmentResponse: null
    }
    
    console.log('SenceVoiceService initialized')
  }
  
  /**
   * 连接到SenceVoice WebSocket服务器
   */
  async connect(url = 'ws://localhost:8000') {
    if (this.isConnecting || this.isConnected) {
      console.log('SenceVoice服务已连接或正在连接中')
      return true
    }
    
    try {
      this.isConnecting = true
      console.log(`正在连接SenceVoice服务器: ${url}`)
      
      this.ws = new WebSocket(url)
      
      this.ws.onopen = () => {
        console.log('✅ SenceVoice WebSocket连接成功')
        this.isConnected = true
        this.isConnecting = false
        this.reconnectAttempts = 0
        
        // 获取服务器状态
        this.requestStatus()
        
        if (this.callbacks.onConnect) {
          this.callbacks.onConnect()
        }
      }
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleMessage(data)
        } catch (error) {
          console.error('解析SenceVoice消息失败:', error)
        }
      }
      
      this.ws.onerror = (error) => {
        console.error('❌ SenceVoice WebSocket错误:', error)
        if (this.callbacks.onError) {
          this.callbacks.onError(error)
        }
      }
      
      this.ws.onclose = (event) => {
        console.log(`⚠️ SenceVoice连接已关闭: ${event.code} - ${event.reason}`)
        this.isConnected = false
        this.isConnecting = false
        
        if (this.callbacks.onDisconnect) {
          this.callbacks.onDisconnect(event)
        }
        
        // 自动重连（除非是正常关闭）
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.handleReconnect(url)
        }
      }
      
      return true
    } catch (error) {
      console.error('SenceVoice连接失败:', error)
      this.isConnecting = false
      if (this.callbacks.onError) {
        this.callbacks.onError(error)
      }
      return false
    }
  }
  
  /**
   * 处理重连逻辑
   */
  handleReconnect(url) {
    this.reconnectAttempts++
    const delay = this.reconnectDelay * this.reconnectAttempts
    
    console.log(`🔄 SenceVoice重连尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts}，${delay}ms后重试`)
    
    setTimeout(() => {
      this.connect(url)
    }, delay)
  }
  
  /**
   * 断开连接
   */
  disconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, '手动断开')
    }
    this.isConnected = false
    this.isConnecting = false
    this.reconnectAttempts = 0
    this.pendingRequests.clear()
  }
  
  /**
   * 处理收到的消息
   */
  handleMessage(data) {
    console.log('📨 收到SenceVoice消息:', data.type, data.requestId)
    
    const { type, requestId } = data
    
    // 处理有requestId的响应
    if (requestId && this.pendingRequests.has(requestId)) {
      const { resolve, reject } = this.pendingRequests.get(requestId)
      this.pendingRequests.delete(requestId)
      
      if (data.success !== false) {
        resolve(data)
      } else {
        reject(new Error(data.error || '请求失败'))
      }
      return
    }
    
    // 处理特殊消息类型
    switch (type) {
      case 'status_response':
        this.updateServerStatus(data.data)
        break
        
      case 'voice_response':
        this.handleVoiceResponse(data)
        break
        
      case 'sv_enroll_response':
        this.handleEnrollmentResponse(data)
        break
        
      case 'pong':
        // 心跳响应，无需处理
        break
        
      case 'error':
        console.error('服务器错误:', data.error)
        if (this.callbacks.onError) {
          this.callbacks.onError(new Error(data.error))
        }
        break
        
      default:
        console.log('未处理的消息类型:', type)
    }
  }
  
  /**
   * 更新服务器状态
   */
  updateServerStatus(statusData) {
    this.serverStatus = { ...this.serverStatus, ...statusData }
    console.log('📊 服务器状态更新:', this.serverStatus)
    
    if (this.callbacks.onStatusUpdate) {
      this.callbacks.onStatusUpdate(this.serverStatus)
    }
  }
  
  /**
   * 处理语音响应
   */
  handleVoiceResponse(data) {
    console.log('🎤 语音响应:', data.data)
    
    if (this.callbacks.onVoiceResponse) {
      this.callbacks.onVoiceResponse(data.data)
    }
    
    // 自动播放TTS音频（如果有）
    if (data.data.audio_response) {
      this.playTTSAudio(data.data.audio_response)
    }
  }
  
  /**
   * 处理声纹注册响应
   */
  handleEnrollmentResponse(data) {
    console.log('🔐 声纹注册响应:', data.data)
    
    if (data.success) {
      this.serverStatus.sv_enrolled = true
    }
    
    if (this.callbacks.onEnrollmentResponse) {
      this.callbacks.onEnrollmentResponse(data.data)
    }
    
    // 自动播放确认音频（如果有）
    if (data.data.audio_response) {
      this.playTTSAudio(data.data.audio_response)
    }
  }
  
  /**
   * 发送消息到服务器
   */
  sendMessage(message) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('SenceVoice服务未连接')
    }
    
    const messageStr = JSON.stringify(message)
    this.ws.send(messageStr)
    console.log('📤 发送SenceVoice消息:', message.type, message.requestId)
  }
  
  /**
   * 生成唯一请求ID
   */
  generateRequestId(type) {
    this.requestId++
    return `${type}_req_${this.requestId}_${Date.now()}`
  }
  
  /**
   * 发送语音识别和对话请求
   */
  async sendVoiceRequest(audioUri, options = {}) {
    try {
      // 读取音频文件
      const audioData = await this.prepareAudioData(audioUri)
      const requestId = this.generateRequestId('voice')
      
      const message = {
        type: 'voice_request',
        requestId: requestId,
        timestamp: Date.now(),
        data: {
          audio_data: audioData,
          audio_format: options.format || 'wav',
          sample_rate: options.sampleRate || 16000,
          channels: options.channels || 1,
          bit_depth: options.bitDepth || 16
        }
      }
      
      return new Promise((resolve, reject) => {
        this.pendingRequests.set(requestId, { resolve, reject })
        
        // 设置超时
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId)
            reject(new Error('语音请求超时'))
          }
        }, 30000) // 30秒超时
        
        this.sendMessage(message)
      })
    } catch (error) {
      console.error('发送语音请求失败:', error)
      throw error
    }
  }
  
  /**
   * 发送声纹注册请求
   */
  async sendEnrollmentRequest(audioUri, options = {}) {
    try {
      // 读取音频文件
      const audioData = await this.prepareAudioData(audioUri)
      const requestId = this.generateRequestId('sv_enroll')
      
      const message = {
        type: 'sv_enroll_request',
        requestId: requestId,
        timestamp: Date.now(),
        data: {
          audio_data: audioData,
          audio_format: options.format || 'wav',
          sample_rate: options.sampleRate || 16000,
          channels: options.channels || 1,
          bit_depth: options.bitDepth || 16
        }
      }
      
      return new Promise((resolve, reject) => {
        this.pendingRequests.set(requestId, { resolve, reject })
        
        // 设置超时
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId)
            reject(new Error('声纹注册请求超时'))
          }
        }, 30000) // 30秒超时
        
        this.sendMessage(message)
      })
    } catch (error) {
      console.error('发送声纹注册请求失败:', error)
      throw error
    }
  }
  
  /**
   * 查询服务器状态
   */
  async requestStatus() {
    try {
      const requestId = this.generateRequestId('status')
      
      const message = {
        type: 'status_request',
        requestId: requestId,
        timestamp: Date.now()
      }
      
      return new Promise((resolve, reject) => {
        this.pendingRequests.set(requestId, { resolve, reject })
        
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId)
            reject(new Error('状态查询超时'))
          }
        }, 10000) // 10秒超时
        
        this.sendMessage(message)
      })
    } catch (error) {
      console.error('查询服务器状态失败:', error)
      throw error
    }
  }
  
  /**
   * 重置关键词状态
   */
  async resetKeywordStatus() {
    try {
      const requestId = this.generateRequestId('reset_kws')
      
      const message = {
        type: 'reset_kws',
        requestId: requestId,
        timestamp: Date.now()
      }
      
      return new Promise((resolve, reject) => {
        this.pendingRequests.set(requestId, { resolve, reject })
        
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId)
            reject(new Error('重置关键词状态超时'))
          }
        }, 10000) // 10秒超时
        
        this.sendMessage(message)
      })
    } catch (error) {
      console.error('重置关键词状态失败:', error)
      throw error
    }
  }
  
  /**
   * 发送心跳
   */
  sendPing() {
    try {
      const message = {
        type: 'ping',
        timestamp: Date.now()
      }
      
      this.sendMessage(message)
    } catch (error) {
      console.error('发送心跳失败:', error)
    }
  }
  
  /**
   * 准备音频数据（转换为base64）
   */
  async prepareAudioData(audioUri) {
    try {
      console.log('准备音频数据:', audioUri)
      
      // 读取音频文件
      const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64
      })
      
      console.log(`音频数据大小: ${base64Audio.length} 字符`)
      return base64Audio
    } catch (error) {
      console.error('准备音频数据失败:', error)
      throw new Error(`音频文件读取失败: ${error.message}`)
    }
  }
  
  /**
   * 播放TTS音频
   */
  async playTTSAudio(base64Audio) {
    try {
      console.log('播放TTS音频...')
      
      // 将base64音频数据写入临时文件
      const tempUri = FileSystem.documentDirectory + `tts_temp_${Date.now()}.mp3`
      await FileSystem.writeAsStringAsync(tempUri, base64Audio, {
        encoding: FileSystem.EncodingType.Base64
      })
      
      // 使用AudioService播放
      await audioService.playAudioFromUri(tempUri)
      
      // 播放完成后清理临时文件
      setTimeout(async () => {
        try {
          await FileSystem.deleteAsync(tempUri)
        } catch (e) {
          console.warn('清理临时TTS文件失败:', e)
        }
      }, 5000)
      
    } catch (error) {
      console.error('播放TTS音频失败:', error)
    }
  }
  
  /**
   * 设置回调函数
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }
  
  /**
   * 获取连接状态
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts
    }
  }
  
  /**
   * 获取服务器状态
   */
  getServerStatus() {
    return { ...this.serverStatus }
  }
  
  /**
   * 检查是否需要声纹注册
   */
  isEnrollmentRequired() {
    return this.serverStatus.sv_enabled && !this.serverStatus.sv_enrolled
  }
  
  /**
   * 检查是否需要关键词激活
   */
  isKeywordActivationRequired() {
    return this.serverStatus.kws_enabled && !this.serverStatus.kws_activated
  }
  
  /**
   * 获取唤醒词
   */
  getWakeupKeyword() {
    return this.serverStatus.kws_keyword
  }
  
  /**
   * 清理资源
   */
  cleanup() {
    this.disconnect()
    this.pendingRequests.clear()
    console.log('SenceVoice服务已清理')
  }
}

// 创建单例实例
const senceVoiceService = new SenceVoiceService()
export default senceVoiceService