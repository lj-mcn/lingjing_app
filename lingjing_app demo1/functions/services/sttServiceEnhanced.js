const admin = require("firebase-admin")
const audioCache = require("../utils/audioCache")
const audioValidator = require("../utils/audioValidator")

/**
 * Enhanced STT Service with VAD, multi-language support, and intelligent retry
 */
class EnhancedSTTService {
  /**
   * Constructor
   */
  constructor() {
    this.storage = admin.storage()
    this.supportedLanguages = [
      { code: "zh-CN", name: "中文（简体）", priority: 1 },
      { code: "en-US", name: "英文（美国）", priority: 2 },
      { code: "ja-JP", name: "日文", priority: 3 },
      { code: "ko-KR", name: "韩文", priority: 4 },
      { code: "zh-TW", name: "中文（繁体）", priority: 5 }
    ]
    this.maxRetries = 3
  }

  /**
   * 智能语音转文字（主入口方法）
   * @param {string} audioBase64 - Base64 encoded audio data
   * @param {Object} options - 转换选项
   * @return {Promise<string>} - The transcribed text
   */
  async transcribeAudio(audioBase64, options = {}) {
    try {
      // 1. 检查缓存
      const audioHash = audioCache.generateHash(audioBase64)
      const cached = audioCache.getCachedSTT(audioHash)
      if (cached) {
        return cached
      }

      // 2. 音频质量检测
      const audioValidation = await audioValidator.validateAudioQuality(audioBase64)
      if (!audioValidation.isValid) {
        throw new Error(audioValidation.error)
      }

      // 3. VAD检测（简单实现）
      const hasVoice = await this.detectVoiceActivity(audioBase64, audioValidation)
      if (!hasVoice) {
        const result = "没有检测到语音活动，请重新录音"
        audioCache.setCachedSTT(audioHash, result)
        return result
      }

      // 4. 智能转录
      const result = options.enableAutoLanguage 
        ? await this.transcribeWithAutoLanguage(audioBase64, audioValidation)
        : await this.transcribeWithRetry(audioBase64, audioValidation)

      // 5. 缓存结果
      audioCache.setCachedSTT(audioHash, result)
      return result
    } catch (error) {
      console.error("Error in transcribeAudio:", error)
      throw new Error(`STT transcription failed: ${error.message}`)
    }
  }

  /**
   * 检测语音活动（VAD）
   * @param {string} audioBase64 - Base64编码的音频数据
   * @param {Object} audioInfo - 音频信息
   * @return {Promise<boolean>} - 是否检测到语音
   */
  async detectVoiceActivity(audioBase64, audioInfo) {
    try {
      // 简单的VAD实现：基于音频大小和时长
      if (audioInfo.fileSize < 2000) {
        console.log("音频文件太小，可能没有语音")
        return false
      }

      if (audioInfo.estimatedDuration < 200) {
        console.log("音频时长太短，可能没有语音")
        return false
      }

      // TODO: 可以集成更复杂的VAD算法
      // 比如调用专门的VAD服务或使用WebRTC VAD
      
      console.log("VAD检测通过，音频包含语音")
      return true
    } catch (error) {
      console.error("VAD检测失败:", error)
      // 如果VAD检测失败，假设有语音
      return true
    }
  }

  /**
   * 多语言自动检测转录
   * @param {string} audioBase64 - Base64编码的音频数据
   * @param {Object} audioInfo - 音频信息
   * @return {Promise<string>} - 转录结果
   */
  async transcribeWithAutoLanguage(audioBase64, audioInfo) {
    const configs = audioValidator.getRecommendedSTTConfig(audioInfo)
    
    // 按语言优先级尝试
    for (const language of this.supportedLanguages) {
      for (const config of configs.slice(0, 2)) { // 只尝试前2个配置
        try {
          console.log(`尝试语言: ${language.name}, 格式: ${config.encoding}`)
          
          const result = await this.transcribeWithSpecificConfig(audioBase64, {
            ...config,
            languageCode: language.code,
            alternativeLanguageCodes: []
          })
          
          if (result && !result.includes("没有听清楚") && result.length > 2) {
            console.log(`成功识别，语言: ${language.name}, 结果: ${result}`)
            return result
          }
        } catch (error) {
          console.log(`语言 ${language.name} 识别失败:`, error.message)
          continue
        }
      }
    }
    
    // 如果所有语言都失败，使用默认方法
    return await this.transcribeWithRetry(audioBase64, audioInfo)
  }

  /**
   * 智能重试转录
   * @param {string} audioBase64 - Base64编码的音频数据
   * @param {Object} audioInfo - 音频信息
   * @return {Promise<string>} - 转录结果
   */
  async transcribeWithRetry(audioBase64, audioInfo) {
    const configs = audioValidator.getRecommendedSTTConfig(audioInfo)
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const config = configs[Math.min(attempt - 1, configs.length - 1)]
      
      try {
        console.log(`STT尝试 ${attempt}/${this.maxRetries}, 配置:`, config)
        
        const result = await this.transcribeWithSpecificConfig(audioBase64, {
          encoding: config.encoding,
          sampleRateHertz: config.sampleRateHertz,
          languageCode: "zh-CN",
          alternativeLanguageCodes: ["en-US"],
          enableAutomaticPunctuation: true,
          model: "latest_long"
        })
        
        if (result && !result.includes("没有听清楚")) {
          return result
        }
      } catch (error) {
        console.log(`STT尝试 ${attempt}/${this.maxRetries} 失败:`, error.message)
        
        if (attempt === this.maxRetries) {
          return "抱歉，语音识别服务暂时不可用，请稍后再试"
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
    
    return "抱歉，无法识别您的语音，请重新录音"
  }

  /**
   * 使用特定配置进行转录
   * @param {string} audioBase64 - Base64编码的音频数据
   * @param {Object} config - STT配置
   * @return {Promise<string>} - 转录结果
   */
  async transcribeWithSpecificConfig(audioBase64, config) {
    const speech = require("@google-cloud/speech")
    const client = new speech.SpeechClient()

    const audioBuffer = Buffer.from(audioBase64, "base64")

    const request = {
      audio: {
        content: audioBuffer,
      },
      config: config,
    }

    const [response] = await client.recognize(request)

    if (!response.results || response.results.length === 0) {
      return "抱歉，我没有听清楚您说的话，请再试一次。"
    }

    const transcript = response.results
        .map((result) => result.alternatives[0].transcript)
        .join(" ")
        .trim()

    return transcript || "抱歉，我没有听清楚您说的话，请再试一次。"
  }

  /**
   * 原始转录方法（保持兼容性）
   * @param {string} audioBase64 - Base64 encoded audio data
   * @return {Promise<string>} - The transcribed text
   */
  async transcribeAudioOriginal(audioBase64) {
    try {
      if (!audioBase64 || typeof audioBase64 !== "string") {
        throw new Error("Audio data is required and must be a base64 string")
      }

      console.log("Starting audio transcription...")

      // Use Google Cloud Speech-to-Text API
      const speech = require("@google-cloud/speech")
      const client = new speech.SpeechClient()

      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioBase64, "base64")

      const request = {
        audio: {
          content: audioBuffer,
        },
        config: {
          encoding: "WEBM_OPUS", // Common format for web audio
          sampleRateHertz: 48000,
          languageCode: "zh-CN", // Chinese
          alternativeLanguageCodes: ["en-US"], // Fallback to English
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: false,
          model: "latest_long", // Use latest model for better accuracy
        },
      }

      const [response] = await client.recognize(request)

      if (!response.results || response.results.length === 0) {
        console.log("No speech detected in audio")
        return "抱歉，我没有听清楚您说的话，请再试一次。"
      }

      // Get the transcript from the first result
      const transcript = response.results
          .map((result) => result.alternatives[0].transcript)
          .join(" ")
          .trim()

      if (!transcript) {
        console.log("Empty transcript received")
        return "抱歉，我没有听清楚您说的话，请再试一次。"
      }

      console.log(`STT transcription result: ${transcript}`)
      return transcript
    } catch (error) {
      console.error("Error in transcribeAudioOriginal:", error)
      throw new Error(`STT transcription failed: ${error.message}`)
    }
  }

  /**
   * 批量处理多个音频请求
   * @param {Array} audioRequests - 音频请求数组
   * @return {Promise<Array>} - 处理结果数组
   */
  async processConcurrentAudio(audioRequests) {
    const results = await Promise.all(
      audioRequests.map(async (request) => {
        try {
          const result = await this.transcribeAudio(request.audio, request.options || {})
          return {
            id: request.id,
            success: true,
            result: result
          }
        } catch (error) {
          return { 
            id: request.id,
            success: false,
            error: error.message 
          }
        }
      })
    )
    return results
  }

  /**
   * Transcribe audio with different encoding formats
   * @param {string} audioBase64 - Base64 encoded audio data
   * @param {Object} options - Transcription options
   * @return {Promise<string>} - The transcribed text
   */
  async transcribeWithOptions(audioBase64, options = {}) {
    try {
      const {
        encoding = "WEBM_OPUS",
        sampleRateHertz = 48000,
        languageCode = "zh-CN",
        enableAutomaticPunctuation = true,
      } = options

      const optionsStr = JSON.stringify(options)
      console.log(`Transcribing with custom options: ${optionsStr}`)

      const speech = require("@google-cloud/speech")
      const client = new speech.SpeechClient()

      const audioBuffer = Buffer.from(audioBase64, "base64")

      const request = {
        audio: {
          content: audioBuffer,
        },
        config: {
          encoding,
          sampleRateHertz,
          languageCode,
          enableAutomaticPunctuation,
          model: "latest_long",
        },
      }

      const [response] = await client.recognize(request)

      if (!response.results || response.results.length === 0) {
        return "抱歉，我没有听清楚您说的话，请再试一次。"
      }

      const transcript = response.results
          .map((result) => result.alternatives[0].transcript)
          .join(" ")
          .trim()

      return transcript || "抱歉，我没有听清楚您说的话，请再试一次。"
    } catch (error) {
      console.error("Error in transcribeWithOptions:", error)
      const errorMsg = `STT transcription with options failed: ${error.message}`
      throw new Error(errorMsg)
    }
  }

  /**
   * Simple transcription for testing purposes
   * @param {string} audioBase64 - Base64 encoded audio data
   * @return {Promise<string>} - Mock transcribed text
   */
  async transcribeSimple(audioBase64) {
    try {
      if (!audioBase64) {
        throw new Error("Audio data is required")
      }

      // Mock responses for testing
      const mockResponses = [
        "你好，我想询问一些问题。",
        "今天天气怎么样？",
        "请帮我查询相关信息。",
        "谢谢你的帮助。",
      ]

      const randomIndex = Math.floor(Math.random() * mockResponses.length)
      const mockTranscript = mockResponses[randomIndex]

      console.log(`Mock STT result: ${mockTranscript}`)
      return mockTranscript
    } catch (error) {
      console.error("Error in transcribeSimple:", error)
      throw new Error(`Simple STT transcription failed: ${error.message}`)
    }
  }

  /**
   * 获取服务统计信息
   * @return {Object} - 服务统计
   */
  getServiceStats() {
    return {
      supportedLanguages: this.supportedLanguages,
      maxRetries: this.maxRetries,
      cacheStats: audioCache.getCacheStats()
    }
  }
}

module.exports = new EnhancedSTTService()