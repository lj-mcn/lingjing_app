/**
 * 禁用所有类型的弹窗，但保留日志记录
 * 这个文件需要在应用启动时尽早加载
 */

import { Alert } from 'react-native'

// 存储原始的方法引用
const originalAlert = Alert.alert
const originalConsoleError = console.error

// 完全禁用所有Alert.alert调用
Alert.alert = function (title, message, buttons, options) {
  console.log('🚫 Alert被拦截（保留日志）:', { title, message })
  // 完全不执行任何弹窗显示
}

// 禁用全局alert（如果存在）
if (typeof global !== 'undefined' && global.alert) {
  global.alert = function (message) {
    console.log('🚫 全局alert被拦截（保留日志）:', message)
  }
}

// 禁用window.alert（如果在web环境）
if (typeof window !== 'undefined' && window.alert) {
  window.alert = function (message) {
    console.log('🚫 window.alert被拦截（保留日志）:', message)
  }
}

// 拦截可能来自第三方库的弹窗
const interceptMethods = [
  'alert',
  'confirm',
  'prompt',
]

interceptMethods.forEach((method) => {
  if (typeof global !== 'undefined' && global[method]) {
    global[method] = function (...args) {
      console.log(`🚫 ${method}被拦截（保留日志）:`, args)
    }
  }

  if (typeof window !== 'undefined' && window[method]) {
    window[method] = function (...args) {
      console.log(`🚫 ${method}被拦截（保留日志）:`, args)
    }
  }
})

// 拦截React Native Dialog
try {
  const Dialog = require('react-native-dialog')
  if (Dialog && Dialog.alert) {
    Dialog.alert = function (...args) {
      console.log('🚫 react-native-dialog.alert被拦截（保留日志）:', args)
    }
  }
} catch (e) {
  // Dialog库可能未安装
}

// 拦截可能的错误报告弹窗
if (typeof ErrorUtils !== 'undefined') {
  const originalSetGlobalHandler = ErrorUtils.setGlobalHandler
  ErrorUtils.setGlobalHandler = function (callback, isFatal) {
    return originalSetGlobalHandler((error, isFatal) => {
      console.error('🚫 全局错误被拦截（保留日志）:', error)
      // 不调用原始的callback，避免可能的弹窗
    }, isFatal)
  }
}

// 拦截React Native的开发模式弹窗
if (typeof global !== 'undefined') {
  // 禁用Yellow Box / Red Box
  if (global.__DEV__) {
    console.disableYellowBox = true

    // 拦截可能的开发错误弹窗
    if (global.ErrorUtils) {
      global.ErrorUtils.reportError = function (error) {
        console.error('🚫 开发错误弹窗被拦截（保留日志）:', error)
      }
    }
  }

  // 拦截可能的Expo错误处理
  if (global.expo && global.expo.ErrorRecovery) {
    global.expo.ErrorRecovery.setRecoveryProps = function () {
      console.log('🚫 Expo错误恢复被拦截（保留日志）')
    }
  }
}

// 拦截可能的模态框和原生弹窗
const interceptNativeAlerts = () => {
  // 拦截可能的iOS原生弹窗
  if (typeof global !== 'undefined' && global.nativeCallSyncHook) {
    const original = global.nativeCallSyncHook
    global.nativeCallSyncHook = function (moduleID, methodID, args) {
      // 检查是否是Alert相关的原生调用
      if (args && args.length > 0 && typeof args[0] === 'string'
          && (args[0].includes('alert') || args[0].includes('Alert'))) {
        console.log('🚫 原生Alert调用被拦截（保留日志）:', args)
        return null
      }
      return original(moduleID, methodID, args)
    }
  }
}

// 延迟拦截，确保所有模块加载完成
setTimeout(interceptNativeAlerts, 100)

// 最后的安全网：重写可能的错误处理函数
const safetyNet = () => {
  // 重写console.error以捕获可能触发弹窗的错误
  const originalConsoleError = console.error
  console.error = function (...args) {
    const message = args.join(' ')
    // 如果错误消息包含特定关键词，额外标记
    if (message.includes('数字人') || message.includes('播放失败') || message.includes('视频') || message.includes('播放错误')) {
      console.log('🎯 视频相关错误被拦截（保留日志）:', ...args)
    }
    // 仍然记录到控制台，但不触发任何弹窗
    originalConsoleError.apply(console, args)
  }
}

safetyNet()

console.log('✅ 强化弹窗拦截器已初始化 - 所有弹窗（包括原生和第三方）已被禁用，但日志保留')

export default {
  // 提供恢复原始Alert的方法（如果需要）
  restore: () => {
    Alert.alert = originalAlert
    console.log('⚠️ Alert已恢复为原始方法')
  },
}
