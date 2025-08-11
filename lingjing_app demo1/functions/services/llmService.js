class LLMService {
  constructor() {
    // 添加LLM API配置
    this.apiUrl = process.env.LLM_API_URL || "ws://localhost:8765"
    this.apiKey = process.env.LLM_API_KEY || ""
    this.model = process.env.LLM_MODEL || "Qwen2.5-1.5B-Instruct"
    this.axios = require("axios")
  }

  async generateResponse(userPrompt) {
    try {
      if (!userPrompt || typeof userPrompt !== "string") {
        throw new Error("User prompt is required and must be a string")
      }

      console.log(`Generating LLM response for: ${userPrompt.substring(0, 100)}...`)

      // 调用真实的LLM API
      const response = await this.callLLMAPI(userPrompt)
      
      console.log(`LLM generated response: ${response.substring(0, 100)}...`)
      return response
    } catch (error) {
      console.error("Error in generateResponse:", error)
      // 提供fallback响应
      return this.getFallbackResponse(userPrompt)
    }
  }

  async callLLMAPI(prompt) {
    try {
      // 如果是WebSocket URL，使用WebSocket连接调用QWen2.5模型
      if (this.apiUrl.startsWith("ws://") || this.apiUrl.startsWith("wss://")) {
        return await this.callLLMViaWebSocket(prompt)
      }
      
      // 如果是HTTP API，使用HTTP请求
      const response = await this.axios.post(this.apiUrl, {
        prompt: prompt,
        model: this.model,
        max_tokens: 1000,
        temperature: 0.7
      }, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": this.apiKey ? `Bearer ${this.apiKey}` : undefined
        },
        timeout: 30000
      })

      return response.data.response || response.data.content || response.data.text || "抱歉，我暂时无法回应。"
    } catch (error) {
      console.error("LLM API call failed:", error)
      throw error
    }
  }

  async callLLMViaWebSocket(prompt) {
    return new Promise((resolve, reject) => {
      const WebSocket = require("ws")
      const ws = new WebSocket(this.apiUrl)
      
      let responseReceived = false
      const timeout = setTimeout(() => {
        if (!responseReceived) {
          ws.close()
          reject(new Error("LLM WebSocket timeout"))
        }
      }, 30000)

      ws.on("open", () => {
        console.log("Connected to LLM WebSocket service")
        ws.send(JSON.stringify({
          type: "text",
          data: prompt,
          model: this.model
        }))
      })

      ws.on("message", (data) => {
        try {
          const result = JSON.parse(data.toString())
          if (result.status === "success" && result.llm_response) {
            responseReceived = true
            clearTimeout(timeout)
            ws.close()
            resolve(result.llm_response)
          } else if (result.status === "error") {
            responseReceived = true
            clearTimeout(timeout)
            ws.close()
            reject(new Error(result.message || "LLM processing failed"))
          }
        } catch (error) {
          responseReceived = true
          clearTimeout(timeout)
          ws.close()
          reject(error)
        }
      })

      ws.on("error", (error) => {
        responseReceived = true
        clearTimeout(timeout)
        reject(error)
      })
    })
  }

  getFallbackResponse(prompt) {
    const responses = [
      "很高兴为您服务！有什么我可以帮助您的吗？",
      "我明白您的需求，让我来为您解答。",
      "这是一个很好的问题，让我想想如何回答您。",
      "感谢您的提问，我会尽力为您提供帮助。",
    ]

    const randomIndex = Math.floor(Math.random() * responses.length)
    console.log("Using fallback response due to API failure")
    return responses[randomIndex]
  }

  // 扩展方法：支持不同的对话场景
  async generateContextualResponse(userPrompt, context = {}) {
    try {
      const { conversationHistory = [], userProfile = {} } = context

      // 这里可以根据上下文生成更智能的响应
      console.log("Generating contextual response with history and profile")

      const baseResponse = await this.generateResponse(userPrompt)
      return baseResponse
    } catch (error) {
      console.error("Error in generateContextualResponse:", error)
      throw new Error(`Contextual LLM response generation failed: ${error.message}`)
    }
  }
}

module.exports = new LLMService()
