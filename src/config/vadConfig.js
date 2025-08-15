/**
 * VAD自由打断功能配置文件
 * 基于111.py中webrtcvad的配置参数
 */

export const vadConfig = {
  // WebRTC VAD核心配置
  webRTCVAD: {
    sampleRate: 16000, // 音频采样率 (Hz)
    frameSize: 320, // 音频帧大小，20ms at 16kHz
    vadMode: 3, // VAD敏感度 (0-3)，3最敏感，对应111.py的VAD_MODE
    silenceThreshold: 1000, // 静音阈值 (ms)，对应111.py的NO_SPEECH_THRESHOLD
    detectionInterval: 100, // VAD检测间隔 (ms)
    voiceDetectionRate: 0.5, // 语音检测比率，对应111.py的rate参数
    minimumSpeechDuration: 300, // 最小有效语音持续时间 (ms)
  },

  // 传统VAD配置（作为备选方案）
  traditionalVAD: {
    sampleRate: 16000,
    frameSize: 320,
    vadMode: 3,
    silenceThreshold: 3000,
    voiceDetectionInterval: 100,
    minimumSpeechDuration: 500,
  },

  // 自由打断功能配置
  interruption: {
    enabled: true, // 是否启用自由打断
    autoEnable: true, // 智能对话模式下是否自动启用
    responseDelay: 300, // 打断后响应延迟 (ms)
    enableInModes: [ // 在哪些模式下启用自由打断
      'smartConversation', // 智能对话模式
      'continuous', // 持续监听模式
      'manual', // 手动模式
    ],
  },

  // 音频处理配置
  audio: {
    echoCancellation: true, // 回声消除
    noiseSuppression: false, // 噪声抑制（关闭以保持VAD精度）
    autoGainControl: false, // 自动增益控制（关闭）
  },

  // 调试和监控配置
  debug: {
    logVADEvents: true, // 记录VAD事件
    logInterruptions: true, // 记录打断事件
    showVADStatus: false, // 显示VAD状态（用于调试）
    logAudioLevels: false, // 记录音频电平（用于调试）
  },
}

// 不同场景的预设配置
export const vadPresets = {
  // 高敏感度配置 - 适用于安静环境
  highSensitivity: {
    ...vadConfig,
    webRTCVAD: {
      ...vadConfig.webRTCVAD,
      vadMode: 3,
      voiceDetectionRate: 0.3,
      minimumSpeechDuration: 200,
      silenceThreshold: 800,
    },
  },

  // 中等敏感度配置 - 适用于一般环境
  mediumSensitivity: {
    ...vadConfig,
    webRTCVAD: {
      ...vadConfig.webRTCVAD,
      vadMode: 2,
      voiceDetectionRate: 0.5,
      minimumSpeechDuration: 300,
      silenceThreshold: 1000,
    },
  },

  // 低敏感度配置 - 适用于嘈杂环境
  lowSensitivity: {
    ...vadConfig,
    webRTCVAD: {
      ...vadConfig.webRTCVAD,
      vadMode: 1,
      voiceDetectionRate: 0.7,
      minimumSpeechDuration: 500,
      silenceThreshold: 1500,
    },
  },

  // 演示模式配置 - 适用于演示和测试
  demo: {
    ...vadConfig,
    webRTCVAD: {
      ...vadConfig.webRTCVAD,
      vadMode: 3,
      voiceDetectionRate: 0.4,
      minimumSpeechDuration: 250,
      silenceThreshold: 800,
    },
    debug: {
      ...vadConfig.debug,
      logVADEvents: true,
      logInterruptions: true,
      showVADStatus: true,
    },
  },
}

// 根据环境自动选择配置
export function getRecommendedConfig(environment = 'auto') {
  switch (environment) {
    case 'quiet':
      return vadPresets.highSensitivity
    case 'normal':
      return vadPresets.mediumSensitivity
    case 'noisy':
      return vadPresets.lowSensitivity
    case 'demo':
      return vadPresets.demo
    case 'auto':
    default:
      // 可以根据设备类型、时间等因素自动判断
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        // 如果支持媒体设备，使用中等敏感度
        return vadPresets.mediumSensitivity
      }
      // 否则使用低敏感度
      return vadPresets.lowSensitivity
  }
}

export default vadConfig
