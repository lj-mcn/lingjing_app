/**
 * CosyVoice TTS 配置文件
 */
module.exports = {
  // API 基础配置
  baseUrl: process.env.COSYVOICE_API_URL || "http://localhost:50000",
  timeout: 30000, // 30 seconds
  
  // 默认设置
  defaults: {
    spkId: "中文女",
    mode: "sft",
    audioFormat: "wav",
    sampleRate: 22050,
  },
  
  // 可用的说话人 ID
  availableSpkIds: [
    "中文女",
    "中文男",
    "英文女",
    "英文男",
    "日文女",
    // 根据实际 CosyVoice 模型添加更多
  ],
  
  // TTS 模式配置
  modes: {
    sft: {
      name: "SFT模式",
      description: "基础语音合成，使用预训练说话人",
      requiredParams: ["tts_text", "spk_id"],
      endpoint: "/inference_sft",
    },
    zero_shot: {
      name: "Zero-shot模式", 
      description: "声音克隆，需要提示音频和文本",
      requiredParams: ["tts_text", "prompt_text", "prompt_wav"],
      endpoint: "/inference_zero_shot",
    },
    cross_lingual: {
      name: "跨语言模式",
      description: "跨语言语音合成",
      requiredParams: ["tts_text", "prompt_wav"],
      endpoint: "/inference_cross_lingual",
    },
    instruct: {
      name: "指令模式",
      description: "基于指令的语音合成",
      requiredParams: ["tts_text", "spk_id", "instruct_text"],
      endpoint: "/inference_instruct",
    },
  },
  
  // 错误处理配置
  retry: {
    maxRetries: 3,
    retryDelay: 1000, // 1 second
  },
  
  // 音频处理配置
  audio: {
    chunkSize: 16000,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedFormats: ["wav", "mp3"],
  },
  
  // 文本处理限制
  text: {
    maxLength: 1000,
    encoding: "utf-8",
  },
}