import appConfig from './AppConfig'

// LLM配置 - 基于AppConfig的适配层
const llmConfig = {
  // Response LLM配置
  responseLLM: {
    ...appConfig.responseLLM,
  },

  // STT/TTS配置
  sttTts: {
    provider: appConfig.sttTts.provider,

    // OpenAI配置
    openai: {
      apiKey: process.env.OPENAI_API_KEY || null,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: {
        stt: 'whisper-1',
        tts: 'tts-1',
      },
      voice: 'alloy', // OpenAI TTS voice
      timeout: 30000,
    },

    // Azure配置
    azure: {
      apiKey: process.env.AZURE_SPEECH_KEY || null,
      region: process.env.AZURE_SPEECH_REGION || null,
      endpoint: process.env.AZURE_SPEECH_ENDPOINT || null,
      timeout: 30000,
    },

    // Google Cloud配置
    google: {
      apiKey: process.env.GOOGLE_CLOUD_API_KEY || null,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || null,
      timeout: 30000,
    },

    // 语音服务配置（基于AppConfig）
    voice_service: appConfig.sttTts.voice_service,

    // Expo Speech配置（回退选项）
    expo: {
      enabled: true,
      language: 'zh-CN',
      pitch: 1.0,
      rate: 0.9,
      quality: 'default',
    },
  },

  // 个性化配置
  personality: appConfig.gabalong,

  // 开发配置
  development: appConfig.development,

  // WebSocket配置
  websocket: appConfig.websocket,

  // 音频配置
  audio: appConfig.audio,

  // 配置验证方法
  validateConfig: appConfig.validateConfig.bind(appConfig),
  getEnvironmentConfig: appConfig.getEnvironmentConfig.bind(appConfig),
}

export default llmConfig
