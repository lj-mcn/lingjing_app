import webSocketService from './WebSocketService'
import llmConfig from '../config/llmConfig'
import chatMemoryService from './ChatMemoryService'

class ResponseLLMService {
  constructor() {
    this.isInitialized = false
    this.modelConfig = {
      endpoint: llmConfig.responseLLM.websocket_url,
      timeout: llmConfig.responseLLM.timeout,
      max_tokens: llmConfig.responseLLM.max_tokens,
    }
    this.requestId = 0
    this.pendingRequests = new Map()
  }

  async initialize(config = {}) {
    try {
      console.log('开始初始化ResponseLLMService...')
      this.modelConfig = { ...this.modelConfig, ...config }

      // 设置WebSocket消息处理
      webSocketService.setOnMessage((data) => {
        this.handleWebSocketMessage(data)
      })

      // 设置WebSocket连接状态监听
      webSocketService.setOnConnect(() => {
        console.log('✅ LLM WebSocket连接成功')
      })

      webSocketService.setOnDisconnect(() => {
        console.log('⚠️ LLM WebSocket断开连接，尝试重连...')
        this.handleDisconnection()
      })

      webSocketService.setOnError((error) => {
        console.error('❌ LLM WebSocket错误:', error)
        this.handleConnectionError(error)
      })

      // 尝试连接到远程LLM服务器（但不等待连接成功）
      try {
        await this.connectToLLMServer()
        console.log('LLM服务器连接已启动')
      } catch (error) {
        console.warn('LLM服务器连接失败，但继续初始化:', error.message)
      }

      // 无论WebSocket是否连接成功，都标记为已初始化
      this.isInitialized = true
      console.log('✅ ResponseLLMService初始化成功')
      return true
    } catch (error) {
      console.error('❌ ResponseLLMService初始化失败:', error)
      // 即使有错误，也尝试标记为初始化完成（降级模式）
      this.isInitialized = true
      return true
    }
  }

  async connectToLLMServer() {
    // 尝试主服务器
    const primaryServer = this.modelConfig.endpoint
    console.log(`Connecting to primary LLM server at ${primaryServer}`)

    try {
      webSocketService.connect(primaryServer)
      console.log('WebSocket connection initiated to primary server')

      // 给主服务器更多时间连接，并定期检查状态
      for (let i = 0; i < 10; i++) { // 检查10次，每次500ms，总共5秒
        await new Promise((resolve) => setTimeout(resolve, 500))
        if (webSocketService.isConnected()) {
          console.log('✅ Primary server connected successfully')
          return true
        }
        console.log(`等待主服务器连接中... ${(i + 1) * 0.5}s`)
      }

      console.warn('主服务器连接超时')
    } catch (error) {
      console.warn('Primary server connection failed:', error)
    }

    // 如果主服务器失败，尝试备用服务器
    if (llmConfig.responseLLM.fallbackServers && llmConfig.responseLLM.fallbackServers.length > 0) {
      console.log('🔄 Trying fallback servers...')

      for (const fallbackUrl of llmConfig.responseLLM.fallbackServers) {
        console.log(`Trying fallback server: ${fallbackUrl}`)
        try {
          webSocketService.connect(fallbackUrl)

          // 给备用服务器时间连接
          for (let i = 0; i < 8; i++) { // 检查8次，每次500ms，总共4秒
            await new Promise((resolve) => setTimeout(resolve, 500))
            if (webSocketService.isConnected()) {
              console.log(`✅ Connected to fallback server: ${fallbackUrl}`)
              // 更新当前端点为成功的备用服务器
              this.modelConfig.endpoint = fallbackUrl
              return true
            }
            console.log(`等待备用服务器连接中... ${(i + 1) * 0.5}s`)
          }

          console.warn(`备用服务器 ${fallbackUrl} 连接超时`)
        } catch (error) {
          console.warn(`Fallback server ${fallbackUrl} failed:`, error)
        }
      }
    }

    console.error('❌ All servers failed to connect')
    return false
  }

  async generateResponse(userInput, conversationHistory = []) {
    if (!this.isInitialized) {
      throw new Error('ResponseLLMService not initialized')
    }

    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('Request timeout'))
      }, this.modelConfig.timeout)

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeoutId,
        timestamp: Date.now(),
        userInput, // 存储原始用户输入，用于更新记忆
      })

      // 获取记忆中的对话上下文
      const memoryContext = chatMemoryService.getContext()

      // 构建包含历史记忆的提示词
      let fullPrompt = userInput
      if (memoryContext) {
        fullPrompt = `${memoryContext}\nUser: ${userInput}`
      }

      const requestData = {
        type: 'llm_request',
        requestId,
        data: {
          prompt: fullPrompt,
          conversation_history: conversationHistory,
          max_tokens: this.modelConfig.max_tokens,
          system_prompt: llmConfig.gabalong.system_prompt,
        },
        timestamp: Date.now(),
      }

      const sent = webSocketService.send(requestData)
      if (!sent) {
        clearTimeout(timeoutId)
        this.pendingRequests.delete(requestId)
        reject(new Error('Failed to send WebSocket message'))
      }
    })
  }

  handleWebSocketMessage(data) {
    if (data.type === 'llm_response' && data.requestId) {
      const request = this.pendingRequests.get(data.requestId)
      if (request) {
        clearTimeout(request.timeoutId)
        this.pendingRequests.delete(data.requestId)

        if (data.success) {
          // 存储用户输入和助手回复到记忆中
          if (request.userInput && data.message) {
            chatMemoryService.addToHistory(request.userInput, data.message)
            // 自动管理历史记录长度
            chatMemoryService.autoManageHistory()
          }

          request.resolve({
            success: true,
            message: data.message,
            timestamp: data.timestamp || Date.now(),
          })
        } else {
          request.reject(new Error(data.error || 'LLM processing failed'))
        }
      }
    } else if (data.type === 'error') {
      // 处理通用错误消息（无requestId的错误）
      console.error('WebSocket通用错误:', data.error)
      if (data.requestId) {
        const request = this.pendingRequests.get(data.requestId)
        if (request) {
          clearTimeout(request.timeoutId)
          this.pendingRequests.delete(data.requestId)
          request.reject(new Error(data.error || 'Server error'))
        }
      }
    }
  }

  async sendMessage(text, conversationHistory = []) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('消息内容不能为空')
      }

      if (!this.isInitialized) {
        throw new Error('大模型服务未初始化，请稍后重试')
      }

      console.log('📤 发送消息到大模型:', text.substring(0, 50) + (text.length > 50 ? '...' : ''))

      if (!webSocketService.isConnected()) {
        console.log('🔄 WebSocket未连接，尝试重新连接...')
        try {
          await this.connectToLLMServer()
          // 等待连接建立
          await new Promise((resolve) => setTimeout(resolve, 2000))
          if (!webSocketService.isConnected()) {
            throw new Error(`无法连接到大模型服务器 (${this.modelConfig.endpoint})，请检查:\n• 服务器是否正在运行\n• 网络连接是否正常\n• 防火墙设置`)
          }
          console.log('✅ 重新连接成功')
        } catch (error) {
          throw new Error(`大模型服务器连接失败:\n${error.message}\n\n请确保服务器已启动并运行在 ${this.modelConfig.endpoint}`)
        }
      }

      console.log('⏳ 等待大模型响应...')
      const response = await this.generateResponse(text.trim(), conversationHistory)

      console.log('✅ 收到大模型响应:', response.message.substring(0, 100) + (response.message.length > 100 ? '...' : ''))
      return {
        success: true,
        message: response.message,
        timestamp: response.timestamp,
      }
    } catch (error) {
      console.error('❌ 大模型请求失败:', error)
      const errorMessage = this.getDetailedErrorMessage(error.message)
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      }
    }
  }

  getDetailedErrorMessage(originalError) {
    if (originalError.includes('timeout') || originalError.includes('Request timeout')) {
      return '大模型响应超时，可能原因:\n• 服务器负载过高\n• 网络延迟较大\n• 模型处理时间过长\n\n建议稍后重试'
    }

    if (originalError.includes('WebSocket') || originalError.includes('连接')) {
      return `网络连接问题:\n• 请检查服务器是否运行在 ${this.modelConfig.endpoint}\n• 确认设备在同一网络\n• 检查防火墙设置\n\n可尝试重新启动应用`
    }

    if (originalError.includes('JSON') || originalError.includes('解析')) {
      return '数据格式错误，这可能是服务器版本不兼容导致的'
    }

    return `大模型服务异常:\n${originalError}\n\n如持续出现此问题，请检查服务器状态`
  }

  isReady() {
    return this.isInitialized && webSocketService.isConnected()
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      websocketConnected: webSocketService.isConnected(),
      pendingRequests: this.pendingRequests.size,
      modelConfig: this.modelConfig,
    }
  }

  clearPendingRequests() {
    for (const [requestId, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeoutId)
      request.reject(new Error('Service stopped'))
    }
    this.pendingRequests.clear()
  }

  handleDisconnection() {
    // 清除待处理的请求
    for (const [requestId, request] of this.pendingRequests.entries()) {
      request.reject(new Error('Connection lost'))
      clearTimeout(request.timeoutId)
    }
    this.pendingRequests.clear()

    // 尝试重连
    setTimeout(() => {
      if (this.isInitialized) {
        this.connectToLLMServer().catch((error) => {
          console.error('Reconnection failed:', error)
        })
      }
    }, llmConfig.responseLLM.reconnectDelay)
  }

  handleConnectionError(error) {
    console.error('LLM connection error:', error)
    // 可以在这里添加更多错误处理逻辑
  }

  // 检查服务器连接状态
  async checkServerHealth() {
    try {
      const healthCheck = await this.generateResponse('ping', [])
      return healthCheck.success
    } catch (error) {
      console.error('Server health check failed:', error)
      return false
    }
  }

  // 记忆管理相关方法

  /**
   * 获取当前对话记忆上下文
   * @returns {string} 对话上下文
   */
  getMemoryContext() {
    return chatMemoryService.getContext()
  }

  /**
   * 获取格式化的对话历史
   * @returns {Array} 格式化的对话数组
   */
  getConversationHistory() {
    return chatMemoryService.getFormattedHistory()
  }

  /**
   * 清空对话记忆
   */
  clearMemory() {
    chatMemoryService.clearHistory()
    console.log('对话记忆已清空')
  }

  /**
   * 获取记忆统计信息
   * @returns {Object} 记忆统计信息
   */
  getMemoryStats() {
    return {
      historyLength: chatMemoryService.getHistoryLength(),
      turnCount: chatMemoryService.getTurnCount(),
      hasHistory: chatMemoryService.hasHistory(),
      maxLength: chatMemoryService.getMaxLength(),
    }
  }

  /**
   * 设置记忆最大长度
   * @param {number} maxLength - 最大长度
   */
  setMemoryMaxLength(maxLength) {
    chatMemoryService.setMaxLength(maxLength)
    console.log(`记忆最大长度已设置为: ${maxLength}`)
  }

  /**
   * 导出记忆数据（用于持久化存储）
   * @returns {Object} 记忆数据
   */
  exportMemory() {
    return chatMemoryService.export()
  }

  /**
   * 导入记忆数据（从持久化存储恢复）
   * @param {Object} memoryData - 记忆数据
   */
  importMemory(memoryData) {
    chatMemoryService.import(memoryData)
    console.log('记忆数据已导入')
  }

  cleanup() {
    this.clearPendingRequests()
    this.isInitialized = false
    console.log('ResponseLLMService cleaned up')
  }
}

const responseLLMService = new ResponseLLMService()
export default responseLLMService
