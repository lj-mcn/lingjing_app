import { Audio } from 'expo-av'
import audioService from './AudioService'
import webRTCVADService from './WebRTCVADService'

class VADService {
  constructor() {
    this.isInitialized = false
    this.isListening = false
    this.isInterruptionEnabled = false
    this.useWebRTCVAD = true // 默认使用更精确的WebRTC VAD

    // VAD 配置
    this.config = {
      sampleRate: 16000,
      frameSize: 320, // 20ms at 16kHz
      vadMode: 3, // 最敏感模式 (0-3)
      silenceThreshold: 3000, // 3秒静音后处理
      voiceDetectionInterval: 100, // 100ms检测间隔
      minimumSpeechDuration: 500, // 最小语音持续时间500ms
    }

    // 状态管理
    this.audioContext = null
    this.analyser = null
    this.mediaStream = null
    this.audioBuffer = []
    this.isVoiceActive = false
    this.voiceStartTime = null
    this.lastVoiceActivity = Date.now()
    this.silenceStartTime = null

    // 回调函数
    this.callbacks = {
      onVoiceStart: null,
      onVoiceEnd: null,
      onSilenceDetected: null,
      onInterruptionTriggered: null,
      onStatusChange: null,
    }

    // 设置WebRTC VAD服务的回调
    this.setupWebRTCVADCallbacks()

    // 定时器管理
    this.vadInterval = null
    this.silenceCheckInterval = null

    console.log('VADService 初始化完成')
  }

  // 设置WebRTC VAD服务的回调
  setupWebRTCVADCallbacks() {
    webRTCVADService.setCallbacks({
      onVoiceDetected: () => {
        console.log('🗣️ WebRTC VAD检测到语音开始')
        if (this.callbacks.onVoiceStart) {
          this.callbacks.onVoiceStart()
        }
      },
      onVoiceEnded: (data) => {
        console.log('✅ WebRTC VAD检测到语音结束')
        if (this.callbacks.onVoiceEnd) {
          this.callbacks.onVoiceEnd(data)
        }
      },
      onInterruptionTriggered: () => {
        console.log('🔥 WebRTC VAD触发自由打断')
        if (this.callbacks.onInterruptionTriggered) {
          this.callbacks.onInterruptionTriggered()
        }
      },
      onStatusChange: (status) => {
        this.notifyStatusChange(`webrtc_${status}`)
      },
    })
  }

  // 初始化VAD服务
  async initialize() {
    try {
      // 静默初始化，不输出用户可见的日志

      // 检查运行环境 - 改进iOS检测
      const isReactNative = this.isRunningInReactNative()
      const isiOS = this.isIOSEnvironment()

      // iOS环境下优先使用InterruptionManager作为主要打断机制
      if (isiOS || isReactNative) {
        this.useWebRTCVAD = false
        // 在iOS/RN环境下，VAD服务主要作为InterruptionManager的辅助
      }

      // 尝试初始化WebRTC VAD服务（静默处理失败）
      if (this.useWebRTCVAD) {
        try {
          const webrtcResult = await webRTCVADService.initialize()
          if (!webrtcResult.success) {
            this.useWebRTCVAD = false
          }
        } catch (error) {
          // 静默处理WebRTC VAD初始化失败
          this.useWebRTCVAD = false
        }
      }

      this.isInitialized = true
      return { success: true, message: 'VAD服务已就绪' }
    } catch (error) {
      // 静默处理错误，确保不影响主要功能
      this.isInitialized = true
      this.useWebRTCVAD = false
      return { success: true, message: 'VAD服务已就绪（简化模式）' }
    }
  }

  // 开始语音活动检测
  async startVAD() {
    if (!this.isInitialized) {
      const initResult = await this.initialize()
      if (!initResult.success) {
        return initResult
      }
    }

    try {
      const isReactNative = this.isRunningInReactNative()
      const isiOS = this.isIOSEnvironment()

      if (isReactNative || isiOS) {
        // iOS/React Native环境：使用优化的简化VAD模式
        this.isListening = true
        this.notifyStatusChange('listening')

        // 启动针对iOS优化的VAD检测
        this.startIOSOptimizedVADLoop()

        return { success: true, message: 'VAD检测运行中' }
      }

      // 浏览器环境：尝试使用Web Audio API（静默处理失败）
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: this.config.sampleRate,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })

        const AudioContext = window.AudioContext || window.webkitAudioContext
        this.audioContext = new AudioContext()

        this.analyser = this.audioContext.createAnalyser()
        this.analyser.fftSize = 2048
        this.analyser.smoothingTimeConstant = 0.8

        const source = this.audioContext.createMediaStreamSource(this.mediaStream)
        source.connect(this.analyser)

        this.startVADLoop()

        this.isListening = true
        this.notifyStatusChange('listening')

        return { success: true, message: 'VAD检测运行中' }
      } catch (webAudioError) {
        // Web Audio API失败，回退到简化模式
        this.isListening = true
        this.notifyStatusChange('listening')
        this.startIOSOptimizedVADLoop()
        return { success: true, message: 'VAD检测运行中（简化模式）' }
      }
    } catch (error) {
      // 静默处理所有错误，确保不影响主要功能
      this.isListening = true
      this.notifyStatusChange('listening')
      this.startIOSOptimizedVADLoop()
      return { success: true, message: 'VAD检测运行中' }
    }
  }

  // 停止语音活动检测
  async stopVAD() {
    try {
      console.log('🛑 停止语音活动检测...')

      this.isListening = false
      this.isVoiceActive = false

      // 清理定时器
      if (this.vadInterval) {
        clearInterval(this.vadInterval)
        this.vadInterval = null
      }

      if (this.silenceCheckInterval) {
        clearInterval(this.silenceCheckInterval)
        this.silenceCheckInterval = null
      }

      // 清理Web Audio资源
      if (this.audioContext) {
        await this.audioContext.close()
        this.audioContext = null
      }

      // 停止媒体流
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop())
        this.mediaStream = null
      }

      this.analyser = null
      this.audioBuffer = []

      this.notifyStatusChange('idle')
      console.log('✅ VAD 检测已停止')
      return { success: true }
    } catch (error) {
      console.error('❌ 停止VAD失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 启用自由打断功能
  enableInterruption() {
    this.isInterruptionEnabled = true

    // 同时启用WebRTC VAD的自由打断功能
    if (this.useWebRTCVAD) {
      webRTCVADService.enableInterruption()
    }

    console.log('🎯 自由打断功能已启用')
    this.notifyStatusChange('interruption_enabled')
  }

  // 禁用自由打断功能
  disableInterruption() {
    this.isInterruptionEnabled = false

    // 同时禁用WebRTC VAD的自由打断功能
    if (this.useWebRTCVAD) {
      webRTCVADService.disableInterruption()
    }

    console.log('🚫 自由打断功能已禁用')
    this.notifyStatusChange('interruption_disabled')
  }

  // 设置AI播放状态 - 用于自由打断
  setAIPlayingStatus(isPlaying) {
    if (this.useWebRTCVAD) {
      webRTCVADService.setAIPlayingStatus(isPlaying)
    }
    console.log(`🎵 AI播放状态更新: ${isPlaying ? '播放中' : '已停止'}`)
  }

  // 启动自由打断监听 - 当AI开始播放时调用
  async startInterruptionListening() {
    if (!this.isInterruptionEnabled) {
      console.log('⚠️ 自由打断功能未启用')
      return { success: false, error: '自由打断功能未启用' }
    }

    if (this.useWebRTCVAD) {
      return await webRTCVADService.startInterruptionListening()
    }
    // 使用传统VAD方法
    return await this.startVAD()
  }

  // 停止自由打断监听 - 当AI停止播放时调用
  async stopInterruptionListening() {
    if (this.useWebRTCVAD) {
      return await webRTCVADService.stopInterruptionListening()
    }
    // 使用传统VAD方法
    return await this.stopVAD()
  }

  // 手动触发自由打断 - 用于测试或紧急情况
  async triggerInterruption() {
    if (this.useWebRTCVAD) {
      return await webRTCVADService.triggerInterruption()
    }
    return await this.stopCurrentAudioPlayback()
  }

  // iOS优化的VAD循环 - 针对React Native/iOS环境优化
  startIOSOptimizedVADLoop() {
    this.vadInterval = setInterval(() => {
      if (!this.isListening) {
        return
      }

      // iOS环境下的优化策略：
      // 1. 主要依赖InterruptionManager进行打断检测
      // 2. VAD服务作为辅助，处理状态同步

      if (this.isInterruptionEnabled) {
        // 检查录音状态变化，配合InterruptionManager工作
        try {
          const audioService = require('./AudioService').default
          const currentRecordingState = audioService.getRecordingStatus().isRecording

          // 配合InterruptionManager的录音检测逻辑
          if (currentRecordingState && !this.lastRecordingState) {
            // 检测到录音开始，触发VAD回调（如果存在）
            if (this.callbacks.onVoiceStart) {
              this.callbacks.onVoiceStart()
            }
            if (this.isInterruptionEnabled && this.callbacks.onInterruptionTriggered) {
              this.callbacks.onInterruptionTriggered()
            }
          }

          this.lastRecordingState = currentRecordingState
        } catch (error) {
          // 静默处理错误，不影响主要功能
        }
      }
    }, this.config.voiceDetectionInterval)
  }

  // 简化VAD循环 - 保留向后兼容性
  startSimpleVADLoop() {
    this.startIOSOptimizedVADLoop()
  }

  // VAD检测主循环
  startVADLoop() {
    this.vadInterval = setInterval(() => {
      if (!this.isListening || !this.analyser) {
        return
      }

      // 获取音频数据
      const bufferLength = this.analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      this.analyser.getByteFrequencyData(dataArray)

      // 计算音频能量
      const averageVolume = this.calculateAudioEnergy(dataArray)

      // 检测语音活动
      const isCurrentlyActive = this.detectVoiceActivity(averageVolume)

      this.processVoiceActivity(isCurrentlyActive)
    }, this.config.voiceDetectionInterval)
  }

  // 计算音频能量
  calculateAudioEnergy(dataArray) {
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i]
    }
    return sum / dataArray.length
  }

  // 检测语音活动（简化的VAD算法）
  detectVoiceActivity(averageVolume) {
    // 基于音量的简单VAD检测
    // 在实际应用中，这里应该使用更复杂的算法，如谱质心、过零率等
    const threshold = 20 // 音量阈值，可根据环境调整
    return averageVolume > threshold
  }

  // 处理语音活动状态变化
  processVoiceActivity(isCurrentlyActive) {
    const now = Date.now()

    if (isCurrentlyActive && !this.isVoiceActive) {
      // 检测到语音开始
      this.voiceStartTime = now
      this.isVoiceActive = true
      this.silenceStartTime = null
      this.lastVoiceActivity = now

      console.log('🗣️ 检测到语音开始')
      this.notifyStatusChange('voice_detected')

      // 如果启用了打断功能，立即触发打断
      if (this.isInterruptionEnabled) {
        this.triggerInterruption()
      }

      if (this.callbacks.onVoiceStart) {
        this.callbacks.onVoiceStart()
      }
    } else if (!isCurrentlyActive && this.isVoiceActive) {
      // 检测到语音结束（开始静音）
      if (!this.silenceStartTime) {
        this.silenceStartTime = now
        console.log('🤫 检测到静音开始')
        this.notifyStatusChange('silence_detected')
      }

      // 检查静音持续时间
      const silenceDuration = now - this.silenceStartTime
      if (silenceDuration > this.config.silenceThreshold) {
        // 静音足够长，认为语音结束
        this.isVoiceActive = false
        this.silenceStartTime = null

        // 检查语音持续时间是否足够
        const speechDuration = this.silenceStartTime || now - this.voiceStartTime
        if (speechDuration >= this.config.minimumSpeechDuration) {
          console.log('✅ 检测到有效语音结束')
          this.notifyStatusChange('voice_ended')

          if (this.callbacks.onVoiceEnd) {
            this.callbacks.onVoiceEnd({
              duration: speechDuration,
              startTime: this.voiceStartTime,
              endTime: now,
            })
          }
        } else {
          console.log('⚠️ 语音时间过短，忽略')
        }
      }
    } else if (isCurrentlyActive) {
      // 持续的语音活动
      this.lastVoiceActivity = now
      this.silenceStartTime = null
    }
  }

  // 触发打断功能
  triggerInterruption() {
    console.log('🔥 触发自由打断!')

    // 停止当前音频播放
    this.stopCurrentAudioPlayback()

    this.notifyStatusChange('interruption_triggered')

    if (this.callbacks.onInterruptionTriggered) {
      this.callbacks.onInterruptionTriggered()
    }
  }

  // 停止当前音频播放
  async stopCurrentAudioPlayback() {
    try {
      // 检查并停止AudioService中的音频播放
      if (audioService.isPlaying) {
        await audioService.stopAudio()
        console.log('📴 已停止AudioService音频播放')
      }

      // 检查并停止Expo Audio播放
      try {
        const { sound } = await Audio.Sound.createAsync({ uri: 'dummy' })
        await sound.stopAsync()
        await sound.unloadAsync()
      } catch (error) {
        // 忽略错误，可能没有正在播放的音频
      }

      console.log('🛑 当前音频播放已停止')
      return true
    } catch (error) {
      console.error('❌ 停止音频播放失败:', error)
      return false
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
    const baseStatus = {
      isInitialized: this.isInitialized,
      isListening: this.isListening,
      isVoiceActive: this.isVoiceActive,
      isInterruptionEnabled: this.isInterruptionEnabled,
      lastVoiceActivity: this.lastVoiceActivity,
      useWebRTCVAD: this.useWebRTCVAD,
      config: this.config,
    }

    // 如果使用WebRTC VAD，包含其状态
    if (this.useWebRTCVAD) {
      baseStatus.webRTCVADStatus = webRTCVADService.getStatus()
    }

    return baseStatus
  }

  // 更新配置
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }

    // 同时更新WebRTC VAD配置
    if (this.useWebRTCVAD && newConfig) {
      const webrtcConfig = {}

      // 映射通用配置到WebRTC VAD配置
      if (newConfig.sampleRate !== undefined) webrtcConfig.sampleRate = newConfig.sampleRate
      if (newConfig.vadMode !== undefined) webrtcConfig.vadMode = newConfig.vadMode
      if (newConfig.silenceThreshold !== undefined) webrtcConfig.silenceThreshold = newConfig.silenceThreshold
      if (newConfig.minimumSpeechDuration !== undefined) webrtcConfig.minimumSpeechDuration = newConfig.minimumSpeechDuration

      if (Object.keys(webrtcConfig).length > 0) {
        webRTCVADService.updateConfig(webrtcConfig)
      }
    }

    console.log('📝 VAD配置已更新:', this.config)
  }

  // 切换VAD算法
  switchVADAlgorithm(useWebRTC = true) {
    this.useWebRTCVAD = useWebRTC
    console.log(`🔄 切换到${useWebRTC ? 'WebRTC' : '传统'}VAD算法`)
    this.notifyStatusChange(`algorithm_switched_${useWebRTC ? 'webrtc' : 'traditional'}`)
  }

  // 清理资源
  async cleanup() {
    try {
      await this.stopVAD()

      // 清理WebRTC VAD服务（静默处理错误）
      if (this.useWebRTCVAD) {
        try {
          await webRTCVADService.cleanup()
        } catch (error) {
          // 静默处理清理错误
        }
      }

      // 重置所有状态
      this.isInitialized = false
      this.isVoiceActive = false
      this.isInterruptionEnabled = false
      this.voiceStartTime = null
      this.lastVoiceActivity = Date.now()
      this.silenceStartTime = null
      this.audioBuffer = []
      this.lastRecordingState = false

      // 清空回调
      this.callbacks = {
        onVoiceStart: null,
        onVoiceEnd: null,
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
      return /iPad|iPhone|iPod/.test(navigator.userAgent)
             || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
             || (typeof window !== 'undefined' && window.navigator && window.navigator.platform === 'iOS')
    } catch (error) {
      return false
    }
  }

  // React Native环境检测
  isRunningInReactNative() {
    try {
      return typeof window === 'undefined'
             || !window.document
             || (typeof navigator !== 'undefined' && navigator.product === 'ReactNative')
             || (typeof __DEV__ !== 'undefined')
    } catch (error) {
      return true // 默认认为是React Native环境
    }
  }
}

// 创建单例实例
const vadService = new VADService()
export default vadService
