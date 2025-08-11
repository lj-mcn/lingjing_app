import webSocketService from './WebSocketService';
import llmConfig from '../config/llmConfig';

class ResponseLLMService {
  constructor() {
    this.isInitialized = false;
    this.modelConfig = {
      endpoint: llmConfig.responseLLM.websocketUrl,
      timeout: llmConfig.responseLLM.timeout,
      maxTokens: llmConfig.responseLLM.maxTokens,
    };
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  async initialize(config = {}) {
    try {
      console.log('开始初始化ResponseLLMService...');
      this.modelConfig = { ...this.modelConfig, ...config };
      
      // 设置WebSocket消息处理
      webSocketService.setOnMessage((data) => {
        this.handleWebSocketMessage(data);
      });

      // 设置WebSocket连接状态监听
      webSocketService.setOnConnect(() => {
        console.log('✅ LLM WebSocket连接成功');
      });

      webSocketService.setOnDisconnect(() => {
        console.log('⚠️ LLM WebSocket断开连接，尝试重连...');
        this.handleDisconnection();
      });

      webSocketService.setOnError((error) => {
        console.error('❌ LLM WebSocket错误:', error);
        this.handleConnectionError(error);
      });

      // 尝试连接到远程LLM服务器（但不等待连接成功）
      try {
        await this.connectToLLMServer();
        console.log('LLM服务器连接已启动');
      } catch (error) {
        console.warn('LLM服务器连接失败，但继续初始化:', error.message);
      }

      // 无论WebSocket是否连接成功，都标记为已初始化
      this.isInitialized = true;
      console.log('✅ ResponseLLMService初始化成功');
      return true;
    } catch (error) {
      console.error('❌ ResponseLLMService初始化失败:', error);
      // 即使有错误，也尝试标记为初始化完成（降级模式）
      this.isInitialized = true;
      return true;
    }
  }

  async connectToLLMServer() {
    const serverUrl = this.modelConfig.endpoint;
    console.log(`Connecting to LLM server at ${serverUrl}`);
    
    try {
      // 连接到主服务器，但不等待连接成功
      webSocketService.connect(serverUrl);
      console.log('WebSocket connection initiated');
      return true;
    } catch (error) {
      console.error('Failed to initiate connection to LLM server:', error);
      
      // 不抛出错误，允许服务初始化成功，后续会自动重连
      console.log('Service will continue to attempt connection...');
      return true;
    }
  }

  async generateResponse(userInput, conversationHistory = []) {
    if (!this.isInitialized) {
      throw new Error('ResponseLLMService not initialized');
    }

    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId;
      
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, this.modelConfig.timeout);

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeoutId,
        timestamp: Date.now()
      });

      const requestData = {
        type: 'llm_request',
        requestId: requestId,
        data: {
          prompt: userInput,
          conversationHistory: conversationHistory,
          maxTokens: this.modelConfig.maxTokens,
          systemPrompt: llmConfig.gabalong.systemPrompt,
        },
        timestamp: Date.now()
      };

      const sent = webSocketService.send(requestData);
      if (!sent) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(requestId);
        reject(new Error('Failed to send WebSocket message'));
      }
    });
  }

  handleWebSocketMessage(data) {
    if (data.type === 'llm_response' && data.requestId) {
      const request = this.pendingRequests.get(data.requestId);
      if (request) {
        clearTimeout(request.timeoutId);
        this.pendingRequests.delete(data.requestId);

        if (data.success) {
          request.resolve({
            success: true,
            message: data.message,
            timestamp: data.timestamp || Date.now()
          });
        } else {
          request.reject(new Error(data.error || 'LLM processing failed'));
        }
      }
    }
  }

  async sendMessage(text, conversationHistory = []) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Message cannot be empty');
      }

      if (!this.isInitialized) {
        throw new Error('LLM服务未初始化，请检查服务器连接');
      }

      if (!webSocketService.isConnected()) {
        throw new Error('未连接到LLM服务器，请检查网络和服务器状态');
      }

      const response = await this.generateResponse(text.trim(), conversationHistory);
      
      return {
        success: true,
        message: response.message,
        timestamp: response.timestamp
      };
    } catch (error) {
      console.error('LLM request failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  isReady() {
    return this.isInitialized && webSocketService.isConnected();
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      websocketConnected: webSocketService.isConnected(),
      pendingRequests: this.pendingRequests.size,
      modelConfig: this.modelConfig
    };
  }

  clearPendingRequests() {
    for (const [requestId, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeoutId);
      request.reject(new Error('Service stopped'));
    }
    this.pendingRequests.clear();
  }

  handleDisconnection() {
    // 清除待处理的请求
    for (const [requestId, request] of this.pendingRequests.entries()) {
      request.reject(new Error('Connection lost'));
      clearTimeout(request.timeoutId);
    }
    this.pendingRequests.clear();
    
    // 尝试重连
    setTimeout(() => {
      if (this.isInitialized) {
        this.connectToLLMServer().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }
    }, llmConfig.responseLLM.reconnectDelay);
  }

  handleConnectionError(error) {
    console.error('LLM connection error:', error);
    // 可以在这里添加更多错误处理逻辑
  }

  // 检查服务器连接状态
  async checkServerHealth() {
    try {
      const healthCheck = await this.generateResponse('ping', []);
      return healthCheck.success;
    } catch (error) {
      console.error('Server health check failed:', error);
      return false;
    }
  }

  cleanup() {
    this.clearPendingRequests();
    this.isInitialized = false;
    console.log('ResponseLLMService cleaned up');
  }
}

const responseLLMService = new ResponseLLMService();
export default responseLLMService;