const admin = require("firebase-admin")
const axios = require("axios")
const FormData = require("form-data")
const cosyVoiceConfig = require("../config/cosyvoice")

/**
 * TTS Service for generating audio from text using CosyVoice
 */
class TTSService {
  /**
   * Constructor
   */
  constructor() {
    this.storage = admin.storage()
    // CosyVoice API 配置
    this.config = cosyVoiceConfig
    this.cosyVoiceBaseUrl = this.config.baseUrl
    this.defaultSpkId = this.config.defaults.spkId
  }

  /**
   * Generate audio from text using CosyVoice SFT mode
   * @param {string} text - The text to convert to speech
   * @param {string} spkId - Speaker ID (optional)
   * @return {Promise<string>} - The URL of the generated audio file
   */
  async generateAudio(text, spkId = null) {
    try {
      if (!text || typeof text !== "string") {
        throw new Error("Text input is required and must be a string")
      }

      console.log(`Generating audio with CosyVoice for text: ${text.substring(0, 100)}...`)

      // 调用 CosyVoice SFT 模式
      const audioBuffer = await this.callCosyVoiceSFT(text, spkId || this.defaultSpkId)
      
      // 上传到 Firebase Storage
      const audioUrl = await this.uploadAudioToStorage(audioBuffer)
      
      console.log(`Audio generated successfully: ${audioUrl}`)
      return audioUrl
    } catch (error) {
      console.error("Error in generateAudio:", error)
      throw new Error(`TTS generation failed: ${error.message}`)
    }
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

      // 收集流式音频数据
      const audioChunks = []
      
      return new Promise((resolve, reject) => {
        response.data.on("data", (chunk) => {
          audioChunks.push(chunk)
        })

        response.data.on("end", () => {
          const audioBuffer = Buffer.concat(audioChunks)
          console.log(`Received audio buffer of size: ${audioBuffer.length} bytes`)
          resolve(audioBuffer)
        })

        response.data.on("error", (error) => {
          console.error("Error receiving audio stream:", error)
          reject(error)
        })
      })
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
   * @return {Promise<string>} - Download URL
   */
  async uploadAudioToStorage(audioBuffer) {
    try {
      // Generate unique filename
      const timestamp = Date.now()
      const fileName = `tts_cosyvoice_${timestamp}.wav`
      const filePath = `audio/${fileName}`

      // Upload to Firebase Storage
      const bucket = this.storage.bucket()
      const file = bucket.file(filePath)
      
      await file.save(audioBuffer, {
        metadata: {
          contentType: "audio/wav",
        },
      })

      // Get download URL
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      })

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

    switch (mode) {
      case "sft":
        return this.generateAudio(text, spkId)
      case "zero_shot":
        if (!promptText || !promptAudio) {
          throw new Error("Zero-shot mode requires promptText and promptAudio")
        }
        return this.generateAudioZeroShot(text, promptText, promptAudio)
      case "cross_lingual":
        if (!promptAudio) {
          throw new Error("Cross-lingual mode requires promptAudio")
        }
        return this.generateAudioCrossLingual(text, promptAudio)
      case "instruct":
        if (!spkId || !instructText) {
          throw new Error("Instruct mode requires spkId and instructText")
        }
        return this.generateAudioInstruct(text, spkId, instructText)
      default:
        throw new Error(`Unknown TTS mode: ${mode}`)
    }
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
}

module.exports = new TTSService()