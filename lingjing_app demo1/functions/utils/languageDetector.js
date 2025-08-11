/**
 * 语言检测工具
 */
class LanguageDetector {
  constructor() {
    // 语言模式匹配规则
    this.languagePatterns = {
      'zh': {
        patterns: [/[\u4e00-\u9fff]/, /[\u3400-\u4dbf]/],
        keywords: ['你好', '谢谢', '不客气', '对不起', '再见'],
        name: '中文',
        confidence: 0.9
      },
      'en': {
        patterns: [/^[a-zA-Z\s\.,\?!'"]+$/],
        keywords: ['hello', 'thanks', 'please', 'sorry', 'goodbye', 'yes', 'no'],
        name: '英文',
        confidence: 0.8
      },
      'ja': {
        patterns: [/[\u3040-\u309f]/, /[\u30a0-\u30ff]/],
        keywords: ['こんにちは', 'ありがとう', 'すみません', 'さようなら'],
        name: '日文',
        confidence: 0.85
      },
      'ko': {
        patterns: [/[\uac00-\ud7af]/, /[\u1100-\u11ff]/, /[\u3130-\u318f]/],
        keywords: ['안녕하세요', '감사합니다', '죄송합니다', '안녕히 가세요'],
        name: '韩文',
        confidence: 0.85
      }
    }

    // 语言到音色的映射
    this.languageSpkMap = {
      "zh": {
        "中文女": "中文女",
        "中文男": "中文男", 
        "default": "中文女"
      },
      "en": {
        "英文女": "英文女",
        "英文男": "英文男",
        "default": "英文女"
      },
      "ja": {
        "日文女": "日文女",
        "日文男": "日文男", 
        "default": "日文女"
      },
      "ko": {
        "韩文女": "韩文女",
        "韩文男": "韩文男",
        "default": "韩文女"
      }
    }
  }

  /**
   * 检测文本语言
   * @param {string} text - 待检测文本
   * @return {Object} - 检测结果 {language, confidence, name}
   */
  detectTextLanguage(text) {
    if (!text || typeof text !== 'string') {
      return {
        language: 'zh',
        confidence: 0.1,
        name: '中文',
        reason: '文本为空或格式错误，默认中文'
      }
    }

    const cleanText = text.trim().toLowerCase()
    const results = []

    // 遍历所有语言进行检测
    for (const [langCode, langInfo] of Object.entries(this.languagePatterns)) {
      let score = 0
      let matches = []

      // 1. 模式匹配检测
      for (const pattern of langInfo.patterns) {
        if (pattern.test(text)) {
          score += 0.4
          matches.push(`模式匹配: ${pattern}`)
          break
        }
      }

      // 2. 关键词匹配检测
      let keywordMatches = 0
      for (const keyword of langInfo.keywords) {
        if (cleanText.includes(keyword.toLowerCase())) {
          keywordMatches++
        }
      }
      
      if (keywordMatches > 0) {
        score += Math.min(keywordMatches * 0.2, 0.4)
        matches.push(`关键词匹配: ${keywordMatches}个`)
      }

      // 3. 字符统计检测
      const charRatio = this.calculateCharacterRatio(text, langCode)
      score += charRatio * 0.3
      matches.push(`字符比例: ${(charRatio * 100).toFixed(1)}%`)

      // 计算最终置信度
      const confidence = Math.min(score * langInfo.confidence, 1.0)

      if (confidence > 0.1) {
        results.push({
          language: langCode,
          confidence: confidence,
          name: langInfo.name,
          score: score,
          matches: matches
        })
      }
    }

    // 排序并返回最佳结果
    results.sort((a, b) => b.confidence - a.confidence)
    
    if (results.length === 0) {
      return {
        language: 'zh',
        confidence: 0.3,
        name: '中文',
        reason: '无法确定语言，默认中文'
      }
    }

    const best = results[0]
    console.log(`语言检测结果: ${best.name} (置信度: ${best.confidence.toFixed(2)})`)
    console.log(`检测详情:`, best.matches)

    return best
  }

  /**
   * 计算特定语言字符在文本中的比例
   * @param {string} text - 文本
   * @param {string} langCode - 语言代码
   * @return {number} - 字符比例 (0-1)
   */
  calculateCharacterRatio(text, langCode) {
    if (!text) return 0

    const patterns = this.languagePatterns[langCode]?.patterns || []
    let matchCount = 0

    for (const char of text) {
      for (const pattern of patterns) {
        if (pattern.test(char)) {
          matchCount++
          break
        }
      }
    }

    return text.length > 0 ? matchCount / text.length : 0
  }

  /**
   * 根据检测到的语言获取推荐音色
   * @param {string} detectedLanguage - 检测到的语言代码
   * @param {string} preferredSpkId - 用户偏好的音色
   * @param {string} gender - 性别偏好 ('male' 或 'female')
   * @return {string} - 推荐的音色ID
   */
  getRecommendedSpkId(detectedLanguage, preferredSpkId = null, gender = 'female') {
    // 如果有明确的偏好音色，优先使用
    if (preferredSpkId) {
      console.log(`使用指定音色: ${preferredSpkId}`)
      return preferredSpkId
    }

    // 根据检测语言获取对应音色映射
    const langSpkMap = this.languageSpkMap[detectedLanguage]
    if (!langSpkMap) {
      console.log(`未找到语言 ${detectedLanguage} 的音色映射，使用默认中文女声`)
      return "中文女"
    }

    // 根据性别偏好选择音色
    const genderSuffix = gender === 'male' ? '男' : '女'
    const langName = this.languagePatterns[detectedLanguage]?.name || '中文'
    const targetSpkId = `${langName}${genderSuffix}`

    if (langSpkMap[targetSpkId]) {
      console.log(`选择音色: ${targetSpkId}`)
      return targetSpkId
    }

    // 使用该语言的默认音色
    const defaultSpkId = langSpkMap.default
    console.log(`使用默认音色: ${defaultSpkId}`)
    return defaultSpkId
  }

  /**
   * 批量检测多个文本的语言
   * @param {Array<string>} texts - 文本数组
   * @return {Array<Object>} - 检测结果数组
   */
  batchDetectLanguage(texts) {
    return texts.map((text, index) => ({
      index,
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      ...this.detectTextLanguage(text)
    }))
  }

  /**
   * 获取支持的语言列表
   * @return {Array<Object>} - 支持的语言列表
   */
  getSupportedLanguages() {
    return Object.entries(this.languagePatterns).map(([code, info]) => ({
      code,
      name: info.name,
      confidence: info.confidence
    }))
  }

  /**
   * 获取语言对应的音色列表
   * @param {string} languageCode - 语言代码
   * @return {Array<string>} - 音色列表
   */
  getAvailableSpkIds(languageCode) {
    const langSpkMap = this.languageSpkMap[languageCode]
    if (!langSpkMap) return []

    return Object.keys(langSpkMap).filter(key => key !== 'default')
  }

  /**
   * 验证音色是否支持指定语言
   * @param {string} spkId - 音色ID
   * @param {string} languageCode - 语言代码
   * @return {boolean} - 是否支持
   */
  isSpkIdSupportedForLanguage(spkId, languageCode) {
    const langSpkMap = this.languageSpkMap[languageCode]
    if (!langSpkMap) return false

    return Object.values(langSpkMap).includes(spkId)
  }
}

module.exports = new LanguageDetector()