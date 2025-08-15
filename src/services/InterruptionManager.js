import audioService from './AudioService'

class InterruptionManager {
  constructor() {
    this.isEnabled = false
    this.isAIPlaying = false
    this.isMonitoring = false
    this.interruptionCallbacks = []
    this.monitoringInterval = null
    this.lastRecordingState = false

    // 配置参数 - 针对立即打断优化
    this.config = {
      monitorInterval: 10, // 大幅降低监控间隔实现立即响应
      debounceTime: 0, // 取消防抖延迟
      enableDebugLogs: false, // iOS上默认关闭调试日志
      maxRetries: 1, // 减少重试次数提高响应速度
      retryDelay: 50, // 减少重试延迟
      instantResponse: true, // 启用即时响应模式
    }

    // 静默初始化，不输出日志
  }

  // 启用打断功能
  enable() {
    this.isEnabled = true
    this.log('✅ 打断功能已启用')
  }

  // 禁用打断功能
  disable() {
    this.isEnabled = false
    this.stopMonitoring()
    this.log('❌ 打断功能已禁用')
  }

  // 设置AI播放状态
  setAIPlayingStatus(isPlaying) {
    const statusChanged = this.isAIPlaying !== isPlaying
    this.isAIPlaying = isPlaying

    if (statusChanged) {
      this.log(`🎵 AI播放状态: ${isPlaying ? '开始播放' : '停止播放'}`)

      if (isPlaying && this.isEnabled) {
        // AI开始播放，启动打断监控
        this.startMonitoring()
      } else {
        // AI停止播放，停止监控
        this.stopMonitoring()
      }
    }
  }

  // 开始监控录音状态变化
  startMonitoring() {
    if (this.isMonitoring) {
      this.log('⚠️ 打断监控已在运行')
      return
    }

    this.isMonitoring = true
    this.lastRecordingState = false

    this.log('👂 开始监控录音状态变化')

    this.monitoringInterval = setInterval(() => {
      if (!this.isEnabled || !this.isAIPlaying) {
        this.stopMonitoring()
        return
      }

      // 检查录音状态
      const currentRecordingState = this.isRecordingActive()

      // 检测到录音开始 = 用户开始说话 = 触发打断
      if (currentRecordingState && !this.lastRecordingState) {
        this.log('🔥 检测到用户开始录音 - 触发打断!')
        this.triggerInterruption()
      }

      this.lastRecordingState = currentRecordingState
    }, this.config.monitorInterval)
  }

  // 停止监控
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    if (this.isMonitoring) {
      this.isMonitoring = false
      this.log('🛑 停止打断监控')
    }
  }

  // 检查是否有录音活动 - iOS优化版本
  isRecordingActive() {
    try {
      // 增加重试机制，针对iOS上可能的异步问题
      for (let retry = 0; retry < this.config.maxRetries; retry++) {
        try {
          const audioStatus = audioService.getRecordingStatus()
          if (audioStatus && typeof audioStatus.isRecording === 'boolean') {
            return audioStatus.isRecording
          }
        } catch (retryError) {
          if (retry === this.config.maxRetries - 1) {
            // 最后一次重试失败，静默返回false
            return false
          }
          // 等待后重试
          if (typeof setTimeout !== 'undefined') {
            // 在React Native环境中可能需要同步等待
            continue
          }
        }
      }
      return false
    } catch (error) {
      // 静默处理所有错误
      return false
    }
  }

  // 触发打断
  triggerInterruption() {
    if (!this.isEnabled || !this.isAIPlaying) {
      return
    }

    this.log('💥 执行打断操作')

    // 立即停止AI播放
    this.stopAIPlayback()

    // 通知所有监听器
    this.notifyInterruption()

    // 停止监控（因为AI已经被打断）
    this.stopMonitoring()
  }

  // 立即停止AI播放 - 优化版本
  async stopAIPlayback() {
    try {
      // 立即更新状态，不等待音频停止完成
      this.isAIPlaying = false
      this.log('⚡ 立即更新AI播放状态为停止')

      if (this.config.instantResponse) {
        // 即时响应模式：并行且非阻塞地停止音频
        this.stopAudioNonBlocking()
        return // 立即返回，不等待音频停止
      }

      // 传统模式：等待音频停止（保持向后兼容）
      await this.stopAudioWithTimeout()
    } catch (error) {
      // 静默处理所有错误，但仍然更新状态
      this.isAIPlaying = false
    }
  }

  // 非阻塞音频停止
  stopAudioNonBlocking() {
    // 并行启动所有停止操作，但不等待完成
    if (audioService && audioService.isPlaying) {
      audioService.stopAudio().catch(() => {})
    }

    // 停止TTS
    try {
      if (typeof global !== 'undefined' && global.currentTTSSound) {
        global.currentTTSSound.stopAsync().catch(() => {})
      }
    } catch (globalError) {
      // 静默处理
    }

    this.log('🚀 非阻塞音频停止操作已启动')
  }

  // 带超时的音频停止（传统模式）
  async stopAudioWithTimeout() {
    const stopPromises = []

    if (audioService && audioService.isPlaying) {
      stopPromises.push(audioService.stopAudio().catch(() => {}))
    }

    try {
      if (typeof global !== 'undefined' && global.currentTTSSound) {
        stopPromises.push(global.currentTTSSound.stopAsync().catch(() => {}))
      }
    } catch (globalError) {
      // 静默处理
    }

    // 减少超时时间提高响应速度
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 200)) // 200ms超时

    await Promise.race([
      Promise.all(stopPromises),
      timeoutPromise,
    ])
  }

  // 手动触发打断（用于UI按钮等）
  manualInterrupt() {
    if (!this.isEnabled) {
      this.log('⚠️ 打断功能未启用')
      return false
    }

    if (!this.isAIPlaying) {
      this.log('⚠️ AI当前未在播放')
      return false
    }

    this.log('🔧 手动触发打断')
    this.triggerInterruption()
    return true
  }

  // 添加打断回调
  addInterruptionCallback(callback) {
    if (typeof callback === 'function') {
      this.interruptionCallbacks.push(callback)
    }
  }

  // 移除打断回调
  removeInterruptionCallback(callback) {
    const index = this.interruptionCallbacks.indexOf(callback)
    if (index > -1) {
      this.interruptionCallbacks.splice(index, 1)
    }
  }

  // 通知打断事件
  notifyInterruption() {
    this.interruptionCallbacks.forEach((callback) => {
      try {
        callback()
      } catch (error) {
        this.log('❌ 打断回调执行失败:', error.message)
      }
    })
  }

  // 获取状态
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      isAIPlaying: this.isAIPlaying,
      isMonitoring: this.isMonitoring,
      lastRecordingState: this.lastRecordingState,
      callbackCount: this.interruptionCallbacks.length,
      config: this.config,
    }
  }

  // 更新配置
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
    this.log('📝 打断管理器配置已更新')
  }

  // 调试日志 - iOS优化（默认静默）
  log(...args) {
    if (this.config.enableDebugLogs) {
      // 只在开发模式下输出日志
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('🎯 [InterruptionManager]', ...args)
      }
    }
  }

  // iOS环境检测
  isIOSEnvironment() {
    try {
      return /iPad|iPhone|iPod/.test(navigator.userAgent)
             || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    } catch (error) {
      return false
    }
  }

  // 清理资源 - iOS优化
  cleanup() {
    try {
      this.disable()
      this.interruptionCallbacks = []

      // 确保所有定时器都被清理
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval)
        this.monitoringInterval = null
      }

      // 重置状态
      this.isEnabled = false
      this.isAIPlaying = false
      this.isMonitoring = false
      this.lastRecordingState = false
    } catch (error) {
      // 静默处理清理错误
    }
  }
}

// 创建单例
const interruptionManager = new InterruptionManager()
export default interruptionManager
