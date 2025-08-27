// 应用配置 - 数字助手系统配置
const appConfig = {

  // WebSocket配置
  websocket: {
    url: 'ws://localhost:3000/ws',
    reconnectAttempts: 3,
    reconnectDelay: 1000,
  },

  // Response LLM配置 (使用 SiliconFlow API)
  responseLLM: {
    // SiliconFlow API 配置
    provider: 'siliconflow',
    api_url: 'https://api.siliconflow.cn/v1/chat/completions',
    api_key: 'sk-wubypvpiulffcyilourqxgbideordblirkoceywfjdowbfji', // 临时直接使用 API key 进行测试
    model: 'Qwen/Qwen2.5-7B-Instruct', // 更换为7B小模型，响应更快
    max_tokens: 2048, // 降低token限制，加快响应
    timeout: 30000, // 缩短超时时间到30秒

    // 请求参数 - 针对语音交互优化
    temperature: 0.7, // 降低随机性，提高响应速度
    top_p: 0.9, // 稍微提高，保持回答质量
    top_k: 40, // 降低候选数量
    frequency_penalty: 1.0, // 降低惩罚，减少计算
    presence_penalty: 0.3, // 降低惩罚，减少计算
    enable_thinking: false,
    thinking_budget: 4096,
    min_p: 0.05,
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

    // 检查SiliconFlow API配置
    if (!this.responseLLM.api_key) {
      errors.push('缺少SiliconFlow LLM API密钥 - 请设置SILICONFLOW_API_KEY环境变量')
    }

    if (!this.siliconflow.api_key) {
      warnings.push('SiliconFlow语音服务API密钥未配置，将无法使用STT/TTS功能')
    } else {
      // API密钥配置了，检查服务启用状态
      if (this.siliconflow.stt.enabled) {
        console.log('✅ SiliconFlow STT服务已启用')
      }
      if (this.siliconflow.tts.enabled) {
        console.log('✅ SiliconFlow TTS服务已启用')
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
      // SiliconFlow LLM配置
      llmService: {
        provider: this.responseLLM.provider,
        apiUrl: this.responseLLM.api_url,
        isConfigured: !!this.responseLLM.api_key,
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

  // SiliconFlow API 配置
  siliconflow: {
    api_key: process.env.SILICONFLOW_API_KEY || 'sk-wubypvpiulffcyilourqxgbideordblirkoceywfjdowbfji',
    base_url: process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1',

    // STT 配置
    stt: {
      enabled: true,
      endpoint: 'https://api.siliconflow.cn/v1/audio/transcriptions',
      model: 'FunAudioLLM/SenseVoiceSmall',
      supported_formats: ['wav', 'mp3', 'm4a', 'flac'],
      max_file_size: '25MB',
      languages: ['zh', 'en', 'ja', 'ko'],
    },

    // TTS 配置
    tts: {
      enabled: true,
      endpoint: 'https://api.siliconflow.cn/v1/audio/speech',
      model: 'FunAudioLLM/CosyVoice2-0.5B',
      supported_voices: ['中文女', '中文男', '英文女', '英文男', '日语女', '韩语女', '粤语女', '四川话女'],
      pricing: {
        unit: 'per_million_utf8_bytes',
        price: 105,
        currency: 'CNY',
      },
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

      // TTS配置 - SiliconFlow API
      tts: {
        provider: 'SiliconFlow', // 服务提供商
        model: 'CosyVoice2-0.5B', // 正确的模型名称
        api_endpoint: 'https://api.siliconflow.cn/v1/audio/speech',
        voice_style: '中文女', // 默认声音风格
        format: 'wav',
        sample_rate: 22050, // CosyVoice输出采样率
        // 通过文本标签控制的语音选项
        available_speakers: ['中文女', '中文男', '英文女', '英文男', '日语女', '韩语女', '粤语女', '四川话女'],
        voice_tags: {
          中文女: '[S1]',
          中文男: '[S2]',
          英文女: '[S3]',
          英文男: '[S4]',
          日语女: '[S5]',
          韩语女: '[S6]',
          粤语女: '[S7]',
          四川话女: '[S8]',
        },
        supports_zero_shot: true, // 支持零样本语音克隆
        supports_cross_lingual: true, // 支持跨语言合成
        // 价格信息
        pricing: {
          unit: 'per_million_utf8_bytes',
          price: 105, // ￥105/百万UTF-8字节
          currency: 'CNY',
        },
        // 性能特性
        performance: {
          latency: 150, // 150ms低延迟
          real_time: true,
        },
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
