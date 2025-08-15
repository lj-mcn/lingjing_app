import audioService from './AudioService'

/**
 * WebRTC风格的语音活动检测服务
 * 模仿111.py中webrtcvad的实现，提供精确的VAD检测和自由打断功能
 */
class WebRTCVADService {
  constructor() {
    this.isInitialized = false
    this.isListening = false
    this.isInterruptionEnabled = false
    this.isPlaying = false // 追踪AI是否在播放音频
    
    // VAD配置 - 模仿111.py的配置
    this.config = {
      sampleRate: 16000,        // 音频采样率
      frameSize: 320,           // 20ms at 16kHz (对应111.py的20ms块)
      vadMode: 3,               // VAD敏感度 (0-3, 模仿webrtcvad)
      silenceThreshold: 1000,   // 无效语音阈值1秒 (对应111.py的NO_SPEECH_THRESHOLD)
      detectionInterval: 100,   // 检测间隔100ms
      voiceDetectionRate: 0.5,  // 语音检测比率 (对应111.py的rate=0.5)
      minimumSpeechDuration: 300, // 最小语音持续时间
    }
    
    // 音频处理相关
    this.audioContext = null
    this.analyser = null
    this.mediaStream = null
    this.audioBuffer = []
    this.processor = null
    
    // VAD状态管理
    this.isVoiceActive = false
    this.voiceStartTime = null
    this.lastVoiceActivity = Date.now()
    this.silenceStartTime = null
    this.vadInterval = null
    this.audioSegments = [] // 存储音频段用于VAD检测
    
    // 回调函数
    this.callbacks = {
      onVoiceDetected: null,
      onVoiceEnded: null,
      onSilenceDetected: null,
      onInterruptionTriggered: null,
      onStatusChange: null,
    }
    
    console.log('WebRTCVAD服务初始化完成')
  }

  // 初始化WebRTC VAD服务
  async initialize() {
    try {
      // 检查iOS/React Native环境
      const isiOS = this.isIOSEnvironment()
      const isReactNative = this.isRunningInReactNative()
      
      if (isiOS || isReactNative) {
        // iOS环境下不使用WebRTC VAD，直接返回成功但不初始化
        this.isInitialized = false // 标记为未初始化，但不报错
        return { success: true, message: 'iOS环境下使用简化模式' }
      }
      
      // 非移动端环境下才检查Web Audio API
      try {
        if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
          this.isInitialized = true
          return { success: true, message: 'WebRTC VAD服务已就绪' }
        } else {
          // 没有Web Audio API支持，但不报错
          this.isInitialized = false
          return { success: true, message: '使用简化模式' }
        }
      } catch (error) {
        // 静默处理Web Audio API检查失败
        this.isInitialized = false
        return { success: true, message: '使用简化模式' }
      }
    } catch (error) {
      // 静默处理所有初始化错误
      this.isInitialized = false
      return { success: true, message: '使用简化模式' }
    }
  }

  // 启动VAD监听 - 用于自由打断
  async startInterruptionListening() {
    // 检查iOS/React Native环境
    const isiOS = this.isIOSEnvironment()
    const isReactNative = this.isRunningInReactNative()
    
    if (isiOS || isReactNative) {
      // iOS环境下不使用WebRTC VAD，直接返回成功
      this.isListening = true
      this.notifyStatusChange('interruption_listening')
      return { success: true, message: 'iOS环境下使用简化模式' }
    }
    
    if (!this.isInitialized) {
      const initResult = await this.initialize()
      if (!initResult.success) {
        return initResult
      }
    }
    
    // 只在非移动端环境下才使用Web Audio API
    if (!this.isInitialized) {
      this.isListening = true
      this.notifyStatusChange('interruption_listening')
      return { success: true, message: '使用简化模式' }
    }

    try {
      // 尝试使用Web Audio API
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        }
      })

      const AudioContext = window.AudioContext || window.webkitAudioContext
      this.audioContext = new AudioContext()
      
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 1024
      this.analyser.smoothingTimeConstant = 0.1
      
      this.processor = this.audioContext.createScriptProcessor(this.config.frameSize, 1, 1)
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      source.connect(this.analyser)
      source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)
      
      this.processor.onaudioprocess = (event) => {
        if (this.isInterruptionEnabled && this.isPlaying) {
          this.processAudioFrame(event.inputBuffer)
        }
      }
      
      this.startVADLoop()
      
      this.isListening = true
      this.notifyStatusChange('interruption_listening')
      
      return { success: true, message: '自由打断监听运行中' }
    } catch (error) {
      // 静默处理Web Audio错误，回退到简化模式
      this.isListening = true
      this.notifyStatusChange('interruption_listening')
      return { success: true, message: '使用简化模式' }
    }
  }

  // 停止VAD监听
  async stopInterruptionListening() {
    try {
      this.isListening = false
      this.isVoiceActive = false
      
      // 清理定时器
      if (this.vadInterval) {
        clearInterval(this.vadInterval)
        this.vadInterval = null
      }
      
      // 清理音频处理器（静默处理错误）
      try {
        if (this.processor) {
          this.processor.disconnect()
          this.processor = null
        }
      } catch (error) {
        // 静默处理断开错误
      }
      
      // 清理Web Audio资源（静默处理错误）
      try {
        if (this.audioContext && this.audioContext.state !== 'closed') {
          await this.audioContext.close()
          this.audioContext = null
        }
      } catch (error) {
        // 静默处理关闭错误
      }
      
      // 停止媒体流（静默处理错误）
      try {
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(track => track.stop())
          this.mediaStream = null
        }
      } catch (error) {
        // 静默处理媒体流停止错误
      }
      
      this.analyser = null
      this.audioBuffer = []
      this.audioSegments = []
      
      this.notifyStatusChange('interruption_stopped')
      return { success: true }
    } catch (error) {
      // 静默处理所有停止错误，确保不影响主要功能
      this.isListening = false
      this.isVoiceActive = false
      return { success: true }
    }
  }

  // 处理音频帧 - 模仿111.py的音频处理逻辑
  processAudioFrame(inputBuffer) {
    const audioData = inputBuffer.getChannelData(0)
    
    // 将浮点音频数据转换为16位PCM (模仿webrtcvad的输入格式)
    const pcmData = new Int16Array(audioData.length)
    for (let i = 0; i < audioData.length; i++) {
      pcmData[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768))
    }
    
    // 存储音频段用于后续VAD检测
    this.audioSegments.push(pcmData)
    
    // 保持音频段缓冲区大小，对应111.py中的0.5秒检测
    const segmentsFor500ms = Math.floor(0.5 * this.config.sampleRate / this.config.frameSize)
    if (this.audioSegments.length > segmentsFor500ms) {
      this.audioSegments.shift()
    }
  }

  // VAD检测主循环 - 模仿111.py的check_vad_activity逻辑
  startVADLoop() {
    this.vadInterval = setInterval(() => {
      if (!this.isListening || !this.isInterruptionEnabled || !this.isPlaying) {
        return
      }
      
      // 检查是否有足够的音频数据
      if (this.audioSegments.length === 0) {
        return
      }
      
      // 模仿111.py的VAD检测逻辑
      const vadResult = this.checkVADActivity()
      
      if (vadResult) {
        this.handleVoiceDetected()
      } else {
        this.handleSilenceDetected()
      }
      
    }, this.config.detectionInterval)
  }

  // 检测VAD活动 - 模仿111.py的check_vad_activity函数
  checkVADActivity() {
    if (this.audioSegments.length === 0) {
      return false
    }
    
    let speechFrames = 0
    const totalFrames = this.audioSegments.length
    const requiredSpeechFrames = Math.floor(totalFrames * this.config.voiceDetectionRate)
    
    // 检测每个音频帧
    for (let i = 0; i < totalFrames; i++) {
      const frame = this.audioSegments[i]
      if (this.isSpeechFrame(frame)) {
        speechFrames++
      }
    }
    
    // 模仿111.py中的逻辑：如果语音帧数量超过阈值，则认为检测到语音
    return speechFrames > requiredSpeechFrames
  }

  // 判断单个音频帧是否包含语音 - 模仿webrtcvad的is_speech方法
  isSpeechFrame(frame) {
    // 计算音频能量
    const energy = this.calculateFrameEnergy(frame)
    
    // 计算过零率 (Zero Crossing Rate)
    const zcr = this.calculateZeroCrossingRate(frame)
    
    // 计算谱质心 (Spectral Centroid) - 简化版本
    const spectralCentroid = this.calculateSpectralCentroid(frame)
    
    // 综合判断是否为语音 (模仿webrtcvad的多特征判断)
    const energyThreshold = this.getEnergyThreshold()
    const zcrThreshold = this.getZCRThreshold()
    const spectralThreshold = this.getSpectralThreshold()
    
    // VAD模式越高，阈值越低 (越敏感)
    const sensitivity = (4 - this.config.vadMode) / 4.0
    
    return (
      energy > energyThreshold * sensitivity &&
      zcr > zcrThreshold * sensitivity &&
      spectralCentroid > spectralThreshold * sensitivity
    )
  }

  // 计算音频帧能量
  calculateFrameEnergy(frame) {
    let energy = 0
    for (let i = 0; i < frame.length; i++) {
      energy += frame[i] * frame[i]
    }
    return Math.sqrt(energy / frame.length)
  }

  // 计算过零率
  calculateZeroCrossingRate(frame) {
    let zeroCrossings = 0
    for (let i = 1; i < frame.length; i++) {
      if ((frame[i] >= 0) !== (frame[i - 1] >= 0)) {
        zeroCrossings++
      }
    }
    return zeroCrossings / frame.length
  }

  // 计算简化的谱质心
  calculateSpectralCentroid(frame) {
    // 简化的频域分析
    let weightedSum = 0
    let magnitudeSum = 0
    
    for (let i = 0; i < frame.length; i++) {
      const magnitude = Math.abs(frame[i])
      weightedSum += i * magnitude
      magnitudeSum += magnitude
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0
  }

  // 获取能量阈值
  getEnergyThreshold() {
    return 1000 // 根据测试调整
  }

  // 获取过零率阈值
  getZCRThreshold() {
    return 0.02 // 根据测试调整
  }

  // 获取谱质心阈值
  getSpectralThreshold() {
    return 50 // 根据测试调整
  }

  // 处理检测到语音
  handleVoiceDetected() {
    const now = Date.now()
    
    if (!this.isVoiceActive) {
      this.isVoiceActive = true
      this.voiceStartTime = now
      this.lastVoiceActivity = now
      this.silenceStartTime = null
      
      console.log('🗣️ 检测到用户语音，触发自由打断!')
      
      // 立即触发打断
      this.triggerInterruption()
      
      this.notifyStatusChange('voice_interruption_detected')
      
      if (this.callbacks.onVoiceDetected) {
        this.callbacks.onVoiceDetected()
      }
    } else {
      // 持续的语音活动
      this.lastVoiceActivity = now
      this.silenceStartTime = null
    }
  }

  // 处理检测到静音
  handleSilenceDetected() {
    const now = Date.now()
    
    if (this.isVoiceActive) {
      if (!this.silenceStartTime) {
        this.silenceStartTime = now
      }
      
      // 检查静音持续时间
      const silenceDuration = now - this.silenceStartTime
      if (silenceDuration > this.config.silenceThreshold) {
        // 语音结束
        this.isVoiceActive = false
        this.silenceStartTime = null
        
        const speechDuration = now - this.voiceStartTime
        if (speechDuration >= this.config.minimumSpeechDuration) {
          console.log('✅ 用户语音结束')
          this.notifyStatusChange('voice_interruption_ended')
          
          if (this.callbacks.onVoiceEnded) {
            this.callbacks.onVoiceEnded({ duration: speechDuration })
          }
        }
      }
    }
  }

  // 触发自由打断 - 模仿111.py的停止音频播放逻辑
  async triggerInterruption() {
    console.log('🔥 执行自由打断!')
    
    try {
      // 立即停止当前音频播放
      await this.stopCurrentAudioPlayback()
      
      this.notifyStatusChange('interruption_triggered')
      
      if (this.callbacks.onInterruptionTriggered) {
        this.callbacks.onInterruptionTriggered()
      }
      
      return true
    } catch (error) {
      console.error('❌ 触发自由打断失败:', error)
      return false
    }
  }

  // 停止当前音频播放 - 模仿111.py的pygame.mixer.music.stop()
  async stopCurrentAudioPlayback() {
    try {
      // 停止AudioService中的音频播放
      if (audioService.isPlaying) {
        await audioService.stopAudio()
        console.log('📴 已停止AudioService音频播放')
      }
      
      // 停止可能的TTS音频播放
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel()
        console.log('📴 已停止SpeechSynthesis播放')
      }
      
      console.log('🛑 所有音频播放已停止')
      return true
    } catch (error) {
      console.error('❌ 停止音频播放失败:', error)
      return false
    }
  }

  // 启用自由打断功能
  enableInterruption() {
    this.isInterruptionEnabled = true
    console.log('🎯 自由打断功能已启用')
    this.notifyStatusChange('interruption_enabled')
  }

  // 禁用自由打断功能
  disableInterruption() {
    this.isInterruptionEnabled = false
    this.isVoiceActive = false
    console.log('🚫 自由打断功能已禁用')
    this.notifyStatusChange('interruption_disabled')
  }

  // 设置AI播放状态
  setAIPlayingStatus(isPlaying) {
    this.isPlaying = isPlaying
    console.log(`🎵 AI播放状态: ${isPlaying ? '播放中' : '已停止'}`)
    
    if (isPlaying && this.isInterruptionEnabled && !this.isListening) {
      // AI开始播放且启用了打断功能，自动开始监听
      this.startInterruptionListening()
    } else if (!isPlaying && this.isListening) {
      // AI停止播放，停止监听以节省资源
      this.stopInterruptionListening()
    }
  }

  // 设置回调函数
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  // 状态通知
  notifyStatusChange(status) {
    if (this.callbacks.onStatusChange) {
      this.callbacks.onStatusChange(status)
    }
  }

  // 获取当前状态
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isListening: this.isListening,
      isInterruptionEnabled: this.isInterruptionEnabled,
      isPlaying: this.isPlaying,
      isVoiceActive: this.isVoiceActive,
      lastVoiceActivity: this.lastVoiceActivity,
      config: this.config,
    }
  }

  // 更新配置
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
    console.log('📝 WebRTC VAD配置已更新:', this.config)
  }

  // 清理资源
  async cleanup() {
    try {
      await this.stopInterruptionListening()
      
      // 重置所有状态
      this.isInitialized = false
      this.isInterruptionEnabled = false
      this.isPlaying = false
      this.isVoiceActive = false
      this.voiceStartTime = null
      this.lastVoiceActivity = Date.now()
      this.silenceStartTime = null
      this.audioSegments = []
      
      // 清空回调
      this.callbacks = {
        onVoiceDetected: null,
        onVoiceEnded: null,
        onSilenceDetected: null,
        onInterruptionTriggered: null,
        onStatusChange: null,
      }
      
    } catch (error) {
      // 静默处理所有清理错误
    }
  }
  
  // iOS环境检测
  isIOSEnvironment() {
    try {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
             (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    } catch (error) {
      return false
    }
  }
  
  // React Native环境检测
  isRunningInReactNative() {
    try {
      return typeof window === 'undefined' || 
             !window.document ||
             (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') ||
             (typeof __DEV__ !== 'undefined')
    } catch (error) {
      return true
    }
  }
}

// 创建单例实例
const webRTCVADService = new WebRTCVADService()
export default webRTCVADService