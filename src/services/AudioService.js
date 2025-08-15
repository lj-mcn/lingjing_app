import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system'

class AudioService {
  constructor() {
    this.recording = null
    this.sound = null
    this.isRecording = false
    this.isPlaying = false
    this.recordingUri = null
    this.isSimulationMode = false
    this.lastError = null
    this.statusCallbacks = []
    this.interruptionCallbacks = [] // 立即打断回调
  }

  async initializeAudio() {
    try {
      console.log('正在初始化音频服务...')

      // 请求音频权限
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') {
        console.warn('音频权限未授予，将使用模拟模式')
        this.isSimulationMode = true
        this.lastError = '音频权限未授予，请在设置中允许麦克风权限'
        return { success: true, mode: 'simulation', message: '使用模拟模式运行' }
      }

      // 设置音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      })

      console.log('✅ 音频服务初始化成功')
      return { success: true, mode: 'real', message: '音频服务已就绪' }
    } catch (error) {
      console.warn('音频初始化失败，切换到模拟模式:', error.message)
      this.isSimulationMode = true
      this.lastError = `音频初始化失败: ${error.message}`
      return { success: true, mode: 'simulation', message: '使用模拟模式运行' }
    }
  }

  async startRecording() {
    try {
      if (this.isRecording) {
        console.log('已经在录音中')
        return { success: false, error: '正在录音中，请先停止当前录音' }
      }

      // 立即触发打断检查 - 录音开始的瞬间
      this.triggerImmediateInterruptionCheck()

      if (this.isSimulationMode) {
        console.log('🎙️ 使用模拟录音模式')
        this.isRecording = true
        this.recordingUri = 'mock://audio/recording.wav'
        this.notifyStatusChange('recording', '模拟录音中...')
        return { success: true, mode: 'simulation', message: '模拟录音已开始' }
      }

      console.log('🎙️ 开始真实录音...')
      
      // iOS权限和音频模式设置
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        })
        console.log('🔧 iOS音频模式已设置')
      } catch (modeError) {
        console.warn('⚠️ 音频模式设置失败:', modeError.message)
      }

      const recording = new Audio.Recording()
      
      // 自定义录音选项，强制使用WAV格式以支持STT服务
      const recordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      }
      
      await recording.prepareToRecordAsync(recordingOptions)

      this.recording = recording
      await this.recording.startAsync()
      this.isRecording = true
      this.lastError = null

      console.log('✅ 录音已开始')
      this.notifyStatusChange('recording', '录音中...')
      return { success: true, mode: 'real', message: '录音已开始' }
    } catch (error) {
      console.error('录音失败:', error)
      this.lastError = `录音失败: ${error.message}`

      // 尝试降级到模拟模式
      console.log('切换到模拟录音模式')
      this.isSimulationMode = true
      this.isRecording = true
      this.recordingUri = 'mock://audio/recording.wav'
      this.notifyStatusChange('recording', '模拟录音中...')

      return {
        success: true,
        mode: 'simulation',
        message: '真实录音失败，使用模拟模式',
        originalError: error.message,
      }
    }
  }

  async stopRecording() {
    try {
      if (!this.isRecording) {
        console.log('没有正在进行的录音')
        return null
      }

      if (this.isSimulationMode) {
        console.log('模拟录音结束')
        this.isRecording = false
        return this.recordingUri // 返回模拟的录音路径
      }

      if (!this.recording) {
        console.log('没有录音对象')
        return null
      }

      await this.recording.stopAndUnloadAsync()
      this.recordingUri = this.recording.getURI()
      this.recording = null
      this.isRecording = false

      console.log('录音结束，文件保存在:', this.recordingUri)
      return this.recordingUri
    } catch (error) {
      console.error('停止录音失败，使用模拟模式:', error)
      // 如果停止录音失败，返回模拟结果
      this.isRecording = false
      this.recording = null
      return 'mock://audio/recording.wav'
    }
  }

  // 强制停止录音，确保状态完全重置
  async forceStopRecording() {
    try {
      console.log('🔄 强制停止录音')

      // 强制重置状态
      this.isRecording = false

      // 如果有录音对象，尝试停止
      if (this.recording) {
        try {
          await this.recording.stopAndUnloadAsync()
        } catch (error) {
          console.log('强制停止录音对象失败（可能已停止）:', error.message)
        }
        this.recording = null
      }

      // 重置录音URI
      this.recordingUri = null

      console.log('✅ 录音状态已强制重置')
      return true
    } catch (error) {
      console.error('强制停止录音失败:', error)
      // 即使失败也要重置状态
      this.isRecording = false
      this.recording = null
      this.recordingUri = null
      return false
    }
  }

  async getRecordingBase64() {
    try {
      if (!this.recordingUri) {
        throw new Error('没有录音文件')
      }

      const audioData = await FileSystem.readAsStringAsync(this.recordingUri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      return audioData
    } catch (error) {
      console.error('读取录音文件失败:', error)
      return null
    }
  }

  async playAudio(uri) {
    try {
      if (this.isPlaying) {
        await this.stopAudio()
      }

      if (this.isSimulationMode) {
        console.log('模拟播放音频:', uri)
        this.isPlaying = true
        // 模拟播放时间
        setTimeout(() => {
          this.isPlaying = false
          console.log('模拟播放结束')
        }, 2000)
        return true
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: 1.0 },
      )

      this.sound = sound
      this.isPlaying = true

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          this.isPlaying = false
          this.sound = null
        }
      })

      console.log('开始播放音频')
      return true
    } catch (error) {
      console.error('播放音频失败，使用模拟模式:', error)
      // 如果播放失败，使用模拟模式
      this.isSimulationMode = true
      this.isPlaying = true
      setTimeout(() => {
        this.isPlaying = false
      }, 2000)
      return true
    }
  }

  async playAudioFromBase64(base64Data) {
    try {
      if (this.isSimulationMode) {
        console.log('模拟播放Base64音频')
        this.isPlaying = true
        setTimeout(() => {
          this.isPlaying = false
          console.log('模拟Base64播放结束')
        }, 2000)
        return true
      }

      const uri = `data:audio/wav;base64,${base64Data}`
      return await this.playAudio(uri)
    } catch (error) {
      console.error('播放Base64音频失败，使用模拟模式:', error)
      this.isSimulationMode = true
      this.isPlaying = true
      setTimeout(() => {
        this.isPlaying = false
      }, 2000)
      return true
    }
  }

  async stopAudio() {
    try {
      if (this.sound) {
        await this.sound.stopAsync()
        await this.sound.unloadAsync()
        this.sound = null
        this.isPlaying = false
        console.log('音频播放已停止')
      }
    } catch (error) {
      console.error('停止音频播放失败:', error)
    }
  }

  async cleanup() {
    try {
      if (this.isRecording && this.recording) {
        await this.stopRecording()
      }

      if (this.isPlaying && this.sound) {
        await this.stopAudio()
      }

      // 清理录音文件
      if (this.recordingUri) {
        try {
          await FileSystem.deleteAsync(this.recordingUri, { idempotent: true })
        } catch (error) {
          console.log('清理录音文件时出错:', error)
        }
        this.recordingUri = null
      }

      console.log('音频服务清理完成')
    } catch (error) {
      console.error('音频服务清理失败:', error)
    }
  }

  // 添加状态回调管理
  addStatusCallback(callback) {
    this.statusCallbacks.push(callback)
  }

  removeStatusCallback(callback) {
    this.statusCallbacks = this.statusCallbacks.filter((cb) => cb !== callback)
  }

  notifyStatusChange(status, message) {
    this.statusCallbacks.forEach((callback) => {
      try {
        callback({ status, message, timestamp: Date.now() })
      } catch (error) {
        console.error('状态回调错误:', error)
      }
    })
  }

  getRecordingStatus() {
    return {
      isRecording: this.isRecording,
      isPlaying: this.isPlaying,
      recordingUri: this.recordingUri,
      isSimulationMode: this.isSimulationMode,
      lastError: this.lastError,
    }
  }

  // 获取详细的服务状态
  getDetailedStatus() {
    return {
      ...this.getRecordingStatus(),
      hasPermission: !this.isSimulationMode,
      readyForRecording: !this.isRecording && !this.isPlaying,
      canPlayAudio: true,
    }
  }

  // 立即触发打断检查
  triggerImmediateInterruptionCheck() {
    try {
      // 通知所有注册的打断回调
      this.interruptionCallbacks.forEach(callback => {
        try {
          callback()
        } catch (error) {
          console.error('打断回调执行错误:', error)
        }
      })

      console.log('⚡ 立即打断检查已触发')
    } catch (error) {
      console.error('触发立即打断检查失败:', error)
    }
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

  // 立即停止音频播放（非阻塞版本）
  stopAudioImmediate() {
    try {
      // 立即设置状态
      this.isPlaying = false
      
      // 非阻塞停止音频
      if (this.sound) {
        this.sound.stopAsync().catch(() => {})
        this.sound.unloadAsync().catch(() => {})
        this.sound = null
      }
      
      console.log('⚡ 音频播放已立即停止')
      return true
    } catch (error) {
      console.error('立即停止音频失败:', error)
      this.isPlaying = false
      return false
    }
  }
}

// 创建单例实例
const audioService = new AudioService()
export default audioService
