const admin = require("firebase-admin")
const axios = require("axios")
const FormData = require("form-data")
const cosyVoiceConfig = require("../config/cosyvoice")
const audioCache = require("../utils/audioCache")
const languageDetector = require("../utils/languageDetector")

/**
 * Enhanced TTS Service with automatic language detection and voice matching
 */
class EnhancedTTSService {
  /**
   * Constructor
   */
  constructor() {
    this.storage = admin.storage()
    // CosyVoice API 配置
    this.config = cosyVoiceConfig
    this.cosyVoiceBaseUrl = this.config.baseUrl
    this.defaultSpkId = this.config.defaults.spkId
    this.maxRetries = 3
    
    // 音色质量评级（影响选择优先级）
    this.spkIdQuality = {
      "中文女": { quality: 0.9, description: "清晰自然的中文女声" },
      "中文男": { quality: 0.85, description: "稳重的中文男声" },
      "英文女": { quality: 0.8, description: "标准美式英文女声" },
      "英文男": { quality: 0.8, description: "标准美式英文男声" },
      "日文女": { quality: 0.75, description: "温柔的日文女声" },
      "韩文女": { quality: 0.75, description: "清爽的韩文女声" }
    }
  }

  /**
   * 智能语音生成（主入口方法）
   * @param {string} text - 要转换的文本
   * @param {Object} options - 生成选项
   * @return {Promise<string>} - 生成的音频文件URL
   */
  async generateAudio(text, options = {}) {
    try {
      // 1. 检查缓存
      const textHash = audioCache.generateHash(text + JSON.stringify(options))
      const cached = audioCache.getCachedTTS(textHash)
      if (cached) {
        return cached
      }

      // 2. 文本预处理和验证
      const processedText = this.preprocessText(text)
      if (!processedText) {
        throw new Error("文本内容为空或无效")
      }

      // 3. 智能语言检测和音色选择
      const audioUrl = options.enableAutoVoice
        ? await this.generateAudioWithAutoVoice(processedText, options)
        : await this.generateAudioWithRetry(processedText, options)

      // 4. 缓存结果
      audioCache.setCachedTTS(textHash, audioUrl)
      return audioUrl
    } catch (error) {
      console.error("Error in generateAudio:", error)
      throw new Error(`TTS generation failed: ${error.message}`)
    }
  }

  /**
   * 文本预处理
   * @param {string} text - 原始文本
   * @return {string} - 处理后的文本
   */
  preprocessText(text) {
    if (!text || typeof text !== "string") {
      return ""
    }

    let processed = text.trim()
    
    // 移除多余空格
    processed = processed.replace(/\s+/g, ' ')
    
    // 处理特殊字符
    processed = processed.replace(/[""]/g, '"')
    processed = processed.replace(/['']/g, "'")
    
    // 长度检查
    if (processed.length > 1000) {
      console.log("文本过长，截取前1000字符")
      processed = processed.substring(0, 1000) + "..."
    }
    
    // 添加适当的停顿标点
    if (!/[。！？\.!?]$/.test(processed)) {
      processed += "。"
    }

    return processed
  }

  /**
   * 自动语言检测和音色匹配生成
   * @param {string} text - 要转换的文本
   * @param {Object} options - 生成选项
   * @return {Promise<string>} - 音频文件URL
   */
  async generateAudioWithAutoVoice(text, options = {}) {
    try {
      // 1. 检测文本语言
      const langDetection = languageDetector.detectTextLanguage(text)
      console.log(`检测到语言: ${langDetection.name} (置信度: ${langDetection.confidence})`)

      // 2. 根据语言选择最佳音色
      const recommendedSpkId = languageDetector.getRecommendedSpkId(
        langDetection.language,
        options.spkId,
        options.gender || 'female'
      )

      console.log(`为语言 ${langDetection.name} 选择音色: ${recommendedSpkId}`)

      // 3. 使用推荐音色生成语音
      const audioBuffer = await this.callCosyVoiceSFT(text, recommendedSpkId)
      const audioUrl = await this.uploadAudioToStorage(audioBuffer, {
        language: langDetection.language,
        spkId: recommendedSpkId,
        confidence: langDetection.confidence
      })

      return audioUrl
    } catch (error) {
      console.log("自动音色选择失败，使用默认方法:", error.message)
      return await this.generateAudioWithRetry(text, options)
    }
  }

  /**
   * 智能重试生成
   * @param {string} text - 要转换的文本
   * @param {Object} options - 生成选项
   * @return {Promise<string>} - 音频文件URL
   */
  async generateAudioWithRetry(text, options = {}) {
    const spkId = options.spkId || this.defaultSpkId
    const fallbackSpkIds = this.getFallbackSpkIds(spkId)

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const currentSpkId = fallbackSpkIds[Math.min(attempt - 1, fallbackSpkIds.length - 1)]
      
      try {
        console.log(`TTS尝试 ${attempt}/${this.maxRetries}, 音色: ${currentSpkId}`)
        
        const audioBuffer = await this.callCosyVoiceSFT(text, currentSpkId)
        const audioUrl = await this.uploadAudioToStorage(audioBuffer, {
          spkId: currentSpkId,
          attempt: attempt,
          originalSpkId: spkId
        })
        
        console.log(`TTS生成成功，音色: ${currentSpkId}`)
        return audioUrl
      } catch (error) {
        console.log(`TTS尝试 ${attempt}/${this.maxRetries} 失败:`, error.message)
        
        if (attempt === this.maxRetries) {
          throw new Error(`所有TTS尝试都失败了: ${error.message}`)
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
  }

  /**
   * 获取备用音色列表
   * @param {string} primarySpkId - 主要音色
   * @return {Array<string>} - 音色列表
   */
  getFallbackSpkIds(primarySpkId) {
    const fallbacks = [primarySpkId]
    
    // 根据音色质量排序添加备用音色
    const sortedSpkIds = Object.keys(this.spkIdQuality)
      .filter(id => id !== primarySpkId)
      .sort((a, b) => this.spkIdQuality[b].quality - this.spkIdQuality[a].quality)
    
    fallbacks.push(...sortedSpkIds.slice(0, 2)) // 添加质量最高的2个作为备用
    
    // 确保至少有默认音色
    if (!fallbacks.includes(this.defaultSpkId)) {
      fallbacks.push(this.defaultSpkId)
    }
    
    return fallbacks
  }

  /**
   * Call CosyVoice SFT API
   * @param {string} text - Text to synthesize
   * @param {string} spkId - Speaker ID
   * @return {Promise<Buffer>} - Audio buffer
   */
  async callCosyVoiceSFT(text, spkId) {
    try {
      const url = `${this.cosyVoiceBaseUrl}/inference_sft`
      const payload = {
        tts_text: text,
        spk_id: spkId,
      }

      console.log(`Calling CosyVoice SFT API: ${url}`)
      console.log(`Payload:`, payload)

      const response = await axios({
        method: "GET",
        url: url,
        data: payload,
        responseType: "stream",
        timeout: 30000, // 30 seconds timeout
      })

      return await this.collectAudioStream(response.data)
    } catch (error) {
      console.error("Error calling CosyVoice SFT API:", error)
      throw new Error(`CosyVoice SFT API call failed: ${error.message}`)
    }
  }

  /**
   * Call CosyVoice Zero-shot API
   * @param {string} text - Text to synthesize
   * @param {string} promptText - Prompt text
   * @param {Buffer} promptAudio - Prompt audio buffer
   * @return {Promise<Buffer>} - Audio buffer
   */
  async callCosyVoiceZeroShot(text, promptText, promptAudio) {
    try {
      const url = `${this.cosyVoiceBaseUrl}/inference_zero_shot`
      
      const formData = new FormData()
      formData.append("tts_text", text)
      formData.append("prompt_text", promptText)
      formData.append("prompt_wav", promptAudio, {
        filename: "prompt.wav",
        contentType: "audio/wav",
      })

      console.log(`Calling CosyVoice Zero-shot API: ${url}`)

      const response = await axios({
        method: "GET",
        url: url,
        data: formData,
        headers: {
          ...formData.getHeaders(),
        },
        responseType: "stream",
        timeout: 30000,
      })

      return this.collectAudioStream(response.data)
    } catch (error) {
      console.error("Error calling CosyVoice Zero-shot API:", error)
      throw new Error(`CosyVoice Zero-shot API call failed: ${error.message}`)
    }
  }

  /**
   * Call CosyVoice Cross-lingual API
   * @param {string} text - Text to synthesize
   * @param {Buffer} promptAudio - Prompt audio buffer
   * @return {Promise<Buffer>} - Audio buffer
   */
  async callCosyVoiceCrossLingual(text, promptAudio) {
    try {
      const url = `${this.cosyVoiceBaseUrl}/inference_cross_lingual`
      
      const formData = new FormData()
      formData.append("tts_text", text)
      formData.append("prompt_wav", promptAudio, {
        filename: "prompt.wav",
        contentType: "audio/wav",
      })

      console.log(`Calling CosyVoice Cross-lingual API: ${url}`)

      const response = await axios({
        method: "GET",
        url: url,
        data: formData,
        headers: {
          ...formData.getHeaders(),
        },
        responseType: "stream",
        timeout: 30000,
      })

      return this.collectAudioStream(response.data)
    } catch (error) {
      console.error("Error calling CosyVoice Cross-lingual API:", error)
      const errorMsg = `CosyVoice Cross-lingual API call failed: ${error.message}`
      throw new Error(errorMsg)
    }
  }

  /**
   * Call CosyVoice Instruct API
   * @param {string} text - Text to synthesize
   * @param {string} spkId - Speaker ID
   * @param {string} instructText - Instruction text
   * @return {Promise<Buffer>} - Audio buffer
   */
  async callCosyVoiceInstruct(text, spkId, instructText) {
    try {
      const url = `${this.cosyVoiceBaseUrl}/inference_instruct`
      const payload = {
        tts_text: text,
        spk_id: spkId,
        instruct_text: instructText,
      }

      console.log(`Calling CosyVoice Instruct API: ${url}`)

      const response = await axios({
        method: "GET",
        url: url,
        data: payload,
        responseType: "stream",
        timeout: 30000,
      })

      return this.collectAudioStream(response.data)
    } catch (error) {
      console.error("Error calling CosyVoice Instruct API:", error)
      throw new Error(`CosyVoice Instruct API call failed: ${error.message}`)
    }
  }

  /**
   * Collect audio stream data
   * @param {Stream} stream - Audio stream
   * @return {Promise<Buffer>} - Audio buffer
   */
  async collectAudioStream(stream) {
    const audioChunks = []
    
    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => {
        audioChunks.push(chunk)
      })

      stream.on("end", () => {
        const audioBuffer = Buffer.concat(audioChunks)
        console.log(`Received audio buffer of size: ${audioBuffer.length} bytes`)
        resolve(audioBuffer)
      })

      stream.on("error", (error) => {
        console.error("Error receiving audio stream:", error)
        reject(error)
      })
    })
  }

  /**
   * Upload audio buffer to Firebase Storage
   * @param {Buffer} audioBuffer - Audio data buffer
   * @param {Object} metadata - Additional metadata
   * @return {Promise<string>} - Download URL
   */
  async uploadAudioToStorage(audioBuffer, metadata = {}) {
    try {
      // Generate unique filename
      const timestamp = Date.now()
      const spkIdSafe = (metadata.spkId || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')
      const fileName = `tts_cosyvoice_${spkIdSafe}_${timestamp}.wav`
      const filePath = `audio/${fileName}`

      // Upload to Firebase Storage
      const bucket = this.storage.bucket()
      const file = bucket.file(filePath)
      
      await file.save(audioBuffer, {
        metadata: {
          contentType: "audio/wav",
          customMetadata: {
            ...metadata,
            generatedAt: new Date().toISOString(),
            service: 'enhanced-tts'
          }
        },
      })

      // Get download URL
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      })

      console.log(`音频文件已上传: ${fileName}`)
      return url
    } catch (error) {
      console.error("Error uploading audio to storage:", error)
      throw new Error(`Audio upload failed: ${error.message}`)
    }
  }

  /**
   * Generate audio using different modes based on options
   * @param {string} text - Text to synthesize
   * @param {Object} options - Generation options
   * @return {Promise<string>} - Audio URL
   */
  async generateAudioWithOptions(text, options = {}) {
    const { mode = "sft", spkId, promptText, promptAudio, instructText } = options

    // 预处理文本
    const processedText = this.preprocessText(text)
    if (!processedText) {
      throw new Error("文本内容为空或无效")
    }

    switch (mode) {
      case "sft":
        return this.generateAudio(processedText, { spkId, enableAutoVoice: options.enableAutoVoice })
      case "zero_shot":
        if (!promptText || !promptAudio) {
          throw new Error("Zero-shot mode requires promptText and promptAudio")
        }
        return this.generateAudioZeroShot(processedText, promptText, promptAudio)
      case "cross_lingual":
        if (!promptAudio) {
          throw new Error("Cross-lingual mode requires promptAudio")
        }
        return this.generateAudioCrossLingual(processedText, promptAudio)
      case "instruct":
        if (!spkId || !instructText) {
          throw new Error("Instruct mode requires spkId and instructText")
        }
        return this.generateAudioInstruct(processedText, spkId, instructText)
      default:
        throw new Error(`Unknown TTS mode: ${mode}`)
    }
  }

  /**
   * Zero-shot audio generation
   * @param {string} text - Text to synthesize
   * @param {string} promptText - Prompt text
   * @param {Buffer} promptAudio - Prompt audio
   * @return {Promise<string>} - Audio URL
   */
  async generateAudioZeroShot(text, promptText, promptAudio) {
    const audioBuffer = await this.callCosyVoiceZeroShot(text, promptText, promptAudio)
    return await this.uploadAudioToStorage(audioBuffer, { mode: 'zero_shot' })
  }

  /**
   * Cross-lingual audio generation
   * @param {string} text - Text to synthesize
   * @param {Buffer} promptAudio - Prompt audio
   * @return {Promise<string>} - Audio URL
   */
  async generateAudioCrossLingual(text, promptAudio) {
    const audioBuffer = await this.callCosyVoiceCrossLingual(text, promptAudio)
    return await this.uploadAudioToStorage(audioBuffer, { mode: 'cross_lingual' })
  }

  /**
   * Instruct audio generation
   * @param {string} text - Text to synthesize
   * @param {string} spkId - Speaker ID
   * @param {string} instructText - Instruction text
   * @return {Promise<string>} - Audio URL
   */
  async generateAudioInstruct(text, spkId, instructText) {
    const audioBuffer = await this.callCosyVoiceInstruct(text, spkId, instructText)
    return await this.uploadAudioToStorage(audioBuffer, { mode: 'instruct', spkId, instructText })
  }

  /**
   * 批量生成多个文本的音频
   * @param {Array} requests - 请求数组 [{text, options}, ...]
   * @return {Promise<Array>} - 结果数组
   */
  async batchGenerateAudio(requests) {
    const results = await Promise.all(
      requests.map(async (request, index) => {
        try {
          const audioUrl = await this.generateAudio(request.text, request.options || {})
          return {
            index,
            success: true,
            audioUrl: audioUrl,
            text: request.text.substring(0, 50) + (request.text.length > 50 ? '...' : '')
          }
        } catch (error) {
          return {
            index,
            success: false,
            error: error.message,
            text: request.text.substring(0, 50) + (request.text.length > 50 ? '...' : '')
          }
        }
      })
    )
    return results
  }

  /**
   * Simple audio generation fallback (for testing)
   * @param {string} text - The text to convert to speech
   * @return {Promise<Object>} - Response with audio info
   */
  async generateSimpleAudio(text) {
    try {
      // Simplified implementation for testing
      const audioData = {
        text,
        voice: this.defaultSpkId,
        format: "wav",
        timestamp: Date.now(),
      }

      console.log("Generating simple audio response...")

      return {
        success: true,
        audioUrl: `${this.cosyVoiceBaseUrl}/mock/${audioData.timestamp}.wav`,
        metadata: audioData,
      }
    } catch (error) {
      console.error("Error in generateSimpleAudio:", error)
      throw new Error(`Simple TTS generation failed: ${error.message}`)
    }
  }

  /**
   * 获取服务统计信息
   * @return {Object} - 服务统计
   */
  getServiceStats() {
    return {
      supportedModes: ['sft', 'zero_shot', 'cross_lingual', 'instruct'],
      availableSpkIds: Object.keys(this.spkIdQuality),
      spkIdQuality: this.spkIdQuality,
      supportedLanguages: languageDetector.getSupportedLanguages(),
      maxRetries: this.maxRetries,
      cacheStats: audioCache.getCacheStats()
    }
  }

  /**
   * 获取推荐的音色和语言组合
   * @param {string} text - 文本内容
   * @return {Object} - 推荐结果
   */
  getRecommendations(text) {
    const langDetection = languageDetector.detectTextLanguage(text)
    const availableSpkIds = languageDetector.getAvailableSpkIds(langDetection.language)
    const recommendedSpkId = languageDetector.getRecommendedSpkId(langDetection.language)

    return {
      detectedLanguage: langDetection,
      recommendedSpkId: recommendedSpkId,
      availableSpkIds: availableSpkIds,
      qualityInfo: this.spkIdQuality[recommendedSpkId] || null
    }
  }
}

module.exports = new EnhancedTTSService()