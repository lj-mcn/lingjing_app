const crypto = require('crypto')

/**
 * 音频处理缓存管理器
 */
class AudioCache {
  constructor() {
    this.sttCache = new Map()
    this.ttsCache = new Map()
    this.maxCacheSize = 100
    this.cacheTTL = 24 * 60 * 60 * 1000 // 24小时
  }

  /**
   * 生成音频数据的哈希值
   * @param {string} audioData - 音频数据
   * @return {string} - 哈希值
   */
  generateHash(audioData) {
    return crypto.createHash('md5').update(audioData).digest('hex')
  }

  /**
   * 获取STT缓存结果
   * @param {string} audioHash - 音频哈希值
   * @return {Object|null} - 缓存结果
   */
  getCachedSTT(audioHash) {
    const cached = this.sttCache.get(audioHash)
    if (!cached) return null

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.sttCache.delete(audioHash)
      return null
    }

    console.log(`STT缓存命中: ${audioHash}`)
    return cached.result
  }

  /**
   * 设置STT缓存
   * @param {string} audioHash - 音频哈希值
   * @param {string} result - STT结果
   */
  setCachedSTT(audioHash, result) {
    // 限制缓存大小
    if (this.sttCache.size >= this.maxCacheSize) {
      const firstKey = this.sttCache.keys().next().value
      this.sttCache.delete(firstKey)
    }

    this.sttCache.set(audioHash, {
      result,
      timestamp: Date.now()
    })
    console.log(`STT结果已缓存: ${audioHash}`)
  }

  /**
   * 获取TTS缓存结果
   * @param {string} textHash - 文本哈希值
   * @return {Object|null} - 缓存结果
   */
  getCachedTTS(textHash) {
    const cached = this.ttsCache.get(textHash)
    if (!cached) return null

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.ttsCache.delete(textHash)
      return null
    }

    console.log(`TTS缓存命中: ${textHash}`)
    return cached.result
  }

  /**
   * 设置TTS缓存
   * @param {string} textHash - 文本哈希值
   * @param {string} result - TTS结果URL
   */
  setCachedTTS(textHash, result) {
    // 限制缓存大小
    if (this.ttsCache.size >= this.maxCacheSize) {
      const firstKey = this.ttsCache.keys().next().value
      this.ttsCache.delete(firstKey)
    }

    this.ttsCache.set(textHash, {
      result,
      timestamp: Date.now()
    })
    console.log(`TTS结果已缓存: ${textHash}`)
  }

  /**
   * 清理过期缓存
   */
  cleanExpiredCache() {
    const now = Date.now()
    
    // 清理STT缓存
    for (const [key, value] of this.sttCache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.sttCache.delete(key)
      }
    }

    // 清理TTS缓存
    for (const [key, value] of this.ttsCache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.ttsCache.delete(key)
      }
    }

    console.log(`缓存清理完成，STT: ${this.sttCache.size}, TTS: ${this.ttsCache.size}`)
  }

  /**
   * 获取缓存统计信息
   * @return {Object} - 缓存统计
   */
  getCacheStats() {
    return {
      sttCacheSize: this.sttCache.size,
      ttsCacheSize: this.ttsCache.size,
      maxCacheSize: this.maxCacheSize,
      cacheTTL: this.cacheTTL
    }
  }
}

// 创建全局缓存实例
const audioCache = new AudioCache()

// 定期清理过期缓存
setInterval(() => {
  audioCache.cleanExpiredCache()
}, 60 * 60 * 1000) // 每小时清理一次

module.exports = audioCache