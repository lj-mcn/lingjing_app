/**
 * SenceVoice WebSocket客户端配置
 */

const senceVoiceConfig = {
  // 服务器配置
  servers: [
    {
      url: 'ws://10.91.225.137:8000',
      name: '主要SenceVoice服务器',
      priority: 1,
      enabled: true,
      description: '主要服务器',
    },
    {
      url: 'ws://10.91.225.137:8000',
      name: '备用SenceVoice服务器',
      priority: 2,
      enabled: true,
      description: '备用服务器',
    },
    {
      url: 'ws://10.91.225.137:8000',
      name: '本地SenceVoice服务器',
      priority: 3,
      enabled: true,
      description: '统一服务器',
    },
  ],

  // WebSocket配置
  websocket: {
    timeout: 60000, // 连接超时时间(毫秒)
    pingInterval: 20000, // 心跳间隔(毫秒)
    pingTimeout: 10000, // 心跳超时(毫秒)
    maxMessageSize: 10485760, // 最大消息大小(10MB，用于音频数据)
    compression: false,
  },

  // 重连配置
  retry: {
    maxRetries: 10, // 最大重试次数
    retryInterval: 3000, // 基础重试间隔(毫秒)
    maxRetryInterval: 60000, // 最大重试间隔(毫秒)
    exponentialBackoff: true, // 指数退避
    jitter: true, // 添加随机抖动
  },

  // 音频配置
  audio: {
    defaultFormat: 'wav',
    defaultSampleRate: 16000,
    defaultChannels: 1,
    defaultBitDepth: 16,
    requestTimeout: 30000, // 音频请求超时时间(毫秒)
    maxRecordingDuration: 60000, // 最大录音时长(毫秒)
    minRecordingDuration: 1000, // 最小录音时长(毫秒)
  },

  // 健康检查配置
  healthCheck: {
    enabled: true,
    interval: 30000, // 健康检查间隔(毫秒)
    timeout: 5000, // 健康检查超时(毫秒)
    maxFailures: 5, // 最大失败次数
  },

  // 功能特性配置
  features: {
    autoEnrollment: true, // 自动声纹注册
    autoKeywordActivation: true, // 自动关键词激活
    fallbackToTraditional: true, // 失败时回退到传统模式
    debugMode: __DEV__ || false, // 调试模式
  },

  // UI提示文本配置
  messages: {
    connecting: '正在连接SenceVoice服务器...',
    connected: 'SenceVoice服务已连接',
    disconnected: 'SenceVoice服务已断开',
    enrollmentRequired: '需要进行声纹注册，请录制至少3秒的音频',
    enrollmentSuccess: '声纹注册成功！',
    enrollmentFailed: '声纹注册失败，请重试',
    keywordRequired: '请说出唤醒词来激活语音助手',
    keywordActivated: '唤醒词已激活',
    voiceProcessing: '正在处理语音...',
    voiceProcessed: '语音处理完成',
    fallbackMode: '回退到传统语音处理模式',
  },
}

/**
 * 获取可用的服务器列表（按优先级排序）
 */
export const getAvailableServers = () => senceVoiceConfig.servers
  .filter((server) => server.enabled)
  .sort((a, b) => a.priority - b.priority)

/**
 * 获取主要服务器URL
 */
export const getPrimaryServerUrl = () => {
  const servers = getAvailableServers()
  return servers.length > 0 ? servers[0].url : null
}

/**
 * 获取音频配置
 */
export const getAudioConfig = () => ({ ...senceVoiceConfig.audio })

/**
 * 获取WebSocket配置
 */
export const getWebSocketConfig = () => ({ ...senceVoiceConfig.websocket })

/**
 * 获取重连配置
 */
export const getRetryConfig = () => ({ ...senceVoiceConfig.retry })

/**
 * 检查功能是否启用
 */
export const isFeatureEnabled = (feature) => senceVoiceConfig.features[feature] || false

/**
 * 获取提示消息
 */
export const getMessage = (key) => senceVoiceConfig.messages[key] || ''

/**
 * 验证服务器URL格式
 */
export const validateServerUrl = (url) => {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'ws:' || parsedUrl.protocol === 'wss:'
  } catch {
    return false
  }
}

/**
 * 生成唯一的请求ID
 */
export const generateRequestId = (type = 'req') => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return `${type}_${timestamp}_${random}`
}

export default senceVoiceConfig
