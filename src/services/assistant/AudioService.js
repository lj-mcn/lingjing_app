import { Audio } from 'expo-av'
import { Platform } from 'react-native'

class AudioService {
  constructor() {
    this.recording = null
    this.isRecording = false
    this.sound = null
    this.lastError = null
    this.mode = 'production' // or 'simulation'
    this.audioPermissions = null
  }

  async initializeAudio(forceProduction = false) {
    try {
      console.log('🎵 初始化音频服务...')
      console.log('🔍 当前平台:', Platform.OS)

      // 请求录音权限
      console.log('🔑 请求录音权限...')
      const { status } = await Audio.requestPermissionsAsync()
      console.log('🔑 权限状态:', status)
      this.audioPermissions = status === 'granted'

      if (this.audioPermissions || forceProduction) {
        // 设置基础音频模式
        console.log('🔧 配置音频模式...')

        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
          })
          console.log('✅ 音频模式配置成功')
        } catch (audioModeError) {
          console.error('❌ 音频模式配置失败:', audioModeError.message)
          throw audioModeError
        }

        this.mode = 'production'
        const modeMessage = forceProduction && !this.audioPermissions
          ? '强制生产模式（权限可能不足）' : '音频权限已获得，录音功能可用'
        console.log('✅ 音频服务初始化成功（生产模式）')
        console.log(`📋 模式详情: ${modeMessage}`)
        return {
          success: true,
          mode: 'production',
          message: modeMessage,
        }
      }

      this.mode = 'simulation'
      console.warn('⚠️ 音频权限未获得，使用模拟模式')
      return {
        success: true,
        mode: 'simulation',
        message: '音频权限未获得，将使用模拟录音模式',
      }
    } catch (error) {
      console.error('❌ 音频服务初始化失败:', error)
      this.lastError = error.message
      this.mode = 'simulation'
      return {
        success: false,
        mode: 'simulation',
        message: `音频初始化失败: ${error.message}，将使用模拟模式`,
      }
    }
  }

  async startRecording() {
    try {
      this.lastError = null

      if (this.isRecording) {
        await this.stopRecording()
      }

      if (this.mode === 'simulation' || !this.audioPermissions) {
        console.log('🎤 开始模拟录音...')
        this.isRecording = true
        return {
          success: true,
          mode: 'simulation',
          message: '模拟录音已开始',
        }
      }

      // 生产模式 - 真实录音
      console.log('🎤 开始录音...')

      const recordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      }

      this.recording = new Audio.Recording()
      await this.recording.prepareToRecordAsync(recordingOptions)
      await this.recording.startAsync()

      this.isRecording = true
      console.log('✅ 录音已开始')

      return {
        success: true,
        mode: 'production',
        message: '录音已开始',
      }
    } catch (error) {
      console.error('❌ 开始录音失败:', error)
      this.lastError = error.message
      this.isRecording = false
      return {
        success: false,
        error: error.message,
      }
    }
  }

  async stopRecording() {
    try {
      if (!this.isRecording) {
        return null
      }

      this.isRecording = false

      if (this.mode === 'simulation') {
        console.log('🎤 停止模拟录音')
        return 'simulation://audio/mock-recording.wav'
      }

      if (!this.recording) {
        throw new Error('没有正在进行的录音')
      }

      console.log('🎤 停止录音...')
      await this.recording.stopAndUnloadAsync()
      const uri = this.recording.getURI()

      // 清理录音对象
      this.recording = null

      console.log('✅ 录音已停止，文件:', uri)
      return uri
    } catch (error) {
      console.error('❌ 停止录音失败:', error)
      this.lastError = error.message
      this.isRecording = false
      this.recording = null
      throw error
    }
  }

  async forceStopRecording() {
    try {
      if (this.recording && this.isRecording) {
        console.log('🛑 强制停止录音...')
        await this.recording.stopAndUnloadAsync()
        this.recording = null
      }
      this.isRecording = false
      this.lastError = null
      console.log('✅ 强制停止录音完成')
    } catch (error) {
      console.error('❌ 强制停止录音失败:', error)
      this.lastError = error.message
      this.isRecording = false
      this.recording = null
    }
  }

  async playAudioFromBase64(base64Data) {
    try {
      if (!base64Data) {
        throw new Error('没有音频数据')
      }

      // 停止当前播放的音频
      if (this.sound) {
        await this.sound.unloadAsync()
        this.sound = null
      }

      console.log('🔊 开始播放音频...')

      // 创建音频对象
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${base64Data}` },
        { shouldPlay: true },
      )

      this.sound = sound

      // 等待播放完成
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          console.log('✅ 音频播放完成')
          sound.unloadAsync()
          if (this.sound === sound) {
            this.sound = null
          }
        }
      })

      return true
    } catch (error) {
      console.error('❌ 播放音频失败:', error)
      this.lastError = error.message
      throw error
    }
  }

  getRecordingStatus() {
    return {
      isRecording: this.isRecording,
      mode: this.mode,
      hasPermissions: this.audioPermissions,
      lastError: this.lastError,
      hasActiveRecording: !!this.recording,
      hasActivePlayback: !!this.sound,
      platform: Platform.OS,
    }
  }

  async cleanup() {
    try {
      console.log('🧹 清理音频服务...')

      // 停止录音
      if (this.recording && this.isRecording) {
        await this.recording.stopAndUnloadAsync()
      }
      this.recording = null
      this.isRecording = false

      // 停止播放
      if (this.sound) {
        await this.sound.unloadAsync()
        this.sound = null
      }

      this.lastError = null
      console.log('✅ 音频服务清理完成')
    } catch (error) {
      console.error('❌ 音频服务清理失败:', error)
    }
  }
}

// 创建单例实例
const audioService = new AudioService()
export default audioService
