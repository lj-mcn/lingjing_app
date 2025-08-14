/**
 * 运行时弹窗拦截器
 * 在应用运行过程中持续监控和拦截所有弹窗
 */

let alertBlockerActive = true

// 创建一个全局拦截器
const createGlobalInterceptor = () => {
  // 重写所有可能的弹窗方法
  const methodsToIntercept = [
    'alert',
    'confirm',
    'prompt',
  ]

  methodsToIntercept.forEach((method) => {
    // 拦截global对象上的方法
    if (typeof global !== 'undefined' && global[method]) {
      const original = global[method]
      global[method] = function (...args) {
        if (alertBlockerActive) {
          console.log(`🚫 运行时拦截 global.${method}（保留日志）:`, args)
          return null
        }
        return original.apply(this, args)
      }
    }

    // 拦截window对象上的方法
    if (typeof window !== 'undefined' && window[method]) {
      const original = window[method]
      window[method] = function (...args) {
        if (alertBlockerActive) {
          console.log(`🚫 运行时拦截 window.${method}（保留日志）:`, args)
          return null
        }
        return original.apply(this, args)
      }
    }
  })
}

// React Native Alert拦截器
const interceptReactNativeAlert = () => {
  try {
    const { Alert } = require('react-native')
    const originalAlert = Alert.alert

    Alert.alert = function (title, message, buttons, options) {
      if (alertBlockerActive) {
        console.log('🚫 运行时拦截 React Native Alert（保留日志）:', { title, message })
        // 如果有按钮回调，执行第一个按钮的回调以避免应用卡住
        if (buttons && buttons.length > 0 && buttons[0].onPress) {
          setTimeout(() => buttons[0].onPress(), 0)
        }
        return
      }
      return originalAlert.apply(this, arguments)
    }
  } catch (e) {
    // React Native可能未加载
  }
}

// 第三方库拦截器
const interceptThirdPartyAlerts = () => {
  try {
    // 拦截react-native-dialog
    const Dialog = require('react-native-dialog')
    if (Dialog && Dialog.alert) {
      const original = Dialog.alert
      Dialog.alert = function (...args) {
        if (alertBlockerActive) {
          console.log('🚫 运行时拦截 react-native-dialog.alert（保留日志）:', args)
          return
        }
        return original.apply(this, args)
      }
    }
  } catch (e) {
    // 库可能未安装
  }

  try {
    // 拦截Toast相关
    const Toast = require('react-native-toast-message')
    if (Toast && Toast.show) {
      const original = Toast.show
      Toast.show = function (config) {
        if (alertBlockerActive && (
          config.type === 'error'
          || config.text1?.includes('失败')
          || config.text1?.includes('错误')
          || config.text2?.includes('失败')
          || config.text2?.includes('错误')
        )) {
          console.log('🚫 运行时拦截 Toast错误消息（保留日志）:', config)
          return
        }
        return original.apply(this, arguments)
      }
    }
  } catch (e) {
    // Toast库可能未安装
  }
}

// 持续监控和拦截
const startContinuousInterception = () => {
  // 立即执行一次
  createGlobalInterceptor()
  interceptReactNativeAlert()
  interceptThirdPartyAlerts()

  // 定期重新拦截，防止被其他代码覆盖
  setInterval(() => {
    if (alertBlockerActive) {
      createGlobalInterceptor()
      interceptReactNativeAlert()
      interceptThirdPartyAlerts()
    }
  }, 1000) // 每秒检查一次
}

// 导出控制函数
export const enableAlertBlocker = () => {
  alertBlockerActive = true
  console.log('✅ 运行时弹窗拦截器已启用')
}

export const disableAlertBlocker = () => {
  alertBlockerActive = false
  console.log('⚠️ 运行时弹窗拦截器已禁用')
}

export const isAlertBlockerActive = () => alertBlockerActive

// 安全地拦截可能触发弹窗的console.error
const interceptConsoleError = () => {
  // 保存原始函数引用
  const originalConsoleError = console.error

  // 检查原始函数是否存在
  if (typeof originalConsoleError !== 'function') {
    console.log('⚠️ console.error不是函数，跳过拦截')
    return
  }

  console.error = function (...args) {
    try {
      const message = args.join(' ')

      // 检查是否是可能触发弹窗的错误类型
      const errorKeywords = [
        '语音识别失败',
        '语音对话处理失败',
        '数字人',
        '播放失败',
        '视频',
        '音频',
        'Google语音',
        'Azure语音',
        'Expo语音',
      ]

      const shouldIntercept = alertBlockerActive && errorKeywords.some((keyword) => message.includes(keyword))

      if (shouldIntercept) {
        // 将ERROR转换为普通LOG，避免触发任何弹窗机制
        console.log('🚫 ERROR被拦截（保留日志）:', ...args)
        return
      }

      // 其他错误正常记录
      originalConsoleError.apply(console, args)
    } catch (e) {
      // 如果拦截器出错，使用原始方法
      originalConsoleError.apply(console, args)
    }
  }
}

// 启动拦截器
startContinuousInterception()
interceptConsoleError()

console.log('🛡️ 强化运行时弹窗拦截器已启动 - 持续监控所有弹窗源（包括console.error）')

export default {
  enable: enableAlertBlocker,
  disable: disableAlertBlocker,
  isActive: isAlertBlockerActive,
}
