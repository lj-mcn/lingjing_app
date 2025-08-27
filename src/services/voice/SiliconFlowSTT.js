import appConfig from '../../config/AppConfig'

class SiliconFlowSTT {
  constructor() {
    this.config = {
      api_endpoint: appConfig.siliconflow?.stt?.endpoint || 'https://api.siliconflow.cn/v1/audio/transcriptions',
      model: appConfig.siliconflow?.stt?.model || 'FunAudioLLM/SenseVoiceSmall',
      api_key: appConfig.siliconflow?.api_key,
      enabled: appConfig.siliconflow?.stt?.enabled || false,
      supported_formats: appConfig.siliconflow?.stt?.supported_formats || ['wav', 'mp3', 'm4a', 'flac'],
      max_file_size: appConfig.siliconflow?.stt?.max_file_size || '25MB',
    }
  }

  async speechToText(audioUri) {
    try {
      if (!this.config.api_key) {
        throw new Error('SiliconFlow API密钥未配置')
      }

      if (!audioUri || audioUri.startsWith('simulation://')) {
        throw new Error('无效的音频文件路径')
      }

      // 准备FormData
      const formData = new FormData()
      formData.append('model', this.config.model)

      // 处理音频文件
      if (audioUri.startsWith('file://')) {
        // 本地文件路径，需要读取文件内容
        formData.append('file', {
          uri: audioUri,
          type: 'audio/wav',
          name: 'recording.wav',
        })
      } else {
        // 其他情况的处理
        throw new Error('不支持的音频文件格式')
      }
      const response = await fetch(this.config.api_endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.api_key}`,
          // 不要手动设置Content-Type，让fetch自动处理FormData的Content-Type
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ SiliconFlow STT API 错误响应:')
        console.error('- 状态码:', response.status)
        console.error('- 状态文本:', response.statusText)
        console.error('- 错误详情:', errorText)
        throw new Error(`SiliconFlow STT API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      if (!data.text) {
        throw new Error('API响应中缺少文本内容')
      }

      return {
        success: true,
        text: data.text,
        provider: 'siliconflow_stt',
        model: this.config.model,
      }
    } catch (error) {
      console.error('❌ SiliconFlow STT失败:', error.message)
      return {
        success: false,
        error: error.message,
        provider: 'siliconflow_stt',
      }
    }
  }

  // 检查服务是否可用
  isAvailable() {
    const available = !!(this.config.enabled && this.config.api_key && this.config.api_endpoint)
    console.log('🔍 SiliconFlow STT 可用性检查:', available)
    if (!available) {
      console.log('- 缺少配置:', {
        isEnabled: this.config.enabled,
        hasApiKey: !!this.config.api_key,
        hasEndpoint: !!this.config.api_endpoint,
      })
    }
    return available
  }

  // 获取支持的模型列表
  getSupportedModels() {
    return [
      'FunAudioLLM/SenseVoiceSmall',
      // 可以添加其他支持的模型
    ]
  }

  // 获取服务信息
  getServiceInfo() {
    return {
      provider: 'SiliconFlow',
      service: 'Speech-to-Text',
      model: this.config.model,
      endpoint: this.config.api_endpoint,
      available: this.isAvailable(),
    }
  }
}

// 创建单例
const siliconFlowSTT = new SiliconFlowSTT()

export default siliconFlowSTT
