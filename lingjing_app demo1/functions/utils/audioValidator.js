/**
 * 音频质量检测和验证工具
 */
class AudioValidator {
  constructor() {
    this.minAudioSize = 1000 // 最小音频文件大小 (bytes)
    this.maxAudioSize = 10 * 1024 * 1024 // 最大音频文件大小 (10MB)
    this.minDurationMs = 100 // 最小时长 (毫秒)
    this.maxDurationMs = 60000 // 最大时长 (60秒)
  }

  /**
   * 验证音频数据基本格式
   * @param {string} audioBase64 - Base64编码的音频数据
   * @return {Object} - 验证结果
   */
  validateBasicFormat(audioBase64) {
    try {
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        return {
          isValid: false,
          error: '音频数据为空或格式错误'
        }
      }

      // 检查Base64格式
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
      if (!base64Regex.test(audioBase64)) {
        return {
          isValid: false,
          error: '音频数据不是有效的Base64格式'
        }
      }

      // 检查文件大小
      const audioBuffer = Buffer.from(audioBase64, 'base64')
      const fileSize = audioBuffer.length

      if (fileSize < this.minAudioSize) {
        return {
          isValid: false,
          error: `音频文件太小 (${fileSize} bytes)，可能录音失败`
        }
      }

      if (fileSize > this.maxAudioSize) {
        return {
          isValid: false,
          error: `音频文件太大 (${fileSize} bytes)，超过限制`
        }
      }

      return {
        isValid: true,
        fileSize,
        info: `音频文件大小: ${fileSize} bytes`
      }
    } catch (error) {
      return {
        isValid: false,
        error: `音频验证失败: ${error.message}`
      }
    }
  }

  /**
   * 检测音频格式
   * @param {Buffer} audioBuffer - 音频Buffer
   * @return {Object} - 格式检测结果
   */
  detectAudioFormat(audioBuffer) {
    try {
      const header = audioBuffer.slice(0, 12)

      // WAV格式检测 (RIFF...WAVE)
      if (header.slice(0, 4).toString() === 'RIFF' && 
          header.slice(8, 12).toString() === 'WAVE') {
        return {
          format: 'wav',
          encoding: 'LINEAR16',
          confidence: 0.9
        }
      }

      // MP3格式检测 (ID3或同步字节)
      if (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) {
        return {
          format: 'mp3',
          encoding: 'MP3',
          confidence: 0.8
        }
      }

      // WebM格式检测
      if (header.slice(0, 4).toString('hex') === '1a45dfa3') {
        return {
          format: 'webm',
          encoding: 'WEBM_OPUS',
          confidence: 0.8
        }
      }

      // OGG格式检测
      if (header.slice(0, 4).toString() === 'OggS') {
        return {
          format: 'ogg',
          encoding: 'OGG_OPUS',
          confidence: 0.8
        }
      }

      return {
        format: 'unknown',
        encoding: 'LINEAR16', // 默认格式
        confidence: 0.3
      }
    } catch (error) {
      console.error('音频格式检测失败:', error)
      return {
        format: 'unknown',
        encoding: 'LINEAR16',
        confidence: 0.1
      }
    }
  }

  /**
   * 估算音频时长（简单方法）
   * @param {Buffer} audioBuffer - 音频Buffer
   * @param {string} format - 音频格式
   * @return {number} - 估算时长（毫秒）
   */
  estimateAudioDuration(audioBuffer, format = 'wav') {
    try {
      switch (format.toLowerCase()) {
        case 'wav':
          return this.estimateWavDuration(audioBuffer)
        case 'mp3':
          return this.estimateMp3Duration(audioBuffer)
        default:
          // 基于文件大小的粗略估算
          return this.estimateDurationBySize(audioBuffer)
      }
    } catch (error) {
      console.error('时长估算失败:', error)
      return 0
    }
  }

  /**
   * 估算WAV文件时长
   * @param {Buffer} audioBuffer - 音频Buffer
   * @return {number} - 时长（毫秒）
   */
  estimateWavDuration(audioBuffer) {
    try {
      if (audioBuffer.length < 44) return 0

      // 读取WAV头信息
      const sampleRate = audioBuffer.readUInt32LE(24)
      const byteRate = audioBuffer.readUInt32LE(28)
      const dataSize = audioBuffer.length - 44 // 假设标准44字节头

      if (byteRate === 0) return 0

      const durationSeconds = dataSize / byteRate
      return Math.round(durationSeconds * 1000)
    } catch (error) {
      return this.estimateDurationBySize(audioBuffer)
    }
  }

  /**
   * 估算MP3文件时长
   * @param {Buffer} audioBuffer - 音频Buffer
   * @return {number} - 时长（毫秒）
   */
  estimateMp3Duration(audioBuffer) {
    try {
      // MP3时长估算比较复杂，这里用简化方法
      // 假设平均比特率为128kbps
      const avgBitrate = 128 * 1000 / 8 // 128kbps转换为bytes/second
      const durationSeconds = audioBuffer.length / avgBitrate
      return Math.round(durationSeconds * 1000)
    } catch (error) {
      return this.estimateDurationBySize(audioBuffer)
    }
  }

  /**
   * 基于文件大小估算时长
   * @param {Buffer} audioBuffer - 音频Buffer
   * @return {number} - 时长（毫秒）
   */
  estimateDurationBySize(audioBuffer) {
    // 非常粗略的估算：假设音频质量中等
    const avgBytesPerSecond = 16000 // 假设16KB/秒
    const durationSeconds = audioBuffer.length / avgBytesPerSecond
    return Math.round(durationSeconds * 1000)
  }

  /**
   * 完整的音频质量检测
   * @param {string} audioBase64 - Base64编码的音频数据
   * @return {Object} - 完整的检测结果
   */
  async validateAudioQuality(audioBase64) {
    try {
      // 1. 基本格式验证
      const basicValidation = this.validateBasicFormat(audioBase64)
      if (!basicValidation.isValid) {
        return basicValidation
      }

      // 2. 格式检测
      const audioBuffer = Buffer.from(audioBase64, 'base64')
      const formatInfo = this.detectAudioFormat(audioBuffer)

      // 3. 时长估算
      const estimatedDuration = this.estimateAudioDuration(audioBuffer, formatInfo.format)

      if (estimatedDuration < this.minDurationMs) {
        return {
          isValid: false,
          error: `音频时长太短 (${estimatedDuration}ms)，请录制更长的语音`
        }
      }

      if (estimatedDuration > this.maxDurationMs) {
        return {
          isValid: false,
          error: `音频时长太长 (${estimatedDuration}ms)，请录制更短的语音`
        }
      }

      return {
        isValid: true,
        fileSize: basicValidation.fileSize,
        format: formatInfo.format,
        encoding: formatInfo.encoding,
        estimatedDuration,
        confidence: formatInfo.confidence,
        info: `音频验证通过 - 格式: ${formatInfo.format}, 时长: ${estimatedDuration}ms`
      }
    } catch (error) {
      return {
        isValid: false,
        error: `音频质量检测失败: ${error.message}`
      }
    }
  }

  /**
   * 获取推荐的STT配置
   * @param {Object} audioInfo - 音频信息
   * @return {Object} - 推荐配置
   */
  getRecommendedSTTConfig(audioInfo) {
    const configs = []

    // 基于检测到的格式生成配置
    switch (audioInfo.format) {
      case 'wav':
        configs.push({
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          priority: 1
        })
        configs.push({
          encoding: 'LINEAR16',
          sampleRateHertz: 44100,
          priority: 2
        })
        break
      
      case 'webm':
        configs.push({
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          priority: 1
        })
        break
      
      case 'mp3':
        configs.push({
          encoding: 'MP3',
          sampleRateHertz: 44100,
          priority: 1
        })
        break
      
      default:
        // 通用配置
        configs.push({
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          priority: 1
        })
        configs.push({
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          priority: 2
        })
        configs.push({
          encoding: 'MP3',
          sampleRateHertz: 44100,
          priority: 3
        })
    }

    return configs.sort((a, b) => a.priority - b.priority)
  }
}

module.exports = new AudioValidator()