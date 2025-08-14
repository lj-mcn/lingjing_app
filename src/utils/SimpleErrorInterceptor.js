/**
 * 简单的错误拦截器 - 只拦截特定的错误消息，不完全重写console
 */

let isActive = true

// 存储原始方法
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

// 要拦截的错误关键词
const BLOCKED_ERROR_KEYWORDS = [
  '数字人视频播放失败',
  '数字人视频加载失败',
  '数字人视频播放错误',
  '语音识别失败',
  '语音对话处理失败',
  '数字人服务错误',
  'Google语音识别失败',
  'Azure语音识别失败',
  'Expo语音识别失败',
  '编码 WEBM_OPUS 失败',
  '编码 LINEAR16 失败',
  '编码 MP3 失败',
]

// 要拦截的警告关键词
const BLOCKED_WARNING_KEYWORDS = [
  'expo-av.*deprecated',
  'removed.*SDK',
  'deprecated',
]

// 安全的错误拦截
console.error = function (...args) {
  if (!isActive) {
    return originalConsoleError.apply(console, args)
  }

  try {
    const message = args.join(' ')

    // 检查是否包含要拦截的关键词
    const shouldBlock = BLOCKED_ERROR_KEYWORDS.some((keyword) => message.includes(keyword))

    if (shouldBlock) {
      // 转换为普通LOG，使用特殊标记
      console.log('🎯 ERROR已拦截（保留日志）:', ...args)
      return
    }

    // 其他错误正常处理
    return originalConsoleError.apply(console, args)
  } catch (e) {
    // 如果拦截器出错，回退到原始方法
    return originalConsoleError.apply(console, args)
  }
}

// 安全的警告拦截
console.warn = function (...args) {
  if (!isActive) {
    return originalConsoleWarn.apply(console, args)
  }

  try {
    const message = args.join(' ')

    // 检查是否包含要拦截的关键词
    const shouldBlock = BLOCKED_WARNING_KEYWORDS.some((keyword) => {
      if (keyword.includes('*')) {
        // 处理通配符模式
        const regex = new RegExp(keyword.replace('*', '.*'))
        return regex.test(message)
      }
      return message.includes(keyword)
    })

    if (shouldBlock) {
      console.log('🎯 WARNING已拦截（保留日志）:', ...args)
      return
    }

    // 其他警告正常处理
    return originalConsoleWarn.apply(console, args)
  } catch (e) {
    // 如果拦截器出错，回退到原始方法
    return originalConsoleWarn.apply(console, args)
  }
}

// 导出控制函数
export const enableSimpleInterceptor = () => {
  isActive = true
  console.log('✅ 简单错误拦截器已启用')
}

export const disableSimpleInterceptor = () => {
  isActive = false
  console.log('⚠️ 简单错误拦截器已禁用')
}

export const restoreOriginalConsole = () => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
  console.log('🔄 console方法已恢复为原始状态')
}

console.log('🎯 简单错误拦截器已初始化')

export default {
  enable: enableSimpleInterceptor,
  disable: disableSimpleInterceptor,
  restore: restoreOriginalConsole,
}
