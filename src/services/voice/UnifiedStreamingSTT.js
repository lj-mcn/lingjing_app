import webSpeechSTT from './WebSpeechSTT'
import streamingSTTService from '../assistant/StreamingSTTService'
import appConfig from '../../config/AppConfig'

class UnifiedStreamingSTT {
  constructor() {
    this.currentProvider = null
    this.availableProviders = []
    this.isStreaming = false
    this.callbacks = {
      onPartialResult: null,
      onFinalResult: null,
      onError: null,
    }

    // 配置优先级：Web Speech API > 优化后的伪流式
    this.providerPriority = [
      'web_speech',
      'enhanced_streaming', // 优化后的StreamingSTTService
      'basic_streaming', // 原始的StreamingSTTService
    ]
  }

  async initialize() {
    try {
      console.log('🔍 检测可用的流式STT服务...')
      this.availableProviders = []

      // 检测Web Speech API
      if (webSpeechSTT.isAvailable()) {
        this.availableProviders.push({
          name: 'web_speech',
          provider: webSpeechSTT,
          priority: 1,
          isRealStreaming: true,
          description: '浏览器原生语音识别 (真流式)',
        })
        console.log('✅ Web Speech API 可用')
      }

      // 检测优化后的流式STT
      if (streamingSTTService.isAvailable()) {
        this.availableProviders.push({
          name: 'enhanced_streaming',
          provider: streamingSTTService,
          priority: 2,
          isRealStreaming: false,
          description: '优化的准流式STT (SiliconFlow后端)',
        })
        console.log('✅ 优化流式STT 可用')
      }

      // 选择最优提供商
      this.selectBestProvider()

      console.log(`🎯 选定STT提供商: ${this.currentProvider?.name}`)
      return { success: true, provider: this.currentProvider?.name }
    } catch (error) {
      console.error('❌ 统一流式STT初始化失败:', error)
      return { success: false, error: error.message }
    }
  }

  selectBestProvider() {
    // 按优先级排序
    this.availableProviders.sort((a, b) => a.priority - b.priority)

    // 选择第一个可用的提供商
    this.currentProvider = this.availableProviders[0] || null

    if (this.currentProvider) {
      console.log(`📡 使用 ${this.currentProvider.description}`)
    } else {
      console.warn('⚠️ 没有可用的流式STT服务')
    }
  }

  setCallbacks({ onPartialResult, onFinalResult, onError }) {
    this.callbacks.onPartialResult = onPartialResult
    this.callbacks.onFinalResult = onFinalResult
    this.callbacks.onError = onError

    // 设置当前提供商的回调
    if (this.currentProvider) {
      if (this.currentProvider.name === 'web_speech') {
        this.currentProvider.provider.setCallbacks({
          onPartialResult: (result) => {
            if (this.callbacks.onPartialResult) {
              this.callbacks.onPartialResult({
                ...result,
                provider: 'web_speech',
                isRealStreaming: true,
              })
            }
          },
          onFinalResult: (result) => {
            if (this.callbacks.onFinalResult) {
              this.callbacks.onFinalResult({
                ...result,
                provider: 'web_speech',
                isRealStreaming: true,
              })
            }
          },
          onError: this.callbacks.onError,
        })
      } else {
        // 优化后的流式STT
        this.currentProvider.provider.setCallbacks({
          onPartialTranscript: (result) => {
            if (this.callbacks.onPartialResult) {
              this.callbacks.onPartialResult({
                text: result.text,
                isFinal: result.isFinal,
                timestamp: result.timestamp,
                confidence: result.confidence || 0.8,
                provider: this.currentProvider.name,
                isRealStreaming: false,
                isIncremental: result.isIncremental,
              })
            }
          },
          onFinalTranscript: (result) => {
            if (this.callbacks.onFinalResult) {
              this.callbacks.onFinalResult({
                text: result.text,
                isFinal: true,
                timestamp: result.timestamp,
                confidence: result.confidence || 0.9,
                provider: this.currentProvider.name,
                isRealStreaming: false,
                partialCount: result.partialCount,
              })
            }
          },
          onError: this.callbacks.onError,
        })
      }
    }
  }

  async startStreaming() {
    try {
      if (!this.currentProvider) {
        throw new Error('没有可用的流式STT提供商')
      }

      if (this.isStreaming) {
        console.log('流式STT已在运行中')
        return { success: true, provider: this.currentProvider.name }
      }

      console.log(`🎤 启动流式STT: ${this.currentProvider.name}`)

      const result = await this.currentProvider.provider.startStreaming()
      if (result.success) {
        this.isStreaming = true
        return {
          success: true,
          provider: this.currentProvider.name,
          isRealStreaming: this.currentProvider.isRealStreaming,
          description: this.currentProvider.description,
        }
      }
      throw new Error(result.error)
    } catch (error) {
      console.error('❌ 启动流式STT失败:', error)

      // 尝试切换到备用提供商
      const fallbackResult = await this.tryFallbackProvider()
      if (fallbackResult.success) {
        return fallbackResult
      }

      return { success: false, error: error.message }
    }
  }

  async tryFallbackProvider() {
    console.log('🔄 尝试使用备用STT提供商...')

    // 找到下一个可用的提供商
    const currentIndex = this.availableProviders.findIndex(
      (p) => p.name === this.currentProvider?.name,
    )

    if (currentIndex >= 0 && currentIndex < this.availableProviders.length - 1) {
      this.currentProvider = this.availableProviders[currentIndex + 1]
      console.log(`🔄 切换到备用提供商: ${this.currentProvider.name}`)

      // 重新设置回调
      this.setCallbacks(this.callbacks)

      // 尝试启动
      const result = await this.currentProvider.provider.startStreaming()
      if (result.success) {
        this.isStreaming = true
        return {
          success: true,
          provider: this.currentProvider.name,
          isRealStreaming: this.currentProvider.isRealStreaming,
          description: this.currentProvider.description,
          isFallback: true,
        }
      }
    }

    return { success: false, error: '所有STT提供商都不可用' }
  }

  async stopStreaming() {
    try {
      if (!this.isStreaming || !this.currentProvider) {
        return { success: true }
      }

      console.log(`🛑 停止流式STT: ${this.currentProvider.name}`)

      const result = await this.currentProvider.provider.stopStreaming()
      this.isStreaming = false

      return {
        success: result.success,
        provider: this.currentProvider.name,
        finalText: result.finalText,
        error: result.error,
      }
    } catch (error) {
      console.error('❌ 停止流式STT失败:', error)
      this.isStreaming = false
      return { success: false, error: error.message }
    }
  }

  // 添加音频块（仅对伪流式有效）
  async addAudioChunk(audioChunk) {
    if (this.currentProvider
        && this.currentProvider.name !== 'web_speech'
        && this.currentProvider.provider.addAudioChunk) {
      return await this.currentProvider.provider.addAudioChunk(audioChunk)
    }
  }

  // 获取当前状态
  getCurrentStatus() {
    const baseStatus = {
      isStreaming: this.isStreaming,
      currentProvider: this.currentProvider?.name || null,
      isRealStreaming: this.currentProvider?.isRealStreaming || false,
      availableProviders: this.availableProviders.map((p) => ({
        name: p.name,
        description: p.description,
        isRealStreaming: p.isRealStreaming,
        priority: p.priority,
      })),
    }

    // 获取当前提供商的详细状态
    if (this.currentProvider && this.currentProvider.provider.getCurrentStatus) {
      baseStatus.providerStatus = this.currentProvider.provider.getCurrentStatus()
    }

    return baseStatus
  }

  // 获取推荐配置
  getRecommendations() {
    const recommendations = []

    if (this.availableProviders.length === 0) {
      recommendations.push({
        type: 'error',
        message: '没有可用的流式STT服务，语音功能将不可用',
      })
    } else if (this.currentProvider?.name === 'enhanced_streaming') {
      recommendations.push({
        type: 'info',
        message: '使用准流式STT，延迟较真流式稍高但功能完整',
      })
    } else if (this.currentProvider?.name === 'web_speech') {
      recommendations.push({
        type: 'success',
        message: '使用浏览器原生语音识别，真流式体验最佳',
      })
    }

    if (this.availableProviders.length > 1) {
      recommendations.push({
        type: 'info',
        message: `检测到${this.availableProviders.length}个STT服务，将自动选择最佳方案`,
      })
    }

    return recommendations
  }

  // 手动切换提供商
  async switchProvider(providerName) {
    const targetProvider = this.availableProviders.find((p) => p.name === providerName)
    if (!targetProvider) {
      throw new Error(`未找到提供商: ${providerName}`)
    }

    // 如果正在流式处理，先停止
    if (this.isStreaming) {
      await this.stopStreaming()
    }

    this.currentProvider = targetProvider
    console.log(`🔄 手动切换到提供商: ${providerName}`)

    // 重新设置回调
    this.setCallbacks(this.callbacks)

    return {
      success: true,
      newProvider: providerName,
      description: targetProvider.description,
    }
  }

  isAvailable() {
    return this.availableProviders.length > 0
  }

  async cleanup() {
    try {
      console.log('🧹 清理统一流式STT服务...')

      if (this.isStreaming) {
        await this.stopStreaming()
      }

      this.currentProvider = null
      this.isStreaming = false
      this.callbacks = {
        onPartialResult: null,
        onFinalResult: null,
        onError: null,
      }

      console.log('✅ 统一流式STT服务清理完成')
    } catch (error) {
      console.error('❌ 统一流式STT服务清理失败:', error)
    }
  }
}

// 创建单例
const unifiedStreamingSTT = new UnifiedStreamingSTT()
export default unifiedStreamingSTT
