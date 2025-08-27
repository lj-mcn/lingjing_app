import { Audio } from 'expo-av'
import appConfig from '../../config/AppConfig'

class SiliconFlowTTS {
  constructor() {
    this.config = appConfig.sttTts.voice_service.tts
    this.sound = null
    this.onSpeechComplete = null // 播放完成回调
    this.onInterrupted = null // 被打断回调
  }

  async textToSpeech(text, options = {}) {
    try {
      const voice_style = options.voice_style || this.config.voice_style || '中文女'
      const playImmediately = options.playImmediately !== false // 默认播放

      // 不再在文本中添加语音标签，直接使用原始文本
      const clean_text = text.trim()

      console.log(`🔊 嘎巴龙说: ${text.length > 30 ? `${text.substring(0, 30)}...` : text}`)

      // SiliconFlow CosyVoice2-0.5B API 需要正确的 voice 参数格式
      const modelName = 'FunAudioLLM/CosyVoice2-0.5B'

      // 根据语音风格映射到正确的 voice 参数
      const voiceMapping = {
        中文女: 'FunAudioLLM/CosyVoice2-0.5B:alex',
        中文男: 'FunAudioLLM/CosyVoice2-0.5B:alex', // 可能需要其他预设语音
        英文女: 'FunAudioLLM/CosyVoice2-0.5B:alex',
        英文男: 'FunAudioLLM/CosyVoice2-0.5B:alex',
        日语女: 'FunAudioLLM/CosyVoice2-0.5B:alex',
        韩语女: 'FunAudioLLM/CosyVoice2-0.5B:alex',
        粤语女: 'FunAudioLLM/CosyVoice2-0.5B:alex',
        四川话女: 'FunAudioLLM/CosyVoice2-0.5B:alex',
      }

      const voiceId = voiceMapping[voice_style] || 'FunAudioLLM/CosyVoice2-0.5B:alex'

      const requestBody = {
        model: modelName,
        input: clean_text, // 使用清理后的文本，不包含语音标签
        voice: voiceId,
        response_format: 'wav', // 使用WAV格式避免压缩失真
        speed: 1.0,
        volume: 0.8, // 降低音量避免爆音
      }

      // 移除详细的技术日志

      const response = await fetch(this.config.api_endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appConfig.siliconflow.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('❌ SiliconFlow TTS API 错误响应:')
        console.error('- 状态码:', response.status)
        console.error('- 状态文本:', response.statusText)
        console.error('- 错误详情:', error)
        throw new Error(`SiliconFlow TTS API error: ${response.status} - ${error}`)
      }

      // 处理音频数据

      let audioUri
      let audioBase64

      try {
        // 获取二进制音频数据
        const audioArrayBuffer = await response.arrayBuffer()

        // 音频质量验证
        const qualityCheck = this.validateAudioQuality(audioArrayBuffer)
        if (!qualityCheck.valid) {
          throw new Error(`音频质量检查失败: ${qualityCheck.reason}`)
        }

        // 转换为base64
        audioBase64 = this.arrayBufferToBase64(audioArrayBuffer)

        // 音频数据规范化 - 确保正确的MIME类型
        const contentType = response.headers.get('content-type') || 'audio/wav'
        let mimeType = 'audio/wav' // 默认为WAV

        if (contentType.includes('mpeg') || contentType.includes('mp3')) {
          mimeType = 'audio/mpeg'
        } else if (contentType.includes('wav')) {
          mimeType = 'audio/wav'
        }

        // 创建数据URI
        audioUri = `data:${mimeType};base64,${audioBase64}`
      } catch (error) {
        console.error('❌ 音频数据处理失败:', error.message)
        throw new Error(`音频数据处理失败: ${error.message}`)
      }

      // 根据选项决定是否播放音频
      if (playImmediately) {
        await this.playAudio(audioUri)
      }

      return {
        success: true,
        provider: 'siliconflow',
        audioData: audioBase64,
        audioUri: audioUri,
        format: 'wav',
        message: `TTS完成: ${text.length}字符`,
        playImmediately: playImmediately,
      }
    } catch (error) {
      console.error('SiliconFlow TTS失败:', error)
      return {
        success: false,
        error: error.message,
        provider: 'siliconflow',
      }
    }
  }

  async playAudio(audioUri) {
    try {
      // 停止之前播放的音频
      if (this.sound) {
        await this.sound.unloadAsync()
      }

      // 音频播放前的预检查
      if (!audioUri || !audioUri.startsWith('data:audio/')) {
        throw new Error('无效的音频URI')
      }

      // 创建新的音频对象 - 优化播放参数
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        {
          shouldPlay: true,
          volume: 0.7, // 降低播放音量防止爆音
          rate: 1.0,
          positionMillis: 0,
          progressUpdateIntervalMillis: 100,
          isLooping: false,
          // 添加音频渲染优化
          audioPan: 0,
          pitchCorrectionQuality: Audio.PitchCorrectionQuality.High,
        },
      )

      this.sound = sound

      // 监听播放状态更新
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          this.cleanupSound()
          // 通知DigitalAssistant AI说话完成
          if (this.onSpeechComplete) {
            this.onSpeechComplete()
          }
        }

        if (status.error) {
          console.error('❌ 音频播放错误:', status.error)
        }
      })

      // 返回播放状态，供外部监控
      return {
        success: true,
        duration: await sound.getStatusAsync().then((s) => s.durationMillis),
      }
    } catch (error) {
      console.error('播放音频失败:', error)
      throw error
    }
  }

  async cleanupSound() {
    try {
      if (this.sound) {
        await this.sound.unloadAsync()
        this.sound = null
      }
    } catch (error) {
      console.warn('清理音频资源失败:', error)
    }
  }

  arrayBufferToBase64(buffer) {
    try {
      // 高效的二进制转base64方法
      const bytes = new Uint8Array(buffer)

      // 对于大文件，使用分块处理避免内存溢出
      if (bytes.length > 1024 * 1024) { // 超过1MB分块处理
        console.log('🔄 处理大音频文件，使用分块转换...')
        let binary = ''
        const chunkSize = 8192

        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.slice(i, i + chunkSize)
          binary += String.fromCharCode.apply(null, chunk)
        }
        return btoa(binary)
      }
      // 小文件直接处理
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      return btoa(binary)
    } catch (error) {
      console.error('❌ Base64转换失败:', error.message)
      throw new Error(`Base64转换失败: ${error.message}`)
    }
  }

  // 安全的二进制字符串转base64方法
  safeBinaryToBase64(binaryString) {
    try {
      console.log('🔄 开始安全转换，原始数据长度:', binaryString.length)

      // 检查数据是否包含非ASCII字符
      let hasNonAscii = false
      for (let i = 0; i < Math.min(100, binaryString.length); i++) {
        if (binaryString.charCodeAt(i) > 127) {
          hasNonAscii = true
          break
        }
      }

      console.log('🔍 数据包含非ASCII字符:', hasNonAscii)

      if (hasNonAscii) {
        // 包含非ASCII字符，需要字节级处理
        const uint8Array = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i) & 0xff
        }
        return this.arrayBufferToBase64(uint8Array.buffer)
      }
      // 纯ASCII，直接使用btoa
      return btoa(binaryString)
    } catch (error) {
      console.error('❌ 安全转换失败:', error.message)
      throw new Error(`安全转换失败: ${error.message}`)
    }
  }

  // 将二进制字符串转换为base64（保留原方法作为备用）
  binaryStringToBase64(binaryString) {
    try {
      // 方法1：直接使用 btoa（如果数据是正确的二进制字符串）
      return btoa(binaryString)
    } catch (error) {
      console.warn('⚠️ btoa转换失败，尝试字节级转换:', error.message)

      try {
        // 方法2：字节级转换
        let binary = ''
        for (let i = 0; i < binaryString.length; i++) {
          const byte = binaryString.charCodeAt(i) & 0xff
          binary += String.fromCharCode(byte)
        }
        return btoa(binary)
      } catch (byteError) {
        console.error('❌ 字节级转换也失败:', byteError.message)
        throw new Error('无法转换二进制数据为base64')
      }
    }
  }

  // 检查字符串是否为base64格式
  isBase64(str) {
    try {
      // base64字符串的基本特征检查
      if (typeof str !== 'string') return false

      // 移除可能的空白字符
      const cleanStr = str.trim()

      // 检查长度是否合理（太短不可能是有效的音频数据）
      if (cleanStr.length < 100) return false

      // base64字符串长度应该是4的倍数（padding后）
      if (cleanStr.length % 4 !== 0) return false

      // 检查是否只包含base64字符
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
      if (!base64Regex.test(cleanStr)) return false

      // 尝试解码以确认
      try {
        const decoded = atob(cleanStr.substring(0, 100)) // 只测试前100个字符
        return decoded.length > 0
      } catch (e) {
        return false
      }
    } catch (error) {
      return false
    }
  }

  // 音频质量验证方法
  validateAudioQuality(audioArrayBuffer) {
    const audioSize = audioArrayBuffer.byteLength

    // 基本大小检查
    if (audioSize === 0) {
      return { valid: false, reason: '音频数据为空' }
    }

    if (audioSize < 1000) {
      return { valid: false, reason: '音频数据过小，可能损坏' }
    }

    // WAV文件头检查 (如果是WAV格式)
    const bytes = new Uint8Array(audioArrayBuffer)

    // 检查WAV文件签名 "RIFF"
    if (bytes.length >= 12) {
      const riffHeader = String.fromCharCode(...bytes.slice(0, 4))
      const waveHeader = String.fromCharCode(...bytes.slice(8, 12))

      if (riffHeader === 'RIFF' && waveHeader === 'WAVE') {
        console.log('✅ 检测到有效的WAV文件格式')
        return { valid: true, format: 'wav', size: audioSize }
      }
    }

    // 检查MP3文件头
    if (bytes.length >= 3) {
      // MP3文件以ID3标签或音频帧开始
      if ((bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) // MP3帧同步
          || (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)) { // ID3标签
        console.log('✅ 检测到有效的MP3文件格式')
        return { valid: true, format: 'mp3', size: audioSize }
      }
    }

    console.warn('⚠️ 无法识别音频文件格式，但大小正常')
    return { valid: true, format: 'unknown', size: audioSize }
  }

  // 检查服务是否可用
  isAvailable() {
    return !!(appConfig.siliconflow && appConfig.siliconflow.api_key && this.config.api_endpoint)
  }

  // 获取支持的语音列表
  getAvailableVoices() {
    return this.config.available_speakers || ['中文女']
  }

  // 设置播放完成回调
  setSpeechCompleteCallback(callback) {
    this.onSpeechComplete = callback
  }

  // 设置被打断回调
  setInterruptedCallback(callback) {
    this.onInterrupted = callback
  }

  // 立即停止当前播放（用于用户打断）
  async stopCurrentPlayback() {
    try {
      if (this.sound) {
        await this.sound.stopAsync()
        await this.sound.unloadAsync()
        this.sound = null

        // 触发打断回调
        if (this.onInterrupted) {
          this.onInterrupted()
        }

        console.log('🛑 用户打断，AI停止说话')
        return true
      }
      return false
    } catch (error) {
      console.error('停止播放失败:', error)
      return false
    }
  }

  // 直接播放预生成的音频URI并等待完成
  async playAudioUri(audioUri) {
    return new Promise(async (resolve, reject) => {
      try {
        // 临时保存原回调
        const originalCallback = this.onSpeechComplete
        
        // 设置完成回调
        this.onSpeechComplete = () => {
          this.onSpeechComplete = originalCallback // 恢复原回调
          if (originalCallback) originalCallback()
          resolve()
        }
        
        // 开始播放
        await this.playAudio(audioUri)
      } catch (error) {
        reject(error)
      }
    })
  }

  // 销毁实例时清理资源
  async destroy() {
    await this.cleanupSound()
  }
}

// 创建单例
const siliconFlowTTS = new SiliconFlowTTS()

export default siliconFlowTTS
