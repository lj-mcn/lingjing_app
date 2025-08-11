// 大模型相关配置
const llmConfig = {
  // OpenAI配置
  openai: {
    apiKey: '', // 在生产环境中设置真实的API密钥
    baseURL: 'https://api.openai.com/v1',
    models: {
      chat: 'gpt-3.5-turbo',
      stt: 'whisper-1',
      tts: 'tts-1'
    },
    ttsVoices: {
      alloy: 'alloy',    // 中性
      echo: 'echo',      // 男性
      fable: 'fable',    // 英式男性
      onyx: 'onyx',      // 深沉男性
      nova: 'nova',      // 年轻女性
      shimmer: 'shimmer' // 优雅女性
    }
  },

  // WebSocket配置
  websocket: {
    url: 'ws://localhost:3000/ws',
    reconnectAttempts: 5,
    reconnectDelay: 1000
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
    useMockServices: true, // 是否使用模拟服务
    enableDebugLogs: true, // 是否启用调试日志
    mockResponseDelay: 1000, // 模拟响应延迟（毫秒）
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