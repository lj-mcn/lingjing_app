import * as Speech from 'expo-speech'
import voiceManager from '../voice/VoiceManager'
import siliconFlowTTS from '../voice/SiliconFlowTTS'
import siliconFlowSTT from '../voice/SiliconFlowSTT'

class STTTTSService {
  constructor() {
    this.config = {
      provider: 'expo', // Default to Expo Speech for TTS
      openai: {
        apiKey: null,
        baseURL: 'https://api.openai.com/v1',
      },
      azure: {
        apiKey: null,
        region: null,
      },
      google: {
        apiKey: null,
      },
    }
    this.availableServices = []
    this.serviceStatus = {}
  }

  setConfig(config) {
    this.config = { ...this.config, ...config }
    console.log('🔧 STT/TTS服务配置已更新:', this.config.provider)
  }

  async detectAvailableServices() {
    try {
      console.log('🔍 检测可用的STT/TTS服务...')

      this.availableServices = []
      this.serviceStatus = {}

      // 检测Expo Speech (检查是否真的可用)
      console.log('🔍 检测Expo Speech可用性...')
      console.log('Speech对象:', typeof Speech)
      console.log('Speech.speak方法:', typeof Speech.speak)

      if (Speech && typeof Speech.speak === 'function') {
        this.availableServices.push('expo')
        this.serviceStatus.expo = {
          available: true,
          provider: 'expo',
          capabilities: ['tts'],
          description: 'Expo内置语音合成',
        }
        console.log('✅ Expo Speech可用')
      } else {
        console.log('⚠️ Expo Speech不可用')
        this.serviceStatus.expo = {
          available: false,
          provider: 'expo',
          capabilities: [],
          description: 'Expo Speech不可用',
          error: 'Speech对象或speak方法未定义',
        }
      }

      // 检测SiliconFlow TTS服务
      console.log('🔍 检测SiliconFlow TTS服务...')
      const siliconFlowAvailable = siliconFlowTTS.isAvailable()
      console.log('SiliconFlow isAvailable():', siliconFlowAvailable)

      if (siliconFlowAvailable) {
        this.availableServices.push('siliconflow')
        this.serviceStatus.siliconflow = {
          available: true,
          provider: 'siliconflow',
          capabilities: ['tts'],
          description: 'SiliconFlow CosyVoice TTS',
          voices: siliconFlowTTS.getAvailableVoices(),
        }
        console.log('✅ SiliconFlow TTS服务可用')
        console.log('- 支持语音:', siliconFlowTTS.getAvailableVoices())
      } else {
        console.log('⚠️ SiliconFlow TTS服务不可用')
        console.log('- 请检查API密钥和配置')
        this.serviceStatus.siliconflow = {
          available: false,
          provider: 'siliconflow',
          capabilities: [],
          description: 'SiliconFlow TTS不可用 - 配置问题',
          error: '缺少API密钥或端点配置',
        }
      }

      // 检测SiliconFlow STT服务
      console.log('🔍 检测SiliconFlow STT服务...')
      const siliconFlowSTTAvailable = siliconFlowSTT.isAvailable()
      console.log('SiliconFlow STT isAvailable():', siliconFlowSTTAvailable)

      if (siliconFlowSTTAvailable) {
        this.availableServices.push('siliconflow_stt')
        this.serviceStatus.siliconflow_stt = {
          available: true,
          provider: 'siliconflow_stt',
          capabilities: ['stt'],
          description: 'SiliconFlow SenseVoiceSmall STT',
          models: siliconFlowSTT.getSupportedModels(),
          info: siliconFlowSTT.getServiceInfo(),
        }
        console.log('✅ SiliconFlow STT服务可用')
        console.log('- 支持模型:', siliconFlowSTT.getSupportedModels())
      } else {
        console.log('⚠️ SiliconFlow STT服务不可用')
        console.log('- 请检查API密钥和配置')
        this.serviceStatus.siliconflow_stt = {
          available: false,
          provider: 'siliconflow_stt',
          capabilities: [],
          description: 'SiliconFlow STT不可用 - 配置问题',
          error: '缺少API密钥或端点配置',
        }
      }

      // 检测语音管理器服务
      if (voiceManager.isServiceReady()) {
        this.availableServices.push('voice_service')
        this.serviceStatus.voice_service = {
          available: true,
          provider: 'voice_service',
          capabilities: ['stt', 'tts'],
          description: '自定义语音服务',
        }
      }

      // 检测OpenAI API
      if (this.config.openai?.apiKey) {
        this.availableServices.push('openai')
        this.serviceStatus.openai = {
          available: true,
          provider: 'openai',
          capabilities: ['stt', 'tts'],
          description: 'OpenAI Whisper & TTS',
        }
      }

      console.log('✅ 可用服务:', this.availableServices)
      return this.availableServices
    } catch (error) {
      console.error('❌ 检测服务失败:', error)
      return ['expo'] // 至少返回Expo Speech
    }
  }

  getServiceStatus() {
    return this.serviceStatus
  }

  getServiceRecommendations() {
    const recommendations = []

    if (this.availableServices.length === 1 && this.availableServices[0] === 'expo') {
      recommendations.push({
        type: 'warning',
        message: '仅有基础语音合成可用，建议配置更多语音服务以获得更好体验',
      })
    }

    if (!this.availableServices.includes('voice_service') && !this.availableServices.includes('openai')) {
      recommendations.push({
        type: 'info',
        message: '可以通过配置API密钥来启用更多高质量的语音服务',
      })
    }

    if (this.availableServices.length > 1) {
      recommendations.push({
        type: 'success',
        message: `检测到${this.availableServices.length}个可用语音服务，将智能选择最佳服务`,
      })
    }

    return recommendations
  }

  async intelligentSTT(audioUri) {
    try {
      console.log('🎤 开始语音识别...')

      if (!audioUri) {
        throw new Error('没有音频数据')
      }

      // 模拟录音的情况
      if (audioUri.startsWith('simulation://')) {
        console.log('🎯 检测到模拟音频，提供用户反馈')

        // 生成一些测试用的用户输入，让对话更有趣
        const testPhrases = [
          '你好嘎巴龙，我想测试语音功能',
          '今天天气怎么样？',
          '请告诉我一个笑话',
          '你能帮我什么忙吗？',
          '我想了解更多关于你的信息',
        ]
        const randomPhrase = testPhrases[Math.floor(Math.random() * testPhrases.length)]

        console.log(`🎲 随机生成用户输入: ${randomPhrase}`)
        return {
          success: true,
          text: randomPhrase,
          provider: 'simulation',
        }
      }

      // 优先使用SiliconFlow STT
      if (this.availableServices.includes('siliconflow_stt')) {
        try {
          const result = await siliconFlowSTT.speechToText(audioUri)
          if (result.success) {
            return {
              success: true,
              text: result.text,
              provider: result.provider,
              model: result.model,
            }
          }
          throw new Error(result.error)
        } catch (error) {
          console.warn('SiliconFlow STT失败，尝试其他方式:', error)
        }
      }

      // 备用：使用自定义语音服务
      if (this.availableServices.includes('voice_service')) {
        try {
          console.log('🎤 使用语音服务进行STT')
          // 这里需要将音频文件转换为base64
          const audioBase64 = await this.convertAudioToBase64(audioUri)
          const result = await voiceManager.speechToText(audioBase64)
          return {
            success: true,
            text: result.data.text,
            provider: 'voice_service',
          }
        } catch (error) {
          console.warn('语音服务STT失败，尝试其他方式:', error)
        }
      }

      // 使用OpenAI Whisper
      if (this.availableServices.includes('openai')) {
        try {
          console.log('🎤 使用OpenAI Whisper进行STT')
          const result = await this.openaiSTT(audioUri)
          return {
            success: true,
            text: result.text,
            provider: 'openai',
          }
        } catch (error) {
          console.warn('OpenAI STT失败:', error)
        }
      }

      // 没有可用的STT服务
      console.warn('⚠️ 没有可用的STT服务')
      return {
        success: false,
        error: '没有可用的语音识别服务',
        text: '',
      }
    } catch (error) {
      console.error('❌ 语音识别失败:', error)
      return {
        success: false,
        error: error.message,
        text: '',
      }
    }
  }

  async intelligentTTS(text) {
    try {
      // 移除重复日志 - 在SiliconFlowTTS中已有输出

      if (!text || text.trim().length === 0) {
        throw new Error('没有文本内容')
      }

      // 优先使用SiliconFlow TTS
      if (this.availableServices.includes('siliconflow')) {
        try {
          return await siliconFlowTTS.textToSpeech(text)
        } catch (error) {
          console.warn('SiliconFlow TTS失败，回退到其他服务:', error)
        }
      }

      // 使用自定义语音服务
      if (this.availableServices.includes('voice_service')) {
        try {
          const result = await voiceManager.textToSpeech(text)
          return {
            success: true,
            audioData: result.data.audio_data,
            provider: 'voice_service',
          }
        } catch (error) {
          console.warn('语音服务TTS失败，回退到Expo Speech:', error)
        }
      }

      // 使用OpenAI TTS
      if (this.availableServices.includes('openai')) {
        try {
          const audioData = await this.openaiTTS(text)
          return {
            success: true,
            audioData,
            provider: 'openai',
          }
        } catch (error) {
          console.warn('OpenAI TTS失败，回退到Expo Speech:', error)
        }
      }

      // 回退到Expo Speech
      // 使用Expo Speech作为后备

      // 检查 Speech 对象是否可用
      if (!Speech || typeof Speech.speak !== 'function') {
        console.error('❌ Expo Speech不可用，Speech对象类型:', typeof Speech)
        console.error('❌ Speech.speak方法类型:', typeof Speech?.speak)

        // 降级处理：模拟TTS完成
        console.log('📢 模拟TTS播放完成（Speech不可用）')
        return {
          success: false,
          error: 'Expo Speech不可用',
          audioData: null,
          provider: 'simulation',
        }
      }

      try {
        console.log('🎵 开始调用 Speech.speak...')
        await Speech.speak(text, {
          language: 'zh-CN',
          pitch: 1.0,
          rate: 0.9,
          voice: null, // 使用默认语音
        })

        console.log('✅ Expo Speech 调用成功')
        return {
          success: true,
          audioData: null, // Expo Speech直接播放，不返回音频数据
          provider: 'expo',
        }
      } catch (speechError) {
        console.error('❌ Expo Speech 调用失败:', speechError.message)

        // 模拟播放完成
        console.log('📢 模拟TTS播放完成（Speech调用失败）')
        return {
          success: false,
          error: speechError.message,
          audioData: null,
          provider: 'simulation',
        }
      }
    } catch (error) {
      console.error('❌ 语音合成失败:', error)
      return {
        success: false,
        error: error.message,
        audioData: null,
      }
    }
  }

  async convertAudioToBase64(audioUri) {
    try {
      // 简单的模拟实现
      // 在实际应用中，需要读取音频文件并转换为base64
      console.log('🔄 转换音频文件为base64:', audioUri)
      return 'mock-base64-audio-data'
    } catch (error) {
      console.error('❌ 音频转换失败:', error)
      throw error
    }
  }

  async openaiSTT(audioUri) {
    if (!this.config.openai?.apiKey) {
      throw new Error('OpenAI API密钥未配置')
    }

    // 这里应该实现OpenAI Whisper API调用
    console.log('🎤 调用OpenAI Whisper API...')
    throw new Error('OpenAI STT未实现')
  }

  async openaiTTS(text) {
    if (!this.config.openai?.apiKey) {
      throw new Error('OpenAI API密钥未配置')
    }

    // 这里应该实现OpenAI TTS API调用
    throw new Error('OpenAI TTS未实现')
  }
}

// 创建单例实例
const sttTtsService = new STTTTSService()
export default sttTtsService
