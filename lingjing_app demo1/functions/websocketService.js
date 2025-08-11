const express = require("express")
const http = require("http")
const WebSocket = require("ws")
const functions = require("firebase-functions")

// 使用优化后的服务，如果存在的话，否则使用原始服务
let sttService, ttsService
try {
  sttService = require("./services/sttServiceEnhanced")
  ttsService = require("./services/ttsServiceEnhanced")
  console.log("使用优化版本的STT和TTS服务")
} catch (error) {
  sttService = require("./services/sttService")
  ttsService = require("./services/ttsService")
  console.log("使用原始版本的STT和TTS服务")
}

const llmService = require("./services/llmService")

/**
 * WebSocket service for real-time voice processing
 */
class WebSocketService {
  constructor() {
    this.app = express()
    this.server = http.createServer(this.app)
    this.wss = new WebSocket.Server({ server: this.server })
    this.setupRoutes()
    this.setupWebSocket()
  }

  /**
   * Setup Express routes
   */
  setupRoutes() {
    this.app.get("/", (req, res) => {
      res.json({
        message: "WebSocket Voice Service",
        status: "running",
        endpoints: {
          websocket: "ws://your-domain/",
          health: "/health",
        },
      })
    })

    this.app.get("/health", (req, res) => {
      res.json({
        status: "healthy",
        connections: this.wss.clients.size,
        timestamp: new Date().toISOString(),
      })
    })
  }

  /**
   * Setup WebSocket server
   */
  setupWebSocket() {
    this.wss.on("connection", (ws, req) => {
      console.log("New WebSocket connection established")

      ws.on("message", async (message) => {
        try {
          await this.handleMessage(ws, message)
        } catch (error) {
          console.error("Error handling message:", error)
          ws.send(JSON.stringify({
            type: "error",
            message: error.message,
            timestamp: new Date().toISOString(),
          }))
        }
      })

      ws.on("close", () => {
        console.log("WebSocket connection closed")
      })

      ws.on("error", (error) => {
        console.error("WebSocket error:", error)
      })

      // Send welcome message
      ws.send(JSON.stringify({
        type: "connected",
        message: "WebSocket connection established",
        timestamp: new Date().toISOString(),
      }))
    })
  }

  /**
   * Handle incoming WebSocket messages
   * @param {WebSocket} ws - WebSocket connection
   * @param {Buffer} message - Incoming message
   */
  async handleMessage(ws, message) {
    const data = JSON.parse(message.toString())

    switch (data.type) {
      case "voice_input":
        await this.handleVoiceInput(ws, data)
        break
      case "ping":
        ws.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }))
        break
      default:
        ws.send(JSON.stringify({
          type: "error",
          message: `Unknown message type: ${data.type}`,
        }))
    }
  }

  /**
   * Handle voice input processing
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} data - Voice input data
   */
  async handleVoiceInput(ws, data) {
    const { 
      audio, 
      sessionId = "default",
      ttsOptions = {}
    } = data

    if (!audio) {
      throw new Error("Audio data is required")
    }

    try {
      // Send processing status
      ws.send(JSON.stringify({
        type: "status",
        status: "processing_stt",
        sessionId,
        timestamp: new Date().toISOString(),
      }))

      // Step 1: Speech to Text (使用优化版本)
      const sttOptions = {
        enableAutoLanguage: ttsOptions.enableAutoLanguage || false
      }
      const transcript = await sttService.transcribeAudio(audio, sttOptions)
      ws.send(JSON.stringify({
        type: "stt_result",
        transcript,
        sessionId,
        timestamp: new Date().toISOString(),
      }))

      // Step 2: LLM Processing
      ws.send(JSON.stringify({
        type: "status",
        status: "processing_llm",
        sessionId,
        timestamp: new Date().toISOString(),
      }))

      const llmResponse = await llmService.generateResponse(transcript)
      ws.send(JSON.stringify({
        type: "llm_result",
        response: llmResponse,
        sessionId,
        timestamp: new Date().toISOString(),
      }))

      // Step 3: Text to Speech with CosyVoice
      ws.send(JSON.stringify({
        type: "status",
        status: "processing_tts_cosyvoice",
        sessionId,
        ttsMode: ttsOptions.mode || "sft",
        timestamp: new Date().toISOString(),
      }))

      let audioUrl
      if (ttsOptions.mode && ttsOptions.mode !== "sft") {
        // Use advanced TTS modes
        audioUrl = await ttsService.generateAudioWithOptions(llmResponse, ttsOptions)
      } else {
        // Use enhanced SFT mode with auto voice selection
        const enhancedTTSOptions = {
          spkId: ttsOptions.spkId,
          enableAutoVoice: ttsOptions.enableAutoVoice !== false, // 默认启用
          gender: ttsOptions.gender || 'female'
        }
        audioUrl = await ttsService.generateAudio(llmResponse, enhancedTTSOptions)
      }

      // Send final result
      ws.send(JSON.stringify({
        type: "voice_response",
        audioUrl,
        transcript,
        response: llmResponse,
        sessionId,
        ttsMode: ttsOptions.mode || "sft",
        timestamp: new Date().toISOString(),
      }))
    } catch (error) {
      ws.send(JSON.stringify({
        type: "processing_error",
        error: error.message,
        sessionId,
        timestamp: new Date().toISOString(),
      }))
    }
  }

  /**
   * Broadcast message to all connected clients
   * @param {Object} message - Message to broadcast
   */
  broadcast(message) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message))
      }
    })
  }

  /**
   * Get Express app for Firebase Functions
   * @return {express.Application} Express app
   */
  getApp() {
    return this.app
  }

  /**
   * Get HTTP server for Firebase Functions
   * @return {http.Server} HTTP server
   */
  getServer() {
    return this.server
  }
}

// Create WebSocket service instance
const wsService = new WebSocketService()

// Export for Firebase Functions
exports.websocketApp = functions.https.onRequest(wsService.getApp())

// For local testing
if (require.main === module) {
  const PORT = process.env.PORT || 8080
  wsService.getServer().listen(PORT, () => {
    console.log(`WebSocket service running on port ${PORT}`)
  })
}