/**
 * 最终安全网 - 确保任何可能的弹窗都被拦截
 * 这是最后一道防线
 */

// 存储原始方法
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

// 安全地重写console.error，确保不破坏应用
const safeConsoleError = function (...args) {
  try {
    const message = args.join(' ')

    // 特别拦截的错误类型
    const criticalErrorPatterns = [
      /语音.*失败/,
      /数字人.*失败/,
      /播放.*失败/,
      /视频.*失败/,
      /音频.*失败/,
      /编码.*失败/,
      /识别.*失败/,
      /Google.*失败/,
      /Azure.*失败/,
      /Expo.*失败/,
      /Invalid view returned/,
      /HTTP \d+:/,
    ]

    const shouldIntercept = criticalErrorPatterns.some((pattern) => pattern.test(message))

    if (shouldIntercept) {
      // 转换为普通日志，避免触发任何错误处理机制
      console.log('🚫 CRITICAL ERROR拦截（保留日志）:', ...args)
      return
    }

    // 其他错误正常处理，确保原始函数存在
    if (originalConsoleError && typeof originalConsoleError === 'function') {
      originalConsoleError.apply(console, args)
    } else {
      // 如果原始函数不存在，使用console.log作为后备
      console.log('ERROR (fallback):', ...args)
    }
  } catch (e) {
    // 如果拦截器本身出错，使用最安全的方式记录
    console.log('拦截器错误，原始信息:', ...args)
  }
}

// 安全地设置console.error
if (typeof console.error === 'function') {
  console.error = safeConsoleError
} else {
  // 如果console.error不存在，创建一个
  console.error = safeConsoleError
}

// 安全地重写console.warn
const safeConsoleWarn = function (...args) {
  try {
    const message = args.join(' ')

    // 拦截可能的警告弹窗
    const warningPatterns = [
      /deprecated/,
      /expo-av.*deprecated/,
      /removed.*SDK/,
    ]

    const shouldIntercept = warningPatterns.some((pattern) => pattern.test(message))

    if (shouldIntercept) {
      console.log('🚫 WARNING拦截（保留日志）:', ...args)
      return
    }

    // 其他警告正常处理，确保原始函数存在
    if (originalConsoleWarn && typeof originalConsoleWarn === 'function') {
      originalConsoleWarn.apply(console, args)
    } else {
      // 如果原始函数不存在，使用console.log作为后备
      console.log('WARN (fallback):', ...args)
    }
  } catch (e) {
    // 如果拦截器本身出错，使用最安全的方式记录
    console.log('警告拦截器错误，原始信息:', ...args)
  }
}

// 安全地设置console.warn
if (typeof console.warn === 'function') {
  console.warn = safeConsoleWarn
} else {
  console.warn = safeConsoleWarn
}

// 拦截可能的异步错误
if (typeof global !== 'undefined') {
  // 拦截未捕获的Promise rejection
  const originalUnhandledRejection = global.onunhandledrejection
  global.onunhandledrejection = function (event) {
    const error = event.reason
    if (error && typeof error.message === 'string') {
      const criticalPatterns = [
        /语音.*失败/,
        /数字人.*失败/,
        /播放.*失败/,
      ]

      const shouldIntercept = criticalPatterns.some((pattern) => pattern.test(error.message))

      if (shouldIntercept) {
        console.log('🚫 未捕获Promise错误被拦截（保留日志）:', error)
        event.preventDefault()
        return
      }
    }

    if (originalUnhandledRejection) {
      return originalUnhandledRejection.call(this, event)
    }
  }

  // 拦截未捕获的错误
  const originalError = global.onerror
  global.onerror = function (message, source, lineno, colno, error) {
    if (typeof message === 'string') {
      const criticalPatterns = [
        /语音.*失败/,
        /数字人.*失败/,
        /播放.*失败/,
      ]

      const shouldIntercept = criticalPatterns.some((pattern) => pattern.test(message))

      if (shouldIntercept) {
        console.log('🚫 全局错误被拦截（保留日志）:', {
          message, source, lineno, colno, error,
        })
        return true // 阻止默认错误处理
      }
    }

    if (originalError) {
      return originalError.call(this, message, source, lineno, colno, error)
    }
  }
}

// 定期检查和重新拦截（更安全的方式）
setInterval(() => {
  try {
    // 确保我们的拦截器没有被覆盖
    if (typeof console.error !== 'function' || console.error !== safeConsoleError) {
      console.error = safeConsoleError
    }
    if (typeof console.warn !== 'function' || console.warn !== safeConsoleWarn) {
      console.warn = safeConsoleWarn
    }
  } catch (e) {
    // 如果出错，静默失败
  }
}, 3000)

console.log('🛡️ 最终安全网已部署 - 所有关键错误都将被拦截')

export default {
  restore: () => {
    console.error = originalConsoleError
    console.warn = originalConsoleWarn
    console.log('⚠️ 最终安全网已禁用')
  },
}
