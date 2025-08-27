import appConfig from '../../config/AppConfig'
import siliconFlowSTT from '../voice/SiliconFlowSTT'

class StreamingSTTService {
  constructor() {
    this.config = {
      api_endpoint: appConfig.siliconflow?.stt?.endpoint || 'https://api.siliconflow.cn/v1/audio/transcriptions',
      model: appConfig.siliconflow?.stt?.model || 'FunAudioLLM/SenseVoiceSmall',
      api_key: appConfig.siliconflow?.api_key,
      enabled: appConfig.siliconflow?.stt?.enabled || false,
    }

    this.audioChunks = []
    this.isProcessing = false
    this.partialTranscripts = []
    this.onPartialTranscript = null // 部分转录回调
    this.onFinalTranscript = null // 完整转录回调
    this.onError = null // 错误回调

    // 流式处理配置 - 优化为更实时的处理
    this.chunkProcessingInterval = 300 // 每300ms处理一次音频块（更频繁）
    this.minChunkDuration = 200 // 最小处理块长度(ms)（更短）
    this.maxBufferDuration = 1500 // 最大缓冲时长(ms)（更短，减少延迟）

    // 新增：重叠处理和增量识别
    this.enableOverlapProcessing = true // 启用重叠处理
    this.overlapDuration = 500 // 重叠时长
    this.incrementalRecognition = true // 启用增量识别

    this.processingTimer = null
    this.transcriptionBuffer = '' // 转录文本缓冲区
  }

  // 设置回调函数
  setCallbacks({ onPartialTranscript, onFinalTranscript, onError }) {
    this.onPartialTranscript = onPartialTranscript
    this.onFinalTranscript = onFinalTranscript
    this.onError = onError
  }

  // 开始流式STT处理
  async startStreaming() {
    try {
      console.log('🎤 启动流式语音识别...')

      if (this.isProcessing) {
        console.log('流式STT已在运行中')
        return { success: true }
      }

      this.isProcessing = true
      this.audioChunks = []
      this.partialTranscripts = []
      this.transcriptionBuffer = ''

      // 开始定期处理音频块
      this.startChunkProcessing()

      console.log('✅ 流式STT已启动')
      return { success: true }
    } catch (error) {
      console.error('❌ 启动流式STT失败:', error)
      this.isProcessing = false
      return { success: false, error: error.message }
    }
  }

  // 添加音频块到处理队列
  async addAudioChunk(audioChunk) {
    if (!this.isProcessing) return

    try {
      // 添加时间戳
      const timestampedChunk = {
        ...audioChunk,
        receivedAt: Date.now(),
      }

      this.audioChunks.push(timestampedChunk)

      // 如果缓冲区过大，立即处理
      const bufferDuration = this.calculateBufferDuration()
      if (bufferDuration > this.maxBufferDuration) {
        await this.processAccumulatedChunks()
      }
    } catch (error) {
      console.error('❌ 添加音频块失败:', error)
      if (this.onError) {
        this.onError(error)
      }
    }
  }

  // 开始定期处理音频块
  startChunkProcessing() {
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
    }

    this.processingTimer = setInterval(async () => {
      if (this.audioChunks.length > 0) {
        await this.processAccumulatedChunks()
      }
    }, this.chunkProcessingInterval)
  }

  // 处理累积的音频块 - 优化为更智能的增量处理
  async processAccumulatedChunks() {
    if (this.audioChunks.length === 0) return

    try {
      console.log(`🔄 处理 ${this.audioChunks.length} 个音频块...`)

      const bufferDuration = this.calculateBufferDuration()
      if (bufferDuration < this.minChunkDuration) {
        console.log(`⏳ 音频块时长不足 ${this.minChunkDuration}ms，等待更多数据`)
        return
      }

      // 增量处理：使用重叠窗口提高识别连续性
      const chunksToProcess = this.enableOverlapProcessing
        ? this.getOverlappedChunks()
        : this.audioChunks

      // 合并音频块
      const combinedAudio = this.combineAudioChunks(chunksToProcess)

      // 创建临时音频文件用于STT处理
      const tempAudioUri = await this.createTempAudioFile(combinedAudio)

      // 使用现有的STT服务处理
      const sttResult = await siliconFlowSTT.speechToText(tempAudioUri)

      if (sttResult.success && sttResult.text) {
        const newText = sttResult.text.trim()

        // 智能文本对比和增量更新
        const updatedText = this.processIncrementalText(newText)

        if (updatedText && updatedText !== this.transcriptionBuffer) {
          // 检测是否是真正的新内容
          const isSignificantUpdate = this.isSignificantTextUpdate(updatedText)

          if (isSignificantUpdate) {
            this.transcriptionBuffer = updatedText
            this.partialTranscripts.push({
              text: updatedText,
              timestamp: Date.now(),
              confidence: 1.0,
              isFinal: false,
              isIncremental: true,
            })

            console.log(`📝 增量转录: ${updatedText}`)

            // 触发部分转录回调
            if (this.onPartialTranscript) {
              this.onPartialTranscript({
                text: updatedText,
                isFinal: false,
                timestamp: Date.now(),
                isIncremental: true,
              })
            }
          }
        }
      }

      // 智能清理：保留适当的重叠用于下次处理
      this.smartCleanupAudioChunks()
    } catch (error) {
      console.error('❌ 处理音频块失败:', error)
      if (this.onError) {
        this.onError(error)
      }
    }
  }

  // 获取重叠的音频块，提高识别连续性
  getOverlappedChunks() {
    if (!this.enableOverlapProcessing || this.audioChunks.length <= 1) {
      return this.audioChunks
    }

    // 计算重叠起始点
    const totalDuration = this.calculateBufferDuration()
    const overlapStart = Math.max(0, totalDuration - this.overlapDuration)

    // 找到重叠起始点对应的音频块索引
    let overlapIndex = 0
    let currentDuration = 0

    for (let i = 0; i < this.audioChunks.length; i++) {
      if (currentDuration >= overlapStart) {
        overlapIndex = i
        break
      }
      currentDuration += this.audioChunks[i].duration || 100 // 估算时长
    }

    return this.audioChunks.slice(Math.max(0, overlapIndex - 1))
  }

  // 处理增量文本，提取新增部分
  processIncrementalText(newText) {
    if (!this.incrementalRecognition || !this.transcriptionBuffer) {
      return newText
    }

    // 如果新文本包含之前的内容，提取增量部分
    if (newText.includes(this.transcriptionBuffer)) {
      const increment = newText.substring(this.transcriptionBuffer.length).trim()
      return increment ? `${this.transcriptionBuffer} ${increment}` : this.transcriptionBuffer
    }

    // 如果是完全不同的文本，可能是新的语音段
    if (newText.length > this.transcriptionBuffer.length * 1.5) {
      return newText
    }

    return this.transcriptionBuffer
  }

  // 判断是否是重要的文本更新
  isSignificantTextUpdate(newText) {
    if (!this.transcriptionBuffer) return true

    // 长度差异检查
    const lengthDiff = Math.abs(newText.length - this.transcriptionBuffer.length)
    if (lengthDiff < 3) return false // 变化太小

    // 内容差异检查
    const similarity = this.calculateTextSimilarity(newText, this.transcriptionBuffer)
    return similarity < 0.95 // 相似度低于95%认为是重要更新
  }

  // 计算文本相似度
  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0

    const maxLength = Math.max(text1.length, text2.length)
    if (maxLength === 0) return 1

    // 简单的编辑距离计算
    const distance = this.levenshteinDistance(text1, text2)
    return 1 - distance / maxLength
  }

  // 计算编辑距离
  levenshteinDistance(str1, str2) {
    const matrix = []
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  // 智能清理音频块
  smartCleanupAudioChunks() {
    if (this.audioChunks.length <= 3) return

    // 保留最近的2-3个块用于重叠处理
    const keepRecentChunks = this.enableOverlapProcessing ? 3 : 2
    this.audioChunks = this.audioChunks.slice(-keepRecentChunks)
  }

  // 计算缓冲区总时长
  calculateBufferDuration() {
    if (this.audioChunks.length === 0) return 0

    const firstChunk = this.audioChunks[0]
    const lastChunk = this.audioChunks[this.audioChunks.length - 1]

    return lastChunk.receivedAt - firstChunk.receivedAt
  }

  // 合并音频块
  combineAudioChunks(chunks) {
    // 在真实实现中，这里需要将音频数据合并成一个连续的音频文件
    // 现在先返回模拟的合并数据
    return {
      duration: this.calculateBufferDuration(),
      chunkCount: chunks.length,
      combinedData: chunks.map((c) => c.audioData).join(''),
    }
  }

  // 创建临时音频文件
  async createTempAudioFile(combinedAudio) {
    // 在真实实现中，需要将合并的音频数据写入临时文件
    // 现在先返回模拟的文件路径，用于测试
    const tempFileName = `temp_streaming_${Date.now()}.wav`
    const tempUri = `file://temp/${tempFileName}`

    console.log(`📁 创建临时音频文件: ${tempFileName}`)

    // 模拟文件创建成功
    return tempUri
  }

  // 停止流式STT处理
  async stopStreaming() {
    try {
      console.log('🛑 停止流式STT处理...')

      this.isProcessing = false

      // 清理定时器
      if (this.processingTimer) {
        clearInterval(this.processingTimer)
        this.processingTimer = null
      }

      // 处理剩余的音频块
      if (this.audioChunks.length > 0) {
        console.log('🔄 处理剩余音频块...')
        await this.processAccumulatedChunks()
      }

      // 发送最终转录结果
      if (this.transcriptionBuffer && this.onFinalTranscript) {
        console.log(`📝 最终转录: ${this.transcriptionBuffer}`)
        this.onFinalTranscript({
          text: this.transcriptionBuffer,
          isFinal: true,
          timestamp: Date.now(),
          partialCount: this.partialTranscripts.length,
        })
      }

      // 清理状态
      this.audioChunks = []
      this.partialTranscripts = []

      console.log('✅ 流式STT处理已停止')
      return {
        success: true,
        finalText: this.transcriptionBuffer,
        partialCount: this.partialTranscripts.length,
      }
    } catch (error) {
      console.error('❌ 停止流式STT失败:', error)
      this.isProcessing = false
      return { success: false, error: error.message }
    }
  }

  // 强制停止并重置
  async forceStop() {
    this.isProcessing = false

    if (this.processingTimer) {
      clearInterval(this.processingTimer)
      this.processingTimer = null
    }

    this.audioChunks = []
    this.partialTranscripts = []
    this.transcriptionBuffer = ''

    console.log('🛑 强制停止流式STT完成')
  }

  // 检查服务是否可用
  isAvailable() {
    return !!(this.config.enabled && this.config.api_key && this.config.api_endpoint)
  }

  // 获取当前转录状态
  getCurrentTranscription() {
    return {
      currentText: this.transcriptionBuffer,
      partialTranscripts: this.partialTranscripts,
      isProcessing: this.isProcessing,
      bufferChunks: this.audioChunks.length,
    }
  }

  // 清理资源
  async cleanup() {
    try {
      console.log('🧹 清理流式STT服务...')
      await this.forceStop()
      this.onPartialTranscript = null
      this.onFinalTranscript = null
      this.onError = null
      console.log('✅ 流式STT服务清理完成')
    } catch (error) {
      console.error('❌ 流式STT服务清理失败:', error)
    }
  }
}

// 创建单例实例
const streamingSTTService = new StreamingSTTService()
export default streamingSTTService
