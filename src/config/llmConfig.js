// 大模型相关配置 (使用我们自己的LLM)
const llmConfig = {
  // OpenAI配置 (保留结构，但不使用)
  openai: {
    apiKey: '', // 不使用
    baseURL: 'https://api.openai.com/v1',
    models: {
      chat: 'gpt-3.5-turbo',
      stt: 'whisper-1',
      tts: 'tts-1',
    },
    ttsVoices: {
      alloy: 'alloy',
      echo: 'echo',
      fable: 'fable',
      onyx: 'onyx',
      nova: 'nova',
      shimmer: 'shimmer',
    },
  },

  // WebSocket配置
  websocket: {
    url: 'ws://localhost:3000/ws',
    reconnectAttempts: 3,
    reconnectDelay: 1000,
  },

  // Response LLM配置 (使用我们自己的大模型)
  responseLLM: {
    // 远程大模型服务器配置 (从环境变量读取)
    websocket_url: process.env.LLM_SERVER_URL || 'ws://10.91.225.137:8000',
    timeout: 60000, // 增加超时时间以应对网络延迟
    model: 'Qwen2.5-1.5B-Instruct',
    max_tokens: 512,
    // 网络配置
    reconnectAttempts: 3,
    reconnectDelay: 3000,
    heartbeatInterval: 30000, // 心跳检测间隔

    // 备用服务器配置（可选）
    fallbackServers: [
      process.env.LLM_SERVER_BACKUP_1 || 'ws://192.168.18.138:8000', // 备用1：之前的IP
      process.env.LLM_SERVER_BACKUP_2 || 'ws://localhost:8000', // 备用2：本地
      'ws://127.0.0.1:8000', // 本地环回
      'ws://192.168.43.119:8000', // 同网段其他设备
    ],
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
        '对用户关怀备至',
      ],
      style: [
        '使用简洁明了的中文',
        '适当使用emoji表情',
        '避免过于正式的语言',
        '保持积极正面的态度',
      ],
    },
    system_prompt: `你是嘎巴龙，一个可爱友好的数字人助手。请遵循以下特点：

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

请以嘎巴龙的身份与用户互动，让用户感受到温暖和快乐！`,
  },

  // 开发模式配置
  development: {
    useMockServices: process.env.USE_MOCK_SERVICES === 'true' || false, // 是否使用模拟服务
    enableDebugLogs: process.env.ENABLE_DEBUG_LOGS === 'true' || true, // 是否启用调试日志
    mockResponseDelay: 1000, // 模拟响应延迟（毫秒）
  },

  // 配置验证 (仅使用我们自己的LLM)
  validateConfig() {
    const errors = []
    const warnings = []

    // 检查自己的LLM配置
    if (!this.responseLLM.websocket_url) {
      errors.push('缺少LLM服务器地址 - 请设置LLM_SERVER_URL环境变量')
    }

    // 检查网络连通性提示
    if (this.responseLLM.websocket_url) {
      const url = this.responseLLM.websocket_url
      // 更精确的私有IP地址检测
      const isPrivateIP = url.includes('192.168.')
                         || url.includes('10.')
                         || /172\.(1[6-9]|2[0-9]|3[01])\./.test(url)
                         || url.includes('127.0.0.1')
                         || url.includes('localhost')

      if (isPrivateIP) {
        warnings.push('使用内网IP地址，请确保两台电脑在同一网络中')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  },

  // 获取当前环境配置
  getEnvironmentConfig() {
    return {
      // 我们自己的LLM配置
      llmServer: {
        serverUrl: this.responseLLM.websocket_url,
        isConfigured: !!this.responseLLM.websocket_url,
        model: this.responseLLM.model,
        timeout: this.responseLLM.timeout,
        max_tokens: this.responseLLM.max_tokens,
      },

      // 开发配置
      isDevelopment: this.development.useMockServices,
      debugEnabled: this.development.enableDebugLogs,

      // 嘎巴龙个性配置
      personality: this.gabalong.personality.name,
    }
  },

  // 音频配置
  audio: {
    recording: {
      quality: 'high',
      format: 'wav',
      maxDuration: 60000, // 最大录音时长（毫秒）
    },
    playback: {
      volume: 1.0,
      playThroughEarpiece: false,
    },
  },

  // STT/TTS服务配置
  sttTts: {
    // 服务提供商选择: auto, openai, azure, expo, web, simulation
    provider: 'auto', // 自动选择：Google STT + Expo TTS

    // OpenAI配置
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '', // 从环境变量读取，或在此直接填写你的OpenAI API密钥
      sttModel: 'whisper-1',
      ttsModel: 'tts-1',
      voice: 'alloy', // alloy, echo, fable, onyx, nova, shimmer
      enabled: false, // 有API密钥时自动启用
    },

    // Azure语音服务配置
    azure: {
      subscriptionKey: '', // 留空则不使用Azure
      region: 'eastus', // 服务区域
      language: 'zh-CN',
      voice: 'zh-CN-XiaoxiaoNeural', // 中文女声
      enabled: false,
    },

    // Google Cloud语音服务配置
    google: {
      apiKey: 'AIzaSyBCVXaEQqhtahcNZ9QNcDjE4y20pk94YDc', // Google Cloud STT API密钥
      sttLanguage: 'zh-CN', // 语音识别语言
      ttsLanguage: 'zh-CN', // 语音合成语言
      sttModel: 'default', // STT模型 (default支持中文)
      ttsVoice: 'zh-CN-Standard-A', // TTS语音
      enabled: true,
    },

    // Expo Speech配置 (本地TTS)
    expo: {
      language: 'zh-CN',
      pitch: 1.0,
      rate: 0.9,
      enabled: true,
    },

    // Web Speech API配置
    web: {
      language: 'zh-CN',
      rate: 0.9,
      pitch: 1.0,
      enabled: true, // 自动检测平台支持
    },

    // 降级策略
    fallback: {
      enableSimulation: false, // 当所有服务不可用时是否启用模拟模式
      showWarnings: true, // 是否显示服务不可用警告
    },
  },
}

export default llmConfig
