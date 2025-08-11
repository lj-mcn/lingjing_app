import axios from 'axios';

class LLMService {
  constructor() {
    this.baseURL = 'https://api.openai.com/v1';
    this.apiKey = ''; // 在实际使用时需要配置API密钥
    this.model = 'gpt-3.5-turbo';
    this.maxTokens = 1000;
    this.temperature = 0.7;
    this.conversationHistory = [];
  }

  setConfig({ apiKey, baseURL, model, maxTokens, temperature }) {
    if (apiKey) this.apiKey = apiKey;
    if (baseURL) this.baseURL = baseURL;
    if (model) this.model = model;
    if (maxTokens) this.maxTokens = maxTokens;
    if (temperature) this.temperature = temperature;
  }

  addSystemMessage(content) {
    this.conversationHistory.push({
      role: 'system',
      content: content
    });
  }

  addUserMessage(content) {
    this.conversationHistory.push({
      role: 'user',
      content: content
    });
  }

  addAssistantMessage(content) {
    this.conversationHistory.push({
      role: 'assistant',
      content: content
    });
  }

  async sendMessage(userMessage, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('API密钥未配置');
      }

      // 添加用户消息到历史记录
      this.addUserMessage(userMessage);

      const requestData = {
        model: options.model || this.model,
        messages: this.conversationHistory,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || this.temperature,
        stream: false
      };

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const assistantMessage = response.data.choices[0].message.content;
        
        // 添加AI回复到历史记录
        this.addAssistantMessage(assistantMessage);
        
        return {
          success: true,
          message: assistantMessage,
          usage: response.data.usage
        };
      } else {
        throw new Error('无效的API响应格式');
      }
    } catch (error) {
      console.error('LLM API调用失败:', error);
      
      let errorMessage = '大模型调用失败';
      if (error.response) {
        errorMessage += `: ${error.response.data?.error?.message || error.response.statusText}`;
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async sendQuickMessage(userMessage, systemPrompt = null) {
    try {
      const messages = [];
      
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        });
      }
      
      messages.push({
        role: 'user',
        content: userMessage
      });

      const requestData = {
        model: this.model,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature
      };

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return {
          success: true,
          message: response.data.choices[0].message.content,
          usage: response.data.usage
        };
      } else {
        throw new Error('无效的API响应格式');
      }
    } catch (error) {
      console.error('快速LLM调用失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  getHistory() {
    return [...this.conversationHistory];
  }

  setSystemPrompt(prompt) {
    // 移除现有的系统提示，添加新的
    this.conversationHistory = this.conversationHistory.filter(msg => msg.role !== 'system');
    if (prompt) {
      this.conversationHistory.unshift({
        role: 'system',
        content: prompt
      });
    }
  }

  // 嘎巴龙数字人专用系统提示
  initializeGabalongPersonality() {
    const systemPrompt = `你是嘎巴龙，一个可爱友好的数字人助手。请遵循以下特点：

1. 性格特征：
   - 活泼可爱，充满活力
   - 友善热情，乐于助人
   - 说话幽默风趣，偶尔卖萌
   - 对用户关怀备至

2. 对话风格：
   - 使用简洁明了的中文
   - 适当使用emoji表情
   - 避免过于正式的语言
   - 保持积极正面的态度

3. 功能定位：
   - 智能助手和陪伴者
   - 能回答各种问题
   - 提供情感支持和交流
   - 帮助用户解决问题

请以嘎巴龙的身份与用户互动，让用户感受到温暖和快乐！`;

    this.setSystemPrompt(systemPrompt);
  }
}

// 创建单例实例
const llmService = new LLMService();

// 初始化嘎巴龙个性
llmService.initializeGabalongPersonality();

export default llmService;