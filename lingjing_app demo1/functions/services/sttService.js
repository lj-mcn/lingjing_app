const admin = require("firebase-admin")

/**
 * STT Service for converting speech to text
 */
class STTService {
  /**
   * Constructor
   */
  constructor() {
    this.storage = admin.storage()
  }

  /**
   * Transcribe audio from base64 string
   * @param {string} audioBase64 - Base64 encoded audio data
   * @return {Promise<string>} - The transcribed text
   */
  async transcribeAudio(audioBase64) {
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
      console.error("Error in transcribeAudio:", error)
      throw new Error(`STT transcription failed: ${error.message}`)
    }
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
}

module.exports = new STTService()
