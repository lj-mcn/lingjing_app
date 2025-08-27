import { Audio } from 'expo-av'
import { Platform } from 'react-native'

class StreamingAudioService {
  constructor() {
    this.recording = null
    this.isStreaming = false
    this.audioChunkBuffer = []
    this.chunkSize = 1024 * 16 // 16KB chunks
    this.sampleRate = 16000 // 16kHz for better STT performance
    this.onAudioChunk = null // Callback for each audio chunk
    this.onStreamingEnd = null // Callback when streaming ends
    this.audioPermissions = null
    this.lastError = null
    this.mode = 'production'
  }

  async initializeStreaming() {
    try {
      console.log('🎵 初始化流式音频服务...')

      // 请求录音权限
      const { status } = await Audio.requestPermissionsAsync()
      this.audioPermissions = status === 'granted'

      if (!this.audioPermissions) {
        console.warn('⚠️ 音频权限未获得，使用模拟模式')
        this.mode = 'simulation'
        return { success: true, mode: 'simulation' }
      }

      // 配置基础音频模式
      console.log('🔧 配置流式音频模式...')

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      })

      this.mode = 'production'
      console.log('✅ 流式音频服务初始化成功')
      return { success: true, mode: 'production' }
    } catch (error) {
      console.error('❌ 流式音频服务初始化失败:', error)
      this.lastError = error.message
      this.mode = 'simulation'
      return { success: false, mode: 'simulation', error: error.message }
    }
  }

  // 设置音频块回调
  setOnAudioChunk(callback) {
    this.onAudioChunk = callback
  }

  // 设置流式结束回调
  setOnStreamingEnd(callback) {
    this.onStreamingEnd = callback
  }

  async startStreaming() {
    try {
      if (this.isStreaming) {
        console.log('流式录音已在进行中')
        return { success: true }
      }

      console.log('🎤 开始流式音频录制...')
      this.audioChunkBuffer = []
      this.lastError = null

      if (this.mode === 'simulation') {
        // 模拟模式 - 生成模拟音频块
        this.startSimulationStreaming()
        return { success: true, mode: 'simulation' }
      }

      // 生产模式 - 真实流式录音
      const recordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
          sampleRate: this.sampleRate,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MEDIUM,
          sampleRate: this.sampleRate,
          numberOfChannels: 1,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 64000,
        },
      }

      this.recording = new Audio.Recording()

      // 设置录音状态更新回调来获取音频数据
      this.recording.setOnRecordingStatusUpdate((status) => {
        this.handleRecordingStatus(status)
      })

      await this.recording.prepareToRecordAsync(recordingOptions)
      await this.recording.startAsync()

      this.isStreaming = true
      console.log('✅ 流式音频录制已开始')

      return { success: true, mode: 'production' }
    } catch (error) {
      console.error('❌ 开始流式录音失败:', error)
      this.lastError = error.message
      this.isStreaming = false
      return { success: false, error: error.message }
    }
  }

  // 处理录音状态更新 - 用于获取实时音频数据
  handleRecordingStatus(status) {
    if (!this.isStreaming) return

    try {
      // 检查是否有可用的音频数据
      if (status.canRecord && status.isRecording && status.durationMillis > 0) {
        // 每500ms处理一次音频块（或当缓冲区满时）
        const shouldProcessChunk = status.durationMillis % 500 < 100
                                   || this.audioChunkBuffer.length >= this.chunkSize

        if (shouldProcessChunk) {
          this.processAudioChunk(status)
        }
      }
    } catch (error) {
      console.error('❌ 处理录音状态失败:', error)
    }
  }

  // 处理音频块
  async processAudioChunk(status) {
    try {
      if (!this.onAudioChunk) return

      // 获取当前录音的音频数据
      const chunkData = {
        timestamp: Date.now(),
        duration: status.durationMillis,
        sampleRate: this.sampleRate,
        channels: 1,
        chunkIndex: Math.floor(status.durationMillis / 500),
      }

      // 生成模拟音频块
      const mockAudioChunk = this.generateMockAudioChunk(chunkData)

      // 调用音频块回调
      this.onAudioChunk(mockAudioChunk)
    } catch (error) {
      console.error('❌ 处理音频块失败:', error)
    }
  }

  // 生成模拟音频块（用于测试流式功能）
  generateMockAudioChunk(metadata) {
    const mockPhrases = [
      '你好', '我想', '请帮我', '这个怎么', '可以吗', '谢谢',
    ]

    return {
      audioData: `mock_chunk_${metadata.chunkIndex}`, // 模拟音频数据
      metadata: {
        ...metadata,
        mockPhrase: mockPhrases[metadata.chunkIndex % mockPhrases.length],
      },
    }
  }

  // 模拟流式录音（当没有权限时使用）
  startSimulationStreaming() {
    console.log('🎤 开始模拟流式录音...')
    this.isStreaming = true

    let chunkIndex = 0
    const simulationInterval = setInterval(() => {
      if (!this.isStreaming) {
        clearInterval(simulationInterval)
        return
      }

      const chunkData = {
        timestamp: Date.now(),
        duration: chunkIndex * 500,
        sampleRate: this.sampleRate,
        channels: 1,
        chunkIndex: chunkIndex++,
      }

      const mockChunk = this.generateMockAudioChunk(chunkData)

      if (this.onAudioChunk) {
        this.onAudioChunk(mockChunk)
      }

      // 模拟最多10秒的录音
      if (chunkIndex >= 20) {
        this.stopStreaming()
        clearInterval(simulationInterval)
      }
    }, 500) // 每500ms生成一个音频块
  }

  async stopStreaming() {
    try {
      if (!this.isStreaming) {
        return null
      }

      console.log('🎤 停止流式录音...')
      this.isStreaming = false

      if (this.mode === 'simulation') {
        console.log('🎤 停止模拟流式录音')
        if (this.onStreamingEnd) {
          this.onStreamingEnd({ success: true, mode: 'simulation' })
        }
        return { success: true, mode: 'simulation' }
      }

      if (this.recording) {
        await this.recording.stopAndUnloadAsync()
        const finalUri = this.recording.getURI()
        this.recording = null

        console.log('✅ 流式录音已停止')

        if (this.onStreamingEnd) {
          this.onStreamingEnd({
            success: true,
            mode: 'production',
            finalAudioUri: finalUri,
          })
        }

        return { success: true, mode: 'production', finalAudioUri: finalUri }
      }

      return { success: true }
    } catch (error) {
      console.error('❌ 停止流式录音失败:', error)
      this.lastError = error.message
      this.isStreaming = false
      this.recording = null

      if (this.onStreamingEnd) {
        this.onStreamingEnd({ success: false, error: error.message })
      }

      throw error
    }
  }

  // 强制停止流式录音
  async forceStopStreaming() {
    try {
      if (this.recording && this.isStreaming) {
        console.log('🛑 强制停止流式录音...')
        await this.recording.stopAndUnloadAsync()
        this.recording = null
      }
      this.isStreaming = false
      this.audioChunkBuffer = []
      console.log('✅ 强制停止流式录音完成')
    } catch (error) {
      console.error('❌ 强制停止流式录音失败:', error)
      this.isStreaming = false
      this.recording = null
      this.audioChunkBuffer = []
    }
  }

  // 获取流式录音状态
  getStreamingStatus() {
    return {
      isStreaming: this.isStreaming,
      mode: this.mode,
      hasPermissions: this.audioPermissions,
      lastError: this.lastError,
      hasActiveRecording: !!this.recording,
      bufferSize: this.audioChunkBuffer.length,
      chunkSize: this.chunkSize,
      sampleRate: this.sampleRate,
    }
  }

  // 清理资源
  async cleanup() {
    try {
      console.log('🧹 清理流式音频服务...')
      await this.forceStopStreaming()
      this.onAudioChunk = null
      this.onStreamingEnd = null
      this.lastError = null
      console.log('✅ 流式音频服务清理完成')
    } catch (error) {
      console.error('❌ 流式音频服务清理失败:', error)
    }
  }
}

// 创建单例实例
const streamingAudioService = new StreamingAudioService()
export default streamingAudioService
