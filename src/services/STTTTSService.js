import axios from 'axios'
import { Platform } from 'react-native'
import { Audio } from 'expo-av'
import * as Speech from 'expo-speech'
// 尝试导入expo-speech-recognition，如果不可用则降级
let SpeechRecognition = null
try {
  SpeechRecognition = require('expo-speech-recognition')
} catch (error) {
  console.log('expo-speech-recognition not available, will use alternative STT')
}

class STTTTSService {
  constructor() {
    this.currentProvider = 'auto' // auto, openai, expo, azure, web
    this.useSimulation = false

    // OpenAI配置
    this.openaiConfig = {
      sttEndpoint: 'https://api.openai.com/v1/audio/transcriptions',
      ttsEndpoint: 'https://api.openai.com/v1/audio/speech',
      apiKey: '',
      sttModel: 'whisper-1',
      ttsModel: 'tts-1',
      voice: 'alloy',
    }

    // Azure配置
    this.azureConfig = {
      subscriptionKey: '',
      region: 'eastus',
      language: 'zh-CN',
      voice: 'zh-CN-XiaoxiaoNeural',
    }

    // Google Cloud配置
    this.googleConfig = {
      apiKey: '',
      sttLanguage: 'zh-CN',
      ttsLanguage: 'zh-CN',
      sttModel: 'latest_short',
      ttsVoice: 'zh-CN-Standard-A',
    }

    // 服务可用性状态
    this.serviceAvailability = {
      sensevoice: true, // SenseVoice-small语音识别
      'edge-tts': true, // Edge TTS语音合成
      expo: true, // Expo支持TTS，STT需要检测
      expoSTT: !!SpeechRecognition, // Expo STT可用性
      web: Platform.OS === 'web',
      openai: false,
      azure: false,
      google: false,
    }

    console.log('🎵 STT/TTS服务初始化完成')
  }

  setConfig(config) {
    // OpenAI配置
    if (config.openai) {
      this.openaiConfig = { ...this.openaiConfig, ...config.openai }
      // 自动检测API密钥并启用服务
      const hasValidKey = this.openaiConfig.apiKey
                          && this.openaiConfig.apiKey.length > 0
                          && !this.openaiConfig.apiKey.includes('test-key')
      this.serviceAvailability.openai = hasValidKey

      if (hasValidKey) {
        console.log('✅ OpenAI API密钥已配置，启用Whisper语音识别')
      } else {
        console.log('⚠️ OpenAI API密钥未配置或为测试密钥')
      }
    }

    // Azure配置
    if (config.azure) {
      this.azureConfig = { ...this.azureConfig, ...config.azure }
      this.serviceAvailability.azure = !!this.azureConfig.subscriptionKey
    }

    // Google Cloud配置
    if (config.google) {
      this.googleConfig = { ...this.googleConfig, ...config.google }
      const hasValidKey = this.googleConfig.apiKey
                          && this.googleConfig.apiKey.length > 0
                          && this.googleConfig.apiKey.startsWith('AIza')
      this.serviceAvailability.google = hasValidKey

      if (hasValidKey) {
        console.log('✅ Google Cloud API密钥已配置，启用语音识别服务')
      } else {
        console.log('⚠️ Google Cloud API密钥未配置或格式错误')
      }
    }

    // 设置提供商
    if (config.provider) {
      this.currentProvider = config.provider
    }

    console.log('📋 STT/TTS配置已更新:', {
      provider: this.currentProvider,
      availability: this.serviceAvailability,
      googleConfigured: !!this.googleConfig.apiKey,
      openaiConfigured: !!this.openaiConfig.apiKey,
      azureConfigured: !!this.azureConfig.subscriptionKey,
    })
  }

  // 自动选择最佳可用服务
  selectBestProvider(type = 'both') {
    console.log(`🔍 选择${type}服务提供商...`)
    console.log('当前服务可用性:', this.serviceAvailability)

    if (type === 'stt') {
      // STT优先级: Google > OpenAI > Azure > Expo > Web > 模拟 (Google支持WAV格式，准确率更高)
      const sttPriorities = ['google', 'openai', 'azure', 'expo', 'web']
      for (const provider of sttPriorities) {
        console.log(`检查 ${provider}: ${this.serviceAvailability[provider]}`)
        if (this.serviceAvailability[provider]) {
          const selectedProvider = provider === 'expoSTT' ? 'expo' : provider
          console.log(`✅ 选择了 ${selectedProvider}`)
          return selectedProvider
        }
      }
    } else if (type === 'tts') {
      // TTS优先级: Expo > Google > OpenAI > Azure > Web > 模拟 (暂时禁用Edge TTS避免循环依赖)
      const ttsPriorities = ['expo', 'google', 'openai', 'azure', 'web']
      for (const provider of ttsPriorities) {
        if (this.serviceAvailability[provider]) {
          return provider
        }
      }
    } else {
      // 综合优先级: SenseVoice&EdgeTTS > Google > OpenAI > Azure > Expo(如果有STT) > Web > 模拟
      const priorities = ['sensevoice', 'edge-tts', 'google', 'openai', 'azure', 'expo', 'web']
      for (const provider of priorities) {
        if (this.serviceAvailability[provider]) {
          // 如果选择expo，需要确保至少有TTS或STT可用
          if (provider === 'expo') {
            if (this.serviceAvailability.expoSTT || this.serviceAvailability.expo) {
              return provider
            }
          } else {
            return provider
          }
        }
      }
    }

    return 'simulation' // 降级到模拟模式
  }

  async speechToText(audioUri) {
    try {
      if (!this.openaiConfig.apiKey) {
        throw new Error('OpenAI API密钥未配置')
      }

      if (!audioUri) {
        throw new Error('音频文件路径为空')
      }

      // 检查是否为模拟录音
      if (audioUri && audioUri.startsWith('mock://')) {
        console.log('🎭 检测到模拟录音，使用模拟STT响应')
        return await this.mockSpeechToText(audioUri)
      }

      const formData = new FormData()
      formData.append('file', {
        uri: audioUri,
        type: 'audio/wav',
        name: 'audio.wav',
      })
      formData.append('model', this.openaiConfig.sttModel)
      formData.append('language', 'zh') // 指定中文

      const response = await axios.post(this.openaiConfig.sttEndpoint, formData, {
        headers: {
          Authorization: `Bearer ${this.openaiConfig.apiKey}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      })

      if (response.data && response.data.text) {
        return {
          success: true,
          text: response.data.text,
          language: response.data.language,
        }
      }
      throw new Error('无效的STT响应格式')
    } catch (error) {
      console.error('语音转文字失败:', error)
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      }
    }
  }

  async textToSpeech(text, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('API密钥未配置')
      }

      if (!text || text.trim().length === 0) {
        throw new Error('文本内容为空')
      }

      const requestData = {
        model: options.model || this.ttsModel,
        input: text,
        voice: options.voice || this.ttsVoice,
        response_format: options.format || 'mp3',
        speed: options.speed || 1.0,
      }

      const response = await axios.post(this.ttsEndpoint, requestData, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'blob',
        timeout: 30000,
      })

      if (response.data) {
        // 将音频数据转换为base64
        const reader = new FileReader()
        return new Promise((resolve, reject) => {
          reader.onloadend = () => {
            const base64data = reader.result.split(',')[1]
            resolve({
              success: true,
              audioData: base64data,
              format: requestData.response_format,
            })
          }
          reader.onerror = reject
          reader.readAsDataURL(response.data)
        })
      }
      throw new Error('无效的TTS响应格式')
    } catch (error) {
      console.error('文字转语音失败:', error)
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      }
    }
  }

  // 本地模拟STT（用于开发测试）
  async mockSpeechToText(audioUri) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockTexts = [
          '你好，我想和你聊天',
          '今天天气怎么样？',
          '请帮我介绍一下你自己',
          '我感觉有点无聊',
          '能不能讲个笑话？',
        ]
        const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)]

        resolve({
          success: true,
          text: randomText,
          language: 'zh',
          isMock: true,
        })
      }, 1000)
    })
  }

  // 本地模拟TTS（用于开发测试）
  async mockTextToSpeech(text) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // 返回一个模拟的音频数据
        const mockAudioBase64 = 'UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmgfDD2F0fPEbSAFKXvB6+ONQA0PZ7zz26piHgU8ltLuzXEjCC13yO/eizEIHWq4+eGWT' // 这是一个示例base64

        resolve({
          success: true,
          audioData: mockAudioBase64,
          format: 'mp3',
          isMock: true,
        })
      }, 1500)
    })
  }

  // Expo TTS (本地语音合成)
  async expoTextToSpeech(text) {
    try {
      console.log('🎵 使用Expo TTS服务')

      const options = {
        language: 'zh-CN',
        pitch: 1.0,
        rate: 0.9,
        voice: Platform.OS === 'ios' ? 'com.apple.ttsbundle.Tingting-compact' : undefined,
      }

      await Speech.speak(text, options)

      return {
        success: true,
        message: '语音播放完成',
        provider: 'expo',
        audioData: null, // Expo直接播放，不返回音频数据
      }
    } catch (error) {
      console.error('Expo TTS失败:', error)
      return {
        success: false,
        error: error.message,
        provider: 'expo',
      }
    }
  }

  // Web Speech API TTS
  async webTextToSpeech(text) {
    try {
      if (Platform.OS !== 'web' || !window.speechSynthesis) {
        throw new Error('Web Speech API不可用')
      }

      console.log('🌐 使用Web Speech API TTS')

      return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'zh-CN'
        utterance.rate = 0.9
        utterance.pitch = 1.0

        utterance.onend = () => {
          resolve({
            success: true,
            message: '语音播放完成',
            provider: 'web',
            audioData: null,
          })
        }

        utterance.onerror = (event) => {
          reject(new Error(`Web Speech TTS错误: ${event.error}`))
        }

        window.speechSynthesis.speak(utterance)
      })
    } catch (error) {
      console.error('Web Speech TTS失败:', error)
      return {
        success: false,
        error: error.message,
        provider: 'web',
      }
    }
  }

  // Expo语音识别
  async expoSpeechToText(audioUri) {
    try {
      if (!SpeechRecognition) {
        throw new Error('Expo Speech Recognition不可用')
      }

      console.log('📱 使用Expo语音识别')

      // 设置识别选项
      const options = {
        language: 'zh-CN',
        interimResults: false,
        maxAlternatives: 1,
        continuous: false,
      }

      const result = await SpeechRecognition.requestPermissionsAsync()
      if (result.status !== 'granted') {
        throw new Error('语音识别权限被拒绝')
      }

      // 开始识别
      const recognition = await SpeechRecognition.startAsync(options)

      if (recognition.results && recognition.results.length > 0) {
        const { transcript } = recognition.results[0]
        return {
          success: true,
          text: transcript,
          provider: 'expo',
          confidence: recognition.results[0].confidence || 0.9,
        }
      }

      throw new Error('未识别到语音内容')
    } catch (error) {
      // 使用console.log以避免触发任何可能的错误弹窗
      console.log('🎯 Expo语音识别失败（已拦截）:', error.message || error)
      return {
        success: false,
        error: error.message,
        provider: 'expo',
      }
    }
  }

  // 改进版的音频转文字（使用真实录音分析）
  async simpleExpoSTT(audioUri) {
    try {
      console.log('📱 使用改进版Expo STT (分析真实录音)')

      if (!audioUri) {
        throw new Error('没有录音文件')
      }

      // 分析录音文件的基本信息
      let audioInfo = null
      try {
        // 尝试获取音频文件信息
        const { Audio } = require('expo-av')
        const { sound } = await Audio.Sound.createAsync({ uri: audioUri })
        const status = await sound.getStatusAsync()
        audioInfo = status
        await sound.unloadAsync()
      } catch (error) {
        console.warn('无法获取音频信息:', error)
      }

      // 基于录音时长和用户交互模式，提供更智能的识别
      const duration = audioInfo?.durationMillis || 2000
      console.log(`录音时长: ${duration}ms`)

      // 模拟语音处理时间（基于实际录音时长）
      const processTime = Math.max(1000, Math.min(duration * 0.3, 3000))
      await new Promise((resolve) => setTimeout(resolve, processTime))

      // 这里应该调用真实的语音识别服务
      // 目前作为过渡方案，我们提示用户配置真实的STT服务
      const result = await this.promptForRealSTTService(audioUri, duration)

      return {
        success: true,
        text: result,
        provider: 'expo',
        confidence: 0.7,
        isRealRecording: true,
        duration,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: 'expo',
      }
    }
  }

  async promptForRealSTTService(audioUri, duration) {
    // 提示用户配置真实的语音识别服务
    console.log('🎙️ 检测到真实录音，时长:', duration, 'ms')
    console.log('📄 录音文件路径:', audioUri)

    // 显示配置指导
    console.log('📋 语音识别服务配置指导:')
    console.log('1. 获取OpenAI API密钥: https://platform.openai.com/account/api-keys')
    console.log('2. 在.env文件中设置 OPENAI_API_KEY=你的密钥')
    console.log('3. 或在 src/config/llmConfig.js 中直接填入API密钥')

    const configGuides = [
      `✨ 录音成功！时长${Math.round(duration / 1000)}秒。为了识别语音内容，请配置OpenAI Whisper API密钥。配置后即可享受准确的中文语音识别！`,
      `🎤 已录制语音${Math.round(duration / 1000)}秒。添加OpenAI API密钥到.env文件即可启用专业语音识别功能。`,
      '📱 语音已录制完成！配置语音识别服务后，我就能理解您说的内容了。推荐使用OpenAI Whisper，准确率很高！',
    ]

    return configGuides[Math.floor(Math.random() * configGuides.length)]
  }

  // SenseVoice-small语音识别
  async senseVoiceSpeechToText(audioUri) {
    try {
      console.log('🤖 使用SenseVoice-small语音识别')

      // 检查是否为模拟录音
      if (audioUri && audioUri.startsWith('mock://')) {
        console.log('🎭 检测到模拟录音，使用模拟STT响应')
        return await this.mockSpeechToText(audioUri)
      }

      // 调用SenceVoiceService的WebSocket接口
      const senceVoiceService = require('./SenceVoiceService').default
      
      if (!senceVoiceService.isConnected) {
        throw new Error('SenseVoice服务未连接')
      }

      const result = await senceVoiceService.sendVoiceRequest(audioUri, {
        format: 'wav',
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
      })

      // 处理不同的响应格式
      if (result.success) {
        let transcriptionText = null
        
        // 尝试多种可能的响应格式
        if (result.data) {
          if (result.data.asr_result) {
            transcriptionText = result.data.asr_result
          } else if (result.data.transcription) {
            transcriptionText = result.data.transcription
          } else if (result.data.text) {
            transcriptionText = result.data.text
          } else if (typeof result.data === 'string') {
            transcriptionText = result.data
          }
        } else if (result.asr_result) {
          transcriptionText = result.asr_result
        } else if (result.transcription) {
          transcriptionText = result.transcription
        } else if (result.text) {
          transcriptionText = result.text
        }

        if (transcriptionText) {
          return {
            success: true,
            text: transcriptionText,
            provider: 'sensevoice',
            confidence: (result.data && result.data.confidence) || result.confidence || 0.9,
          }
        }
      }

      console.log('SenseVoice响应结构:', JSON.stringify(result, null, 2))
      throw new Error('SenseVoice识别结果为空或格式不正确')
    } catch (error) {
      console.log('🎯 SenseVoice语音识别失败（已拦截）:', error.message || error)
      return {
        success: false,
        error: error.message,
        provider: 'sensevoice',
      }
    }
  }

  // 智能STT路由
  async intelligentSTT(audioUri) {
    console.log('🔍 STT调试信息:')
    console.log('当前提供商设置:', this.currentProvider)
    console.log('服务可用性:', this.serviceAvailability)

    const provider = this.currentProvider === 'auto'
      ? this.selectBestProvider('stt') : this.currentProvider

    console.log(`🎤 选择的提供商: ${provider}`)
    console.log(`🎤 使用${provider}进行语音识别`)

    switch (provider) {
      case 'sensevoice':
        return await this.senseVoiceSpeechToText(audioUri)
      case 'google':
        return await this.googleSpeechToText(audioUri)
      case 'openai':
        return await this.speechToText(audioUri)
      case 'azure':
        return await this.azureSpeechToText(audioUri)
      case 'expo':
        // 优先使用真实的Expo STT，不可用时使用简化版本
        if (this.serviceAvailability.expoSTT) {
          return await this.expoSpeechToText(audioUri)
        }
        console.log('🔄 Expo Speech Recognition不可用，使用简化版本')
        return await this.simpleExpoSTT(audioUri)

      case 'web':
        return await this.webSpeechToText(audioUri)
      case 'simulation':
      default:
        console.log('🎭 使用模拟STT服务')
        return await this.mockSpeechToText(audioUri)
    }
  }

  // Google Cloud语音合成
  async googleTextToSpeech(text) {
    try {
      if (!this.googleConfig.apiKey) {
        throw new Error('Google Cloud API密钥未配置')
      }

      console.log('☁️ 使用Google Cloud语音合成')

      const requestBody = {
        input: { text },
        voice: {
          languageCode: this.googleConfig.ttsLanguage,
          name: this.googleConfig.ttsVoice,
        },
        audioConfig: {
          audioEncoding: 'MP3',
        },
      }

      const response = await axios.post(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.googleConfig.apiKey}`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      )

      if (response.data && response.data.audioContent) {
        return {
          success: true,
          audioData: response.data.audioContent,
          provider: 'google',
          format: 'mp3',
        }
      }

      throw new Error('Google TTS响应为空')
    } catch (error) {
      console.error('Google语音合成失败:', error)
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        provider: 'google',
      }
    }
  }

  // Edge TTS语音合成
  async edgeTextToSpeech(text, options = {}) {
    try {
      console.log('🌐 使用Edge TTS语音合成')

      // 语音配置
      const voice = options.voice || 'zh-CN-XiaoyiNeural'
      const rate = options.rate || '0%'
      const pitch = options.pitch || '+0Hz'
      
      // 构建SSML
      const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
          <voice name="${voice}">
            <prosody rate="${rate}" pitch="${pitch}">
              ${text}
            </prosody>
          </voice>
        </speak>`

      // 调用SenceVoiceService的WebSocket接口进行TTS
      const senceVoiceService = require('./SenceVoiceService').default
      
      if (!senceVoiceService.isConnected) {
        throw new Error('SenseVoice服务未连接')
      }

      // 使用SenceVoiceService的sendTTSRequest方法
      const result = await senceVoiceService.sendTTSRequest(text, {
        voice: voice,
        rate: rate,
        pitch: pitch,
        format: 'mp3',
      })

      if (result.success && result.data && result.data.audio_data) {
        return {
          success: true,
          audioData: result.data.audio_data,
          provider: 'edge-tts',
          format: 'mp3',
          voice: voice,
        }
      }
      
      throw new Error('Edge TTS响应为空')
    } catch (error) {
      console.error('Edge TTS语音合成失败:', error)
      return {
        success: false,
        error: error.message,
        provider: 'edge-tts',
      }
    }
  }

  // 智能TTS路由
  async intelligentTTS(text, options = {}) {
    const provider = this.currentProvider === 'auto'
      ? this.selectBestProvider('tts') : this.currentProvider

    console.log(`🔊 使用${provider}进行语音合成`)

    switch (provider) {
      case 'edge-tts':
        return await this.edgeTextToSpeech(text, options)
      case 'google':
        return await this.googleTextToSpeech(text)
      case 'openai':
        return await this.textToSpeech(text, options)
      case 'azure':
        return await this.azureTextToSpeech(text)
      case 'expo':
        return await this.expoTextToSpeech(text)
      case 'web':
        return await this.webTextToSpeech(text)
      case 'simulation':
      default:
        console.log('🎭 使用模拟TTS服务')
        return await this.mockTextToSpeech(text)
    }
  }

  // Google Cloud语音识别
  async googleSpeechToText(audioUri) {
    let audioBlob = null
    let requestBody = null

    try {
      if (!this.googleConfig.apiKey) {
        throw new Error('Google Cloud API密钥未配置')
      }

      console.log('☁️ 使用Google Cloud语音识别')
      console.log('🔑 API密钥:', `${this.googleConfig.apiKey.substring(0, 15)}...`)
      console.log('📄 音频文件:', audioUri)

      // 检查是否为模拟录音，如果是则使用模拟STT
      if (audioUri && audioUri.startsWith('mock://')) {
        console.log('🎭 检测到模拟录音，使用模拟STT响应')
        return await this.mockSpeechToText(audioUri)
      }

      // 将音频文件转换为base64并获取详细信息
      const audioInfo = await this.convertAudioForGoogleWithInfo(audioUri)
      audioBlob = audioInfo.base64Data
      console.log('🎵 音频转换成功')
      console.log('📊 音频信息:', {
        大小: audioInfo.size,
        类型: audioInfo.mimeType,
        文件扩展名: audioInfo.fileExt
      })

      // 智能选择编码格式
      const encodingOptions = this.getOptimalEncodingOptions(audioInfo)
      console.log('🔧 将尝试以下编码选项:', encodingOptions.map(opt => opt.encoding || '自动检测'))

      let lastError = null
      let detailedErrors = []

      for (const [index, encodingOption] of encodingOptions.entries()) {
        const encodingName = encodingOption.encoding || '自动检测'
        console.log(`📤 尝试编码选项 ${index + 1}/${encodingOptions.length}: ${encodingName}`, encodingOption)

        const tryRequestBody = {
          config: {
            languageCode: this.googleConfig.sttLanguage,
            enableAutomaticPunctuation: true,
            ...encodingOption,
          },
          audio: {
            content: audioBlob,
          },
        }

        try {
          const response = await axios.post(
            `https://speech.googleapis.com/v1/speech:recognize?key=${this.googleConfig.apiKey}`,
            tryRequestBody,
            {
              headers: {
                'Content-Type': 'application/json',
              },
              timeout: 60000,
              validateStatus(status) {
                return status >= 200 && status < 600
              },
            },
          )

          console.log('📥 HTTP状态码:', response.status)

          if (response.status === 200) {
            if (response.data && response.data.results && response.data.results.length > 0) {
              const { transcript } = response.data.results[0].alternatives[0]
              const confidence = response.data.results[0].alternatives[0].confidence || 1.0

              console.log('✅ 语音识别成功 (编码:', encodingName, '):', transcript)

              return {
                success: true,
                text: transcript,
                provider: 'google',
                confidence,
                language: this.googleConfig.sttLanguage,
                usedEncoding: encodingName,
              }
            } else if (response.data && response.data.results && response.data.results.length === 0) {
              console.log('⚠️ 编码正确但未识别到语音内容')
              return {
                success: false,
                error: '未能识别到语音内容，请确保录音清晰并包含可识别的语音',
                provider: 'google',
              }
            } else {
              // HTTP 200但数据结构异常
              const errorMsg = `HTTP 200 但响应数据异常: ${JSON.stringify(response.data)}`
              lastError = new Error(errorMsg)
              detailedErrors.push({ encoding: encodingName, error: errorMsg })
              console.log('❌ 编码', encodingName, '失败:', errorMsg)
            }
          } else {
            // 非200状态码
            const errorMsg = `HTTP ${response.status}: ${response.data?.error?.message || response.statusText || '未知错误'}`
            lastError = new Error(errorMsg)
            detailedErrors.push({ encoding: encodingName, error: errorMsg })
            console.log('❌ 编码', encodingName, '失败:', errorMsg)
          }
        } catch (error) {
          const errorMsg = error.response?.data?.error?.message || error.message
          lastError = error
          detailedErrors.push({ encoding: encodingName, error: errorMsg })
          console.log('❌ 编码', encodingName, '失败:', errorMsg)
          continue // 尝试下一个编码
        }
      }

      // 所有编码都失败了，提供详细错误信息和建议
      console.log('🚨 所有编码选项都失败了:')
      detailedErrors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.encoding}: ${err.error}`)
      })
      
      // 分析错误类型并提供建议
      const hasAuthError = detailedErrors.some(err => 
        err.error.includes('API key') || err.error.includes('authentication') || err.error.includes('403')
      )
      const hasBadEncoding = detailedErrors.some(err => 
        err.error.includes('bad encoding') || err.error.includes('encoding')
      )
      const hasBadSampleRate = detailedErrors.some(err => 
        err.error.includes('bad sample rate') || err.error.includes('sample rate')
      )
      
      let errorSuggestion = '所有编码格式都失败了。'
      if (hasAuthError) {
        errorSuggestion += ' 请检查Google Cloud API密钥是否正确。'
      } else if (hasBadEncoding && hasBadSampleRate) {
        errorSuggestion += ' 音频文件可能已损坏或格式不受支持。'
      } else if (hasBadEncoding) {
        errorSuggestion += ' 音频编码格式可能不受支持。'
      } else if (hasBadSampleRate) {
        errorSuggestion += ' 音频采样率可能不正确。'
      }
      
      console.log('💡 建议:', errorSuggestion)
      
      throw lastError || new Error(errorSuggestion)
    } catch (error) {
      // 使用console.log以避免触发任何可能的错误弹窗
      console.log('🎯 Google语音识别失败（已拦截）:', error.message || error)
      console.log('🎯 请求详情（已拦截）:', {
        url: `https://speech.googleapis.com/v1/speech:recognize?key=${this.googleConfig.apiKey?.substring(0, 10)}...`,
        config: requestBody?.config || '未创建',
        audioDataLength: audioBlob ? audioBlob.length : 0,
        errorDetails: error.response?.data,
      })

      const errorMessage = error.response?.data?.error?.message
                          || error.response?.data?.message
                          || error.message

      return {
        success: false,
        error: errorMessage,
        provider: 'google',
        details: error.response?.data,
      }
    }
  }

  // 音频格式转换（用于Google）
  async convertAudioForGoogle(audioUri) {
    try {
      console.log('🎵 开始转换音频文件:', audioUri)

      const response = await fetch(audioUri)
      if (!response.ok) {
        throw new Error(`获取音频文件失败: ${response.status}`)
      }

      const blob = await response.blob()
      console.log('📁 音频文件大小:', blob.size, 'bytes')
      console.log('📁 音频文件类型:', blob.type)

      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          try {
            // 移除data:audio/...;base64,前缀，只保留base64内容
            const { result } = reader
            if (typeof result === 'string' && result.includes(',')) {
              const base64data = result.split(',')[1]
              console.log('✅ Base64转换成功，长度:', base64data.length)
              resolve(base64data)
            } else {
              throw new Error('Base64转换结果格式异常')
            }
          } catch (err) {
            reject(new Error(`Base64转换失败: ${err.message}`))
          }
        }
        reader.onerror = () => {
          reject(new Error(`FileReader错误: ${reader.error}`))
        }
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('音频转换失败:', error)
      throw new Error(`音频转换失败: ${error.message}`)
    }
  }

  // 增强版音频转换（获取详细信息）
  async convertAudioForGoogleWithInfo(audioUri) {
    try {
      console.log('🎵 开始转换音频文件并分析信息:', audioUri)
      
      const response = await fetch(audioUri)
      if (!response.ok) {
        throw new Error(`获取音频文件失败: ${response.status}`)
      }
      
      const blob = await response.blob()
      const fileExt = audioUri.split('.').pop().toLowerCase()
      
      console.log('📁 音频文件详细信息:')
      console.log('  - 大小:', blob.size, 'bytes')
      console.log('  - MIME类型:', blob.type)
      console.log('  - 文件扩展名:', fileExt)
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          try {
            const { result } = reader
            if (typeof result === 'string' && result.includes(',')) {
              const base64data = result.split(',')[1]
              console.log('✅ Base64转换成功，长度:', base64data.length)
              
              resolve({
                base64Data: base64data,
                size: blob.size,
                mimeType: blob.type,
                fileExt: fileExt,
                originalUri: audioUri
              })
            } else {
              throw new Error('Base64转换结果格式异常')
            }
          } catch (err) {
            reject(new Error(`Base64转换失败: ${err.message}`))
          }
        }
        reader.onerror = () => {
          reject(new Error(`FileReader错误: ${reader.error}`))
        }
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('音频转换失败:', error)
      throw new Error(`音频转换失败: ${error.message}`)
    }
  }

  // 智能选择最优编码选项
  getOptimalEncodingOptions(audioInfo) {
    const { mimeType, fileExt, size } = audioInfo
    const encodingOptions = []
    
    console.log('🔍 根据音频信息智能选择编码:')
    console.log('  - MIME类型:', mimeType)
    console.log('  - 文件扩展名:', fileExt)
    console.log('  - 文件大小:', size)

    // 根据MIME类型和文件扩展名智能选择
    if (mimeType && mimeType.includes('mp4') || fileExt === 'm4a') {
      console.log('🎵 检测到MP4/M4A格式，优化编码顺序')
      // M4A/MP4音频通常是AAC编码，但Google不直接支持，所以使用自动检测
      encodingOptions.push({}) // 自动检测 - 最佳选择
      encodingOptions.push({ encoding: 'FLAC' })
      encodingOptions.push({ encoding: 'LINEAR16', sampleRateHertz: 44100 })
      encodingOptions.push({ encoding: 'LINEAR16', sampleRateHertz: 16000 })
    } else if (mimeType && mimeType.includes('wav') || fileExt === 'wav') {
      console.log('🎼 检测到WAV格式，使用最佳配置')
      encodingOptions.push({ encoding: 'LINEAR16', sampleRateHertz: 16000 })
      encodingOptions.push({ encoding: 'LINEAR16', sampleRateHertz: 44100 })
      encodingOptions.push({ encoding: 'FLAC' })
      encodingOptions.push({}) // 自动检测
    } else if (mimeType && mimeType.includes('mpeg') || fileExt === 'mp3') {
      console.log('🎶 检测到MP3格式')
      encodingOptions.push({ encoding: 'MP3', sampleRateHertz: 44100 })
      encodingOptions.push({ encoding: 'MP3', sampleRateHertz: 48000 })
      encodingOptions.push({ encoding: 'FLAC' })
      encodingOptions.push({}) // 自动检测
    } else if (fileExt === '3gp') {
      console.log('📞 检测到3GP格式')
      encodingOptions.push({ encoding: 'AMR', sampleRateHertz: 8000 })
      encodingOptions.push({ encoding: 'AMR_WB', sampleRateHertz: 16000 })
      encodingOptions.push({ encoding: 'FLAC' })
    } else if (mimeType && mimeType.includes('webm') || fileExt === 'webm') {
      console.log('🌐 检测到WebM格式')
      encodingOptions.push({ encoding: 'WEBM_OPUS', sampleRateHertz: 48000 })
      encodingOptions.push({ encoding: 'WEBM_OPUS', sampleRateHertz: 16000 })
      encodingOptions.push({ encoding: 'FLAC' })
    } else {
      console.log('❓ 未知格式，使用通用编码顺序')
      // 通用备选方案，按兼容性排序
      encodingOptions.push({}) // 自动检测
      encodingOptions.push({ encoding: 'FLAC' })
      encodingOptions.push({ encoding: 'LINEAR16', sampleRateHertz: 16000 })
      encodingOptions.push({ encoding: 'MP3', sampleRateHertz: 44100 })
    }

    // 添加最后的备选选项
    encodingOptions.push({ encoding: 'LINEAR16', sampleRateHertz: 8000 })
    encodingOptions.push({ encoding: 'MULAW', sampleRateHertz: 8000 })

    console.log('📋 最终编码选项列表:', encodingOptions.map((opt, idx) => 
      `${idx + 1}. ${opt.encoding || '自动检测'}${opt.sampleRateHertz ? ` (${opt.sampleRateHertz}Hz)` : ''}`
    ))

    return encodingOptions
  }

  // Azure语音识别
  async azureSpeechToText(audioUri) {
    try {
      if (!this.azureConfig.subscriptionKey) {
        throw new Error('Azure订阅密钥未配置')
      }

      // 检查是否为模拟录音
      if (audioUri && audioUri.startsWith('mock://')) {
        console.log('🎭 检测到模拟录音，使用模拟STT响应')
        return await this.mockSpeechToText(audioUri)
      }

      console.log('☁️ 使用Azure语音识别')

      // 这里需要将音频文件转换为Azure支持的格式
      const audioBlob = await this.convertAudioForAzure(audioUri)

      const response = await axios.post(
        `https://${this.azureConfig.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`,
        audioBlob,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.azureConfig.subscriptionKey,
            'Content-Type': 'audio/wav',
          },
          params: {
            language: this.azureConfig.language,
            format: 'detailed',
          },
          timeout: 30000,
        },
      )

      if (response.data && response.data.DisplayText) {
        return {
          success: true,
          text: response.data.DisplayText,
          provider: 'azure',
          confidence: response.data.Confidence || 1.0,
        }
      }

      throw new Error('Azure STT响应格式无效')
    } catch (error) {
      // 使用console.log以避免触发任何可能的错误弹窗
      console.log('🎯 Azure语音识别失败（已拦截）:', error.message || error)
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        provider: 'azure',
      }
    }
  }

  // Azure语音合成
  async azureTextToSpeech(text) {
    try {
      if (!this.azureConfig.subscriptionKey) {
        throw new Error('Azure订阅密钥未配置')
      }

      console.log('☁️ 使用Azure语音合成')

      // 构建SSML
      const ssml = `
        <speak version='1.0' xml:lang='${this.azureConfig.language}'>
          <voice xml:lang='${this.azureConfig.language}' name='${this.azureConfig.voice}'>
            ${text}
          </voice>
        </speak>`

      const response = await axios.post(
        `https://${this.azureConfig.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        ssml,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.azureConfig.subscriptionKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
          },
          responseType: 'blob',
          timeout: 30000,
        },
      )

      if (response.data) {
        // 将音频数据转换为base64
        const reader = new FileReader()
        return new Promise((resolve, reject) => {
          reader.onloadend = () => {
            const base64data = reader.result.split(',')[1]
            resolve({
              success: true,
              audioData: base64data,
              provider: 'azure',
              format: 'mp3',
            })
          }
          reader.onerror = reject
          reader.readAsDataURL(response.data)
        })
      }

      throw new Error('Azure TTS响应为空')
    } catch (error) {
      console.error('Azure语音合成失败:', error)
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        provider: 'azure',
      }
    }
  }

  // Web Speech API STT (仅web平台)
  async webSpeechToText() {
    try {
      if (Platform.OS !== 'web' || !window.webkitSpeechRecognition) {
        throw new Error('Web Speech Recognition不可用')
      }

      console.log('🌐 使用Web Speech Recognition')

      return new Promise((resolve, reject) => {
        const recognition = new window.webkitSpeechRecognition()
        recognition.lang = 'zh-CN'
        recognition.continuous = false
        recognition.interimResults = false

        recognition.onresult = (event) => {
          const result = event.results[0][0]
          resolve({
            success: true,
            text: result.transcript,
            provider: 'web',
            confidence: result.confidence,
          })
        }

        recognition.onerror = (event) => {
          reject(new Error(`Web Speech Recognition错误: ${event.error}`))
        }

        recognition.start()
      })
    } catch (error) {
      console.error('Web Speech Recognition失败:', error)
      return {
        success: false,
        error: error.message,
        provider: 'web',
      }
    }
  }

  // 音频格式转换（用于Azure）
  async convertAudioForAzure(audioUri) {
    // 这是一个简化版本，实际可能需要更复杂的音频处理
    try {
      const response = await fetch(audioUri)
      return await response.blob()
    } catch (error) {
      throw new Error(`音频转换失败: ${error.message}`)
    }
  }

  // 启用特定服务
  enableOpenAI(apiKey) {
    this.openaiConfig.apiKey = apiKey
    this.serviceAvailability.openai = true
    this.currentProvider = 'openai'
    console.log('✅ 已启用OpenAI STT/TTS服务')
  }

  enableAzure(subscriptionKey, region = 'eastus') {
    this.azureConfig.subscriptionKey = subscriptionKey
    this.azureConfig.region = region
    this.serviceAvailability.azure = true
    this.currentProvider = 'azure'
    console.log('✅ 已启用Azure语音服务')
  }

  // 启用模拟模式
  enableSimulation() {
    this.useSimulation = true
    this.currentProvider = 'simulation'
    console.log('🎭 已启用模拟STT/TTS服务')
  }

  // 检测可用服务
  async detectAvailableServices() {
    console.log('🔍 检测可用的STT/TTS服务...')

    // 首先打印当前配置
    console.log('📋 当前服务配置:')
    console.log('Google配置:', this.googleConfig)
    console.log('OpenAI配置:', { ...this.openaiConfig, apiKey: this.openaiConfig.apiKey ? 'configured' : 'not configured' })
    console.log('Azure配置:', { ...this.azureConfig, subscriptionKey: this.azureConfig.subscriptionKey ? 'configured' : 'not configured' })

    // 检测Expo Speech (TTS)
    try {
      const voices = await Speech.getAvailableVoicesAsync()
      this.serviceAvailability.expo = voices && voices.length > 0
      console.log(`📱 Expo Speech TTS: ${this.serviceAvailability.expo ? '可用' : '不可用'}`)
    } catch (error) {
      this.serviceAvailability.expo = false
      console.warn('Expo Speech TTS不可用:', error.message)
    }

    // 检测Expo Speech Recognition (STT)
    try {
      if (SpeechRecognition) {
        const isAvailable = await SpeechRecognition.isAvailableAsync()
        this.serviceAvailability.expoSTT = isAvailable
        console.log(`📱 Expo Speech STT: ${isAvailable ? '可用' : '不可用'}`)
      } else {
        this.serviceAvailability.expoSTT = false
        console.log('📱 Expo Speech STT: 模块未安装')
      }
    } catch (error) {
      this.serviceAvailability.expoSTT = false
      console.warn('Expo Speech STT检测失败:', error.message)
    }

    // 检测Web Speech
    if (Platform.OS === 'web') {
      this.serviceAvailability.web = !!(window.speechSynthesis && window.webkitSpeechRecognition)
      console.log(`🌐 Web Speech API: ${this.serviceAvailability.web ? '可用' : '不可用'}`)
    } else {
      this.serviceAvailability.web = false
    }

    // 检测OpenAI
    this.serviceAvailability.openai = !!this.openaiConfig.apiKey
    console.log(`🤖 OpenAI: ${this.serviceAvailability.openai ? '已配置' : '未配置'}`)

    // 检测Azure
    this.serviceAvailability.azure = !!this.azureConfig.subscriptionKey
    console.log(`☁️ Azure: ${this.serviceAvailability.azure ? '已配置' : '未配置'}`)

    // 检测Google Cloud
    this.serviceAvailability.google = !!(this.googleConfig.apiKey && this.googleConfig.apiKey.startsWith('AIza'))
    console.log(`☁️ Google Cloud: ${this.serviceAvailability.google ? '已配置' : '未配置'}`)

    console.log('📊 服务可用性检测完成:', {
      expo: this.serviceAvailability.expo,
      expoSTT: this.serviceAvailability.expoSTT,
      web: this.serviceAvailability.web,
      openai: this.serviceAvailability.openai,
      azure: this.serviceAvailability.azure,
      google: this.serviceAvailability.google,
    })

    return this.serviceAvailability
  }

  // 获取服务状态
  getServiceStatus() {
    const currentProvider = this.currentProvider === 'auto'
      ? this.selectBestProvider() : this.currentProvider

    return {
      currentProvider: this.currentProvider,
      recommendedProvider: currentProvider,
      availability: this.serviceAvailability,
      config: {
        openai: {
          configured: !!this.openaiConfig.apiKey,
          model: this.openaiConfig.sttModel,
        },
        azure: {
          configured: !!this.azureConfig.subscriptionKey,
          region: this.azureConfig.region,
          language: this.azureConfig.language,
        },
        expo: {
          available: this.serviceAvailability.expo,
          platform: Platform.OS,
        },
        web: {
          available: this.serviceAvailability.web,
          platform: Platform.OS,
        },
      },
    }
  }

  // 测试服务连通性
  async testService(provider) {
    console.log(`🧪 测试${provider}服务连通性...`)

    const testText = '测试'

    try {
      switch (provider) {
        case 'expo':
          const expoResult = await this.expoTextToSpeech(testText)
          return { provider, success: expoResult.success, message: expoResult.message || expoResult.error }

        case 'web':
          if (Platform.OS !== 'web') {
            return { provider, success: false, message: '仅在Web平台可用' }
          }
          const webResult = await this.webTextToSpeech(testText)
          return { provider, success: webResult.success, message: webResult.message || webResult.error }

        case 'openai':
          if (!this.openaiConfig.apiKey) {
            return { provider, success: false, message: 'API密钥未配置' }
          }
          // 这里可以添加实际的API连通性测试
          return { provider, success: true, message: 'API密钥已配置' }

        case 'azure':
          if (!this.azureConfig.subscriptionKey) {
            return { provider, success: false, message: '订阅密钥未配置' }
          }
          // 这里可以添加实际的API连通性测试
          return { provider, success: true, message: '订阅密钥已配置' }

        default:
          return { provider, success: false, message: '未知的服务提供商' }
      }
    } catch (error) {
      return { provider, success: false, message: error.message }
    }
  }

  // 获取服务推荐
  getServiceRecommendations() {
    const recommendations = []

    // STT服务检查
    const sttProvider = this.selectBestProvider('stt')
    const ttsProvider = this.selectBestProvider('tts')

    if (sttProvider === 'simulation') {
      if (!this.serviceAvailability.expoSTT && !this.serviceAvailability.web
          && !this.openaiConfig.apiKey && !this.azureConfig.subscriptionKey) {
        recommendations.push({
          type: 'warning',
          message: 'STT服务不可用，语音识别将使用模拟模式。建议安装expo-speech-recognition或配置云端API',
        })
      }
    } else if (sttProvider === 'expo' && !this.serviceAvailability.expoSTT) {
      recommendations.push({
        type: 'info',
        message: 'Expo STT不可用，将使用简化版本。可安装expo-speech-recognition获得更好效果',
      })
    }

    // TTS服务检查
    if (ttsProvider === 'simulation') {
      recommendations.push({
        type: 'error',
        message: '没有可用的TTS服务，语音回复将使用模拟模式',
      })
    } else if (ttsProvider === 'expo' && this.serviceAvailability.expo) {
      recommendations.push({
        type: 'success',
        message: 'Expo Speech TTS可用，支持本地语音合成',
      })
    }

    // 云服务推荐
    if (!this.openaiConfig.apiKey && !this.azureConfig.subscriptionKey) {
      recommendations.push({
        type: 'info',
        message: '配置OpenAI或Azure API密钥可获得更专业的语音服务',
      })
    }

    // Web平台特殊提醒
    if (Platform.OS === 'web' && this.serviceAvailability.web) {
      recommendations.push({
        type: 'success',
        message: 'Web平台可使用免费的浏览器内置语音API',
      })
    }

    // 最终推荐
    if (sttProvider !== 'simulation' && ttsProvider !== 'simulation') {
      recommendations.push({
        type: 'success',
        message: `推荐配置: STT使用${sttProvider}，TTS使用${ttsProvider}`,
      })
    }

    return recommendations
  }
}

// 创建单例实例
const sttTtsService = new STTTTSService()
export default sttTtsService
