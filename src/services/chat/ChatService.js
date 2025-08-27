import connectionManager from '../connection/ConnectionManager'
import appConfig from '../../config/AppConfig'
import conversationMemory from './ConversationMemory'

class ChatService {
  constructor() {
    this.isInitialized = false

    // 根据provider选择正确的endpoint
    const provider = appConfig.responseLLM.provider || 'websocket'
    const endpoint = provider === 'siliconflow'
      ? appConfig.responseLLM.api_url
      : appConfig.responseLLM.websocket_url

    this.modelConfig = {
      provider,
      endpoint,
      api_key: appConfig.responseLLM.api_key,
      timeout: appConfig.responseLLM.timeout,
      max_tokens: appConfig.responseLLM.max_tokens,
      model: appConfig.responseLLM.model,
      temperature: appConfig.responseLLM.temperature || 1.0,
      top_p: appConfig.responseLLM.top_p || 0.85,
      frequency_penalty: appConfig.responseLLM.frequency_penalty || 1.2,
      presence_penalty: appConfig.responseLLM.presence_penalty || 0.6,
    }
    this.requestId = 0
    this.pendingRequests = new Map()
  }

  async initialize(config = {}) {
    try {
      console.log('开始初始化ResponseLLMService...')
      this.modelConfig = { ...this.modelConfig, ...config }

      console.log('🔧 当前配置:', {
        provider: this.modelConfig.provider,
        endpoint: this.modelConfig.endpoint,
        hasApiKey: !!this.modelConfig.api_key,
        model: this.modelConfig.model,
      })

      // 根据provider类型初始化不同的服务
      if (this.modelConfig.provider === 'siliconflow') {
        console.log('✅ 使用SiliconFlow API服务')

        // 验证必需的配置
        if (!this.modelConfig.api_key) {
          throw new Error('缺少 SiliconFlow API Key')
        }
        if (!this.modelConfig.endpoint) {
          throw new Error('缺少 SiliconFlow API 端点')
        }
        if (!this.modelConfig.model) {
          throw new Error('缺少 SiliconFlow 模型配置')
        }

        // SiliconFlow API不需要WebSocket连接
        this.isInitialized = true
        console.log('✅ ResponseLLMService (SiliconFlow) 初始化成功')
        return true
      }
      // 原有WebSocket逻辑
      // 设置WebSocket消息处理
      connectionManager.setOnMessage((data) => {
        this.handleWebSocketMessage(data)
      })

      // 设置WebSocket连接状态监听
      connectionManager.setOnConnect(() => {
        console.log('✅ 聊天服务连接成功')
      })

      connectionManager.setOnDisconnect(() => {
        console.log('⚠️ 聊天服务断开连接，尝试重连...')
        this.handleDisconnection()
      })

      connectionManager.setOnError((error) => {
        console.error('❌ 聊天服务错误:', error)
        this.handleConnectionError(error)
      })

      // WebSocket 模式才需要连接服务器
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
      console.error('❌ ResponseLLMService初始化失败:', error.message)
      console.error('详细错误:', error)

      // 对于 SiliconFlow API，如果配置错误就不应该标记为已初始化
      if (this.modelConfig.provider === 'siliconflow') {
        this.isInitialized = false
        return false
      }
      // WebSocket 模式可以降级处理
      this.isInitialized = true
      return true
    }
  }

  async connectToLLMServer() {
    // 仅在 WebSocket 模式下才连接
    if (this.modelConfig.provider === 'siliconflow') {
      console.log('✅ SiliconFlow 模式无需 WebSocket 连接')
      return true
    }

    // 尝试主服务器
    const primaryServer = this.modelConfig.endpoint
    console.log(`Connecting to primary LLM server at ${primaryServer}`)

    try {
      connectionManager.connect(primaryServer)
      console.log('WebSocket connection initiated to primary server')

      // 给主服务器更多时间连接，并定期检查状态
      for (let i = 0; i < 10; i++) { // 检查10次，每次500ms，总共5秒
        await new Promise((resolve) => setTimeout(resolve, 500))
        if (connectionManager.isConnected()) {
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
    if (appConfig.responseLLM.fallbackServers && appConfig.responseLLM.fallbackServers.length > 0) {
      console.log('🔄 Trying fallback servers...')

      for (const fallbackUrl of appConfig.responseLLM.fallbackServers) {
        console.log(`Trying fallback server: ${fallbackUrl}`)
        try {
          connectionManager.connect(fallbackUrl)

          // 给备用服务器时间连接
          for (let i = 0; i < 8; i++) { // 检查8次，每次500ms，总共4秒
            await new Promise((resolve) => setTimeout(resolve, 500))
            if (connectionManager.isConnected()) {
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

    // 根据provider类型选择不同的处理方式
    if (this.modelConfig.provider === 'siliconflow') {
      return this.generateSiliconFlowResponse(userInput, conversationHistory)
    }
    return this.generateWebSocketResponse(userInput, conversationHistory)
  }

  async generateSiliconFlowResponse(userInput, conversationHistory = []) {
    try {
      // 获取记忆中的对话上下文
      const memoryContext = conversationMemory.getContext()

      // 构建消息数组
      const messages = [
        {
          role: 'system',
          content: appConfig.gabalong.system_prompt,
        },
      ]

      // 添加历史记忆上下文
      if (memoryContext) {
        messages.push({
          role: 'user',
          content: memoryContext,
        })
      }

      // 添加当前用户输入
      messages.push({
        role: 'user',
        content: userInput,
      })

      const requestBody = {
        model: this.modelConfig.model,
        messages,
        max_tokens: this.modelConfig.max_tokens,
        temperature: this.modelConfig.temperature,
        top_p: this.modelConfig.top_p,
        frequency_penalty: this.modelConfig.frequency_penalty,
        presence_penalty: this.modelConfig.presence_penalty,
        stream: false,
      }

      console.log('📤 发送请求到SiliconFlow API...')

      // 使用 React Native 的全局 fetch
      const response = await global.fetch(this.modelConfig.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.modelConfig.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`SiliconFlow API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from SiliconFlow API')
      }

      const assistantMessage = data.choices[0].message.content

      // 存储到记忆中
      conversationMemory.addToHistory(userInput, assistantMessage)
      conversationMemory.autoManageHistory()

      return {
        success: true,
        message: assistantMessage,
        timestamp: Date.now(),
      }
    } catch (error) {
      console.error('SiliconFlow API调用失败:', error)
      throw error
    }
  }

  async generateWebSocketResponse(userInput, conversationHistory = []) {
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
      const memoryContext = conversationMemory.getContext()

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
          system_prompt: appConfig.gabalong.system_prompt,
        },
        timestamp: Date.now(),
      }

      const sent = connectionManager.send(requestData)
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
            conversationMemory.addToHistory(request.userInput, data.message)
            // 自动管理历史记录长度
            conversationMemory.autoManageHistory()
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

      // 强制检查和重新初始化
      if (!this.isInitialized) {
        console.log('⚠️ 检测到服务未初始化，尝试自动初始化...')
        console.log('当前服务状态:', JSON.stringify(this.getStatus(), null, 2))

        // 直接强制设置为初始化状态（对于 SiliconFlow API 来说这是安全的）
        if (this.modelConfig.provider === 'siliconflow') {
          console.log('🔧 强制初始化 SiliconFlow 服务...')

          // 验证关键配置
          if (!this.modelConfig.api_key) {
            throw new Error('缺少 SiliconFlow API Key')
          }
          if (!this.modelConfig.endpoint) {
            throw new Error('缺少 SiliconFlow API 端点')
          }

          this.isInitialized = true
          console.log('✅ SiliconFlow 服务强制初始化成功')
        } else {
          const initResult = await this.initialize()
          console.log('自动初始化结果:', initResult)

          if (!initResult || !this.isInitialized) {
            console.error('❌ 自动初始化失败')
            throw new Error('大模型服务未初始化，请稍后重试')
          }

          console.log('✅ 自动初始化成功')
        }
      }

      console.log('📤 发送消息到大模型:', text.substring(0, 50) + (text.length > 50 ? '...' : ''))

      // 根据provider类型选择不同的处理逻辑
      if (this.modelConfig.provider === 'siliconflow') {
        // SiliconFlow API 直接调用，无需检查WebSocket连接
        console.log('⏳ 等待SiliconFlow API响应...')
        const response = await this.generateResponse(text.trim(), conversationHistory)

        console.log('✅ 收到SiliconFlow响应:', response.message.substring(0, 100) + (response.message.length > 100 ? '...' : ''))
        return {
          success: true,
          message: response.message,
          timestamp: response.timestamp,
        }
      }
      // 原有WebSocket逻辑
      if (!connectionManager.isConnected()) {
        console.log('🔄 WebSocket未连接，尝试重新连接...')
        try {
          await this.connectToLLMServer()
          // 等待连接建立
          await new Promise((resolve) => setTimeout(resolve, 2000))
          if (!connectionManager.isConnected()) {
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

  // 流式发送消息 - 新增的流式响应方法
  async sendStreamingMessage(text, onPartialResponse, conversationHistory = []) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('消息内容不能为空')
      }

      if (!this.isInitialized) {
        throw new Error('聊天服务未初始化')
      }

      console.log('📤 发送流式请求到大模型:', text.substring(0, 50) + (text.length > 50 ? '...' : ''))

      // 使用模拟流式效果，避免React Native兼容性问题
      console.log('🌊 使用模拟流式LLM处理')
      const response = await this.sendMessage(text, conversationHistory)

      if (response.success && onPartialResponse) {
        // 模拟流式效果：逐字显示，提升用户体验
        await this.simulateStreamingDisplay(response.message, onPartialResponse)
      }

      return response
    } catch (error) {
      console.error('❌ 流式请求失败:', error)
      return {
        success: false,
        error: error.message,
        timestamp: Date.now(),
      }
    }
  }

  async generateSiliconFlowStreamingResponse(userInput, onPartialResponse, conversationHistory = []) {
    try {
      // 获取记忆中的对话上下文
      const memoryContext = conversationMemory.getContext()

      // 构建消息数组
      const messages = [
        {
          role: 'system',
          content: appConfig.gabalong.system_prompt,
        },
      ]

      // 添加历史记忆上下文
      if (memoryContext) {
        messages.push({
          role: 'user',
          content: memoryContext,
        })
      }

      // 添加当前用户输入
      messages.push({
        role: 'user',
        content: userInput,
      })

      const requestBody = {
        model: this.modelConfig.model,
        messages,
        max_tokens: this.modelConfig.max_tokens,
        temperature: this.modelConfig.temperature,
        top_p: this.modelConfig.top_p,
        frequency_penalty: this.modelConfig.frequency_penalty,
        presence_penalty: this.modelConfig.presence_penalty,
        stream: true, // 启用流式响应
      }

      console.log('🌊 发送流式请求到SiliconFlow API...')

      const response = await global.fetch(this.modelConfig.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.modelConfig.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`SiliconFlow API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      // 处理流式响应 - 添加错误检查
      if (!response.body) {
        console.warn('⚠️ 响应body为空，可能不支持流式，降级到常规模式')
        // 降级到常规响应处理
        const responseText = await response.text()
        try {
          const data = JSON.parse(responseText)
          const message = data.choices?.[0]?.message?.content || '抱歉，没有收到有效响应'

          // 模拟流式效果给用户
          if (onPartialResponse) {
            await this.simulateStreamingDisplay(message, onPartialResponse)
          }

          return {
            success: true,
            message,
            timestamp: Date.now(),
            streaming: false,
            fallback: true,
          }
        } catch (parseError) {
          throw new Error(`无法解析响应: ${responseText}`)
        }
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.trim() === '') continue
            if (!line.startsWith('data: ')) continue

            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)

              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                const { delta } = parsed.choices[0]

                if (delta.content) {
                  assistantMessage += delta.content

                  // 发送部分响应给回调函数
                  if (onPartialResponse) {
                    onPartialResponse({
                      text: assistantMessage,
                      delta: delta.content,
                      isFinal: false,
                      timestamp: Date.now(),
                    })
                  }
                }
              }
            } catch (parseError) {
              console.warn('解析流式响应块失败:', parseError)
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      // 存储完整响应到记忆中
      if (assistantMessage) {
        conversationMemory.addToHistory(userInput, assistantMessage)
        conversationMemory.autoManageHistory()
      }

      // 发送最终响应
      if (onPartialResponse) {
        onPartialResponse({
          text: assistantMessage,
          delta: '',
          isFinal: true,
          timestamp: Date.now(),
        })
      }

      console.log('✅ 流式响应完成:', `${assistantMessage.substring(0, 50)}...`)

      return {
        success: true,
        message: assistantMessage,
        timestamp: Date.now(),
        streaming: true,
      }
    } catch (error) {
      console.error('SiliconFlow 流式API调用失败:', error)
      throw error
    }
  }

  // 模拟流式显示效果（用于非流式API的回退）
  async simulateStreamingDisplay(message, onPartialResponse) {
    // 将消息按句子分割，以便支持流式TTS
    const sentences = message.split(/([。！？\n])/g)
    let partialText = ''

    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i]) {
        partialText += sentences[i]

        onPartialResponse({
          text: partialText,
          delta: sentences[i],
          isFinal: i === sentences.length - 1,
          timestamp: Date.now(),
        })

        // 如果是句子结束符，稍微停顿久一点，允许TTS处理
        const isEndOfSentence = /[。！？\n]/.test(sentences[i])
        const delay = isEndOfSentence ? 300 : 80

        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    // 最终响应
    onPartialResponse({
      text: partialText,
      delta: '',
      isFinal: true,
      timestamp: Date.now(),
    })
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
    if (this.modelConfig.provider === 'siliconflow') {
      // SiliconFlow API 只需要初始化即可，无需WebSocket连接
      return this.isInitialized
    }
    return this.isInitialized && connectionManager.isConnected()
  }

  getStatus() {
    const baseStatus = {
      initialized: this.isInitialized,
      provider: this.modelConfig.provider,
      pendingRequests: this.pendingRequests.size,
      modelConfig: this.modelConfig,
    }

    if (this.modelConfig.provider === 'siliconflow') {
      baseStatus.apiReady = this.isInitialized
      baseStatus.endpoint = this.modelConfig.endpoint
    } else {
      baseStatus.websocketConnected = connectionManager.isConnected()
    }

    return baseStatus
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

    // 只有在 WebSocket 模式下才尝试重连
    if (this.modelConfig.provider !== 'siliconflow') {
      setTimeout(() => {
        if (this.isInitialized) {
          this.connectToLLMServer().catch((error) => {
            console.error('Reconnection failed:', error)
          })
        }
      }, appConfig.responseLLM.reconnectDelay || 3000)
    } else {
      console.log('⚠️ SiliconFlow 模式，跳过 WebSocket 重连')
    }
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
    return conversationMemory.getContext()
  }

  /**
   * 获取格式化的对话历史
   * @returns {Array} 格式化的对话数组
   */
  getConversationHistory() {
    return conversationMemory.getFormattedHistory()
  }

  /**
   * 清空对话记忆
   */
  clearMemory() {
    conversationMemory.clearHistory()
    console.log('对话记忆已清空')
  }

  /**
   * 获取记忆统计信息
   * @returns {Object} 记忆统计信息
   */
  getMemoryStats() {
    return {
      historyLength: conversationMemory.getHistoryLength(),
      turnCount: conversationMemory.getTurnCount(),
      hasHistory: conversationMemory.hasHistory(),
      maxLength: conversationMemory.getMaxLength(),
    }
  }

  /**
   * 设置记忆最大长度
   * @param {number} maxLength - 最大长度
   */
  setMemoryMaxLength(maxLength) {
    conversationMemory.setMaxLength(maxLength)
    console.log(`记忆最大长度已设置为: ${maxLength}`)
  }

  /**
   * 导出记忆数据（用于持久化存储）
   * @returns {Object} 记忆数据
   */
  exportMemory() {
    return conversationMemory.export()
  }

  /**
   * 导入记忆数据（从持久化存储恢复）
   * @param {Object} memoryData - 记忆数据
   */
  importMemory(memoryData) {
    conversationMemory.import(memoryData)
    console.log('记忆数据已导入')
  }

  cleanup() {
    this.clearPendingRequests()
    this.isInitialized = false
    console.log('ResponseLLMService cleaned up')
  }
}

const chatService = new ChatService()
export default chatService
