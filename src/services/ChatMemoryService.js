/**
 * 对话记忆服务
 * 基于 111.py 中的 ChatMemory 类实现
 * 用于管理和维护对话历史记录，提供上下文连续性
 */
class ChatMemoryService {
  constructor(maxLength = 2048) {
    this.history = []
    this.maxLength = maxLength // 最大输入长度
  }

  /**
   * 添加用户输入和模型响应到历史记录
   * @param {string} userInput - 用户输入
   * @param {string} modelResponse - 模型响应
   */
  addToHistory(userInput, modelResponse) {
    this.history.push(`User: ${userInput}`)
    this.history.push(`Assistant: ${modelResponse}`)
  }

  /**
   * 获取拼接后的对话上下文
   * @returns {string} 对话上下文字符串
   */
  getContext() {
    const context = this.history.join('\n')
    // 截断上下文，使其不超过 maxLength
    if (context.length > this.maxLength) {
      return context.slice(-this.maxLength)
    }
    return context
  }

  /**
   * 获取格式化的对话历史（用于显示）
   * @returns {Array} 格式化的对话数组
   */
  getFormattedHistory() {
    const formatted = []
    for (let i = 0; i < this.history.length; i += 2) {
      if (i + 1 < this.history.length) {
        formatted.push({
          user: this.history[i].replace('User: ', ''),
          assistant: this.history[i + 1].replace('Assistant: ', ''),
          timestamp: Date.now(),
        })
      }
    }
    return formatted
  }

  /**
   * 获取最近几轮对话
   * @param {number} turns - 要获取的轮数
   * @returns {string} 最近的对话上下文
   */
  getRecentContext(turns = 5) {
    const recentHistory = this.history.slice(-turns * 2) // 每轮包含用户和助手两条消息
    const context = recentHistory.join('\n')

    if (context.length > this.maxLength) {
      return context.slice(-this.maxLength)
    }
    return context
  }

  /**
   * 清空对话历史
   */
  clearHistory() {
    this.history = []
  }

  /**
   * 获取历史记录长度
   * @returns {number} 历史记录条数
   */
  getHistoryLength() {
    return this.history.length
  }

  /**
   * 获取对话轮数
   * @returns {number} 对话轮数
   */
  getTurnCount() {
    return Math.floor(this.history.length / 2)
  }

  /**
   * 检查是否有历史记录
   * @returns {boolean} 是否有历史记录
   */
  hasHistory() {
    return this.history.length > 0
  }

  /**
   * 设置最大长度限制
   * @param {number} maxLength - 新的最大长度
   */
  setMaxLength(maxLength) {
    this.maxLength = maxLength
  }

  /**
   * 获取当前设置的最大长度
   * @returns {number} 最大长度
   */
  getMaxLength() {
    return this.maxLength
  }

  /**
   * 删除最旧的一轮对话（用户和助手各一条）
   */
  removeOldestTurn() {
    if (this.history.length >= 2) {
      this.history.splice(0, 2)
    }
  }

  /**
   * 根据长度自动管理历史记录
   * 当历史记录过长时，自动删除最旧的对话轮次
   */
  autoManageHistory() {
    const currentContext = this.getContext()
    while (currentContext.length > this.maxLength && this.history.length >= 2) {
      this.removeOldestTurn()
      const newContext = this.getContext()
      if (newContext === currentContext) break // 防止无限循环
    }
  }

  /**
   * 导出历史记录（用于持久化存储）
   * @returns {Object} 包含历史记录和配置的对象
   */
  export() {
    return {
      history: [...this.history],
      maxLength: this.maxLength,
      timestamp: Date.now(),
    }
  }

  /**
   * 导入历史记录（从持久化存储恢复）
   * @param {Object} data - 导出的数据对象
   */
  import(data) {
    if (data && Array.isArray(data.history)) {
      this.history = [...data.history]
      if (typeof data.maxLength === 'number') {
        this.maxLength = data.maxLength
      }
    }
  }
}

// 创建单例实例
const chatMemoryService = new ChatMemoryService(512) // 与 111.py 保持一致，设置为 512

export default chatMemoryService
