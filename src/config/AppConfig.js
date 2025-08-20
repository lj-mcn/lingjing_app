// 应用配置 - 数字助手系统配置
const appConfig = {

  // WebSocket配置
  websocket: {
    url: 'ws://localhost:3000/ws',
    reconnectAttempts: 3,
    reconnectDelay: 1000,
  },

  // Response LLM配置 (使用我们自己的大模型)
  responseLLM: {
    // 远程大模型服务器配置 (从环境变量读取)
    websocket_url: process.env.LLM_SERVER_URL || 'ws://192.168.18.138:8000',
    timeout: 60000, // 增加超时时间以应对网络延迟
    model: 'Qwen2.5-1.5B-Instruct',
    max_tokens: 512,
    // 网络配置
    reconnectAttempts: 3,
    reconnectDelay: 3000,
    heartbeatInterval: 30000, // 心跳检测间隔

    // 备用服务器配置（可选）
    fallbackServers: [
      process.env.LLM_SERVER_BACKUP_1 || 'ws://localhost:8000', // 备用1
      process.env.LLM_SERVER_BACKUP_2 || 'ws://127.0.0.1:8000', // 备用2
      'ws://10.91.225.137:8000', // 之前的IP作为备用
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

  // 配置验证
  validateConfig() {
    const errors = []
    const warnings = []

    // 检查Qwen LLM配置
    if (!this.responseLLM.websocket_url) {
      errors.push('缺少LLM服务器地址 - 请设置LLM_SERVER_URL环境变量')
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
      // Qwen LLM配置
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

  // STT/TTS服务配置 - Kokoro TTS + SenseVoice-small
  sttTts: {
    provider: 'voice_service', // 使用统一语音服务
    
    // 语音服务配置
    voice_service: {
      enabled: true,
      websocket_url: process.env.VOICE_SERVICE_URL || 'ws://192.168.18.138:8001',
      timeout: 30000,
      reconnectAttempts: 3,
      reconnectDelay: 2000,
      
      // TTS配置
      tts: {
        model: 'kokoro-v0_19',
        voice_style: 'default', // 可配置声音风格
        format: 'wav',
      },
      
      // STT配置
      stt: {
        model: 'sensevoice-small',
        language: 'zh',
        enable_itn: true, // 数字规范化
      },
      
    },
  },
}

export default appConfig
