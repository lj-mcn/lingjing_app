// 大模型相关配置 (使用我们自己的LLM)
const llmConfig = {
  // OpenAI配置 (保留结构，但不使用)
  openai: {
    apiKey: '', // 不使用
    baseURL: 'https://api.openai.com/v1',
    models: {
      chat: 'gpt-3.5-turbo',
      stt: 'whisper-1',
      tts: 'tts-1'
    },
    ttsVoices: {
      alloy: 'alloy',
      echo: 'echo',
      fable: 'fable',
      onyx: 'onyx',
      nova: 'nova',
      shimmer: 'shimmer'
    }
  },

  // WebSocket配置
  websocket: {
    url: 'ws://localhost:3000/ws',
    reconnectAttempts: 5,
    reconnectDelay: 1000
  },

  // Response LLM配置 (使用我们自己的大模型)
  responseLLM: {
    // 远程大模型服务器配置 
    websocketUrl: 'ws://10.91.225.137:8000', // 你同学的电脑IP (直接配置，不依赖环境变量)
    timeout: 60000, // 增加超时时间以应对网络延迟
    model: 'Qwen2.5-1.5B-Instruct',
    maxTokens: 512,
    
    // 网络配置
    reconnectAttempts: 10,
    reconnectDelay: 3000,
    heartbeatInterval: 30000, // 心跳检测间隔
    
    // 备用服务器配置（可选）
    fallbackServers: [
      'ws://192.168.1.101:8000',
      'ws://192.168.1.102:8000'
    ]
  },

  // 嘎巴龙数字人个性配置
  gabalong: {
    personality: {
      name: '嘎巴龙',
      character: '可爱友好的数字人助手',
      traits: [
        '活泼可爱，充满活力',
        '友善热情，乐于助人', 
        '说话幽默风趣，偶尔卖萌',
        '对用户关怀备至'
      ],
      style: [
        '使用简洁明了的中文',
        '适当使用emoji表情',
        '避免过于正式的语言',
        '保持积极正面的态度'
      ]
    },
    systemPrompt: `你是嘎巴龙，一个可爱友好的数字人助手。请遵循以下特点：

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

请以嘎巴龙的身份与用户互动，让用户感受到温暖和快乐！`
  },

  // 开发模式配置
  development: {
    useMockServices: process.env.USE_MOCK_SERVICES === 'true' || false, // 是否使用模拟服务
    enableDebugLogs: process.env.ENABLE_DEBUG_LOGS === 'true' || true, // 是否启用调试日志
    mockResponseDelay: 1000, // 模拟响应延迟（毫秒）
  },

  // 配置验证 (仅使用我们自己的LLM)
  validateConfig() {
    const errors = [];
    const warnings = [];
    
    // 检查自己的LLM配置
    if (!this.responseLLM.websocketUrl) {
      errors.push('缺少LLM服务器地址 - 请设置LLM_SERVER_URL环境变量');
    }
    
    // 检查网络连通性提示
    if (this.responseLLM.websocketUrl) {
      if (this.responseLLM.websocketUrl.includes('192.168') || this.responseLLM.websocketUrl.includes('10.91')) {
        warnings.push('使用内网IP地址，请确保两台电脑在同一网络中');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  },

  // 获取当前环境配置
  getEnvironmentConfig() {
    return {
      // 我们自己的LLM配置
      llmServer: {
        serverUrl: this.responseLLM.websocketUrl,
        isConfigured: !!this.responseLLM.websocketUrl,
        model: this.responseLLM.model,
        timeout: this.responseLLM.timeout,
        maxTokens: this.responseLLM.maxTokens
      },
      
      // 开发配置
      isDevelopment: this.development.useMockServices,
      debugEnabled: this.development.enableDebugLogs,
      
      // 嘎巴龙个性配置
      personality: this.gabalong.personality.name
    };
  },

  // 音频配置
  audio: {
    recording: {
      quality: 'high',
      format: 'wav',
      maxDuration: 60000 // 最大录音时长（毫秒）
    },
    playback: {
      volume: 1.0,
      playThroughEarpiece: false
    }
  }
}

export default llmConfig