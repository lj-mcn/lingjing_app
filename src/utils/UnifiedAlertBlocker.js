/**
 * 统一弹窗拦截器
 * 合并并优化原有的DisableAlerts和RuntimeAlertBlocker功能
 */

class UnifiedAlertBlocker {
  constructor() {
    this.isActive = true
    this.originalMethods = new Map()
    this.interceptedKeywords = [
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

    // 立即初始化
    this.initialize()
  }

  // 保存原始方法
  saveOriginalMethod(object, methodName) {
    if (object && typeof object[methodName] === 'function') {
      const key = `${object.constructor.name}.${methodName}`
      if (!this.originalMethods.has(key)) {
        this.originalMethods.set(key, object[methodName])
      }
    }
  }

  // 创建拦截方法
  createInterceptor(methodName, originalMethod) {
    return (...args) => {
      if (this.isActive) {
        console.log(`🚫 ${methodName}被拦截（保留日志）:`, args)

        // 对于Alert.alert，如果有按钮回调，执行第一个按钮的回调避免应用卡住
        if (methodName === 'Alert.alert' && args[2] && args[2].length > 0 && args[2][0].onPress) {
          setTimeout(() => args[2][0].onPress(), 0)
        }

        return null
      }
      return originalMethod.apply(this, args)
    }
  }

  // 拦截React Native Alert - iOS优化
  interceptReactNativeAlert() {
    try {
      const { Alert } = require('react-native')
      if (Alert && Alert.alert) {
        this.saveOriginalMethod(Alert, 'alert')
        Alert.alert = this.createInterceptor('Alert.alert', Alert.alert)
      }
    } catch (e) {
      // 静默处理React Native可能未加载的情况
    }

    // 也尝试拦截全局Alert
    try {
      if (typeof Alert !== 'undefined' && Alert.alert) {
        this.saveOriginalMethod(Alert, 'alert')
        Alert.alert = this.createInterceptor('Global.Alert.alert', Alert.alert)
      }
    } catch (e) {
      // 静默处理
    }
  }

  // 拦截全局弹窗方法 - iOS优化
  interceptGlobalMethods() {
    const methodsToIntercept = ['alert', 'confirm', 'prompt']

    methodsToIntercept.forEach((method) => {
      // 拦截global对象
      if (typeof global !== 'undefined' && global[method]) {
        this.saveOriginalMethod(global, method)
        global[method] = this.createInterceptor(`global.${method}`, global[method])
      }

      // 拦截window对象
      if (typeof window !== 'undefined' && window[method]) {
        this.saveOriginalMethod(window, method)
        window[method] = this.createInterceptor(`window.${method}`, window[method])
      }
    })

    // iOS特殊处理：拦截可能的错误抛出
    this.interceptErrorThrows()
  }

  // 拦截错误抛出
  interceptErrorThrows() {
    try {
      const originalThrow = Error.prototype.constructor
      Error.prototype.constructor = function (...args) {
        if (this.isActive) {
          const message = args[0] || ''
          if (this.interceptedKeywords.some((keyword) => message.includes(keyword))) {
            // 静默处理相关错误
            return new Error('已处理的错误')
          }
        }
        return originalThrow.apply(this, args)
      }
    } catch (error) {
      // 静默处理拦截设置错误
    }
  }

  // 拦截第三方库
  interceptThirdPartyLibraries() {
    // 拦截react-native-dialog
    try {
      const Dialog = require('react-native-dialog')
      if (Dialog && Dialog.alert) {
        this.saveOriginalMethod(Dialog, 'alert')
        Dialog.alert = this.createInterceptor('Dialog.alert', Dialog.alert)
      }
    } catch (e) {
      // 库可能未安装
    }

    // 拦截Toast错误消息
    try {
      const Toast = require('react-native-toast-message')
      if (Toast && Toast.show) {
        this.saveOriginalMethod(Toast, 'show')
        const originalShow = Toast.show
        Toast.show = (config) => {
          if (this.isActive && this.shouldInterceptToast(config)) {
            // iOS上完全静默处理，不输出任何日志
            return
          }
          return originalShow.call(Toast, config)
        }
      }
    } catch (e) {
      // Toast库可能未安装
    }
  }

  // 判断是否应该拦截Toast - iOS优化
  shouldInterceptToast(config) {
    // iOS上拦截所有错误类型Toast和包含关键词的Toast
    if (config.type === 'error') return true

    const textToCheck = `${config.text1 || ''} ${config.text2 || ''}`
    return this.interceptedKeywords.some((keyword) => textToCheck.toLowerCase().includes(keyword.toLowerCase()))
  }

  // 拦截console.error（只做一次，避免冲突）
  interceptConsoleError() {
    if (!console._originalError) {
      console._originalError = console.error
      console.error = (...args) => {
        try {
          const message = args.join(' ')
          const shouldIntercept = this.isActive
            && this.interceptedKeywords.some((keyword) => message.includes(keyword))

          if (shouldIntercept) {
            // iOS上完全静默处理，不输出任何日志
            return
          }

          // 使用原始方法记录其他错误
          console._originalError.apply(console, args)
        } catch (e) {
          // 如果拦截器出错，使用原始方法
          console._originalError.apply(console, args)
        }
      }
    }
  }

  // 拦截开发环境错误 - iOS优化
  interceptDevelopmentErrors() {
    try {
      if (typeof global !== 'undefined' && global.__DEV__) {
        console.disableYellowBox = true

        if (global.ErrorUtils) {
          this.saveOriginalMethod(global.ErrorUtils, 'reportError')
          global.ErrorUtils.reportError = (error) => {
            // iOS上完全静默处理开发错误
            if (this.isActive) {
              return // 静默忽略
            }
            // 非激活状态下调用原始方法
            const original = this.originalMethods.get('ErrorUtils.reportError')
            if (original) {
              original.call(global.ErrorUtils, error)
            }
          }
        }

        // 拦截React Native的YellowBox和RedBox
        if (global.console) {
          const methods = ['warn', 'error']
          methods.forEach((method) => {
            if (global.console[method] && !global.console[`_original${method.charAt(0).toUpperCase() + method.slice(1)}`]) {
              global.console[`_original${method.charAt(0).toUpperCase() + method.slice(1)}`] = global.console[method]
              global.console[method] = (...args) => {
                if (this.isActive) {
                  const message = args.join(' ')
                  if (this.interceptedKeywords.some((keyword) => message.includes(keyword))) {
                    return // 静默处理
                  }
                }
                global.console[`_original${method.charAt(0).toUpperCase() + method.slice(1)}`](...args)
              }
            }
          })
        }
      }
    } catch (error) {
      // 静默处理设置错误
    }
  }

  // 初始化所有拦截器 - iOS优化
  initialize() {
    try {
      this.interceptReactNativeAlert()
      this.interceptGlobalMethods()
      this.interceptThirdPartyLibraries()
      this.interceptConsoleError()
      this.interceptDevelopmentErrors()
      this.interceptExpoErrors() // 新增

      // 只在开发模式下输出日志
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('✅ iOS优化的统一弹窗拦截器已初始化')
      }
    } catch (error) {
      // 静默处理初始化错误
    }
  }

  // 拦截Expo错误
  interceptExpoErrors() {
    try {
      // 拦截Expo的错误处理
      if (typeof expo !== 'undefined' && expo.ErrorRecovery) {
        // 处理Expo错误恢复
      }

      // 拦截Expo Audio错误
      if (typeof Audio !== 'undefined' && Audio.setIsEnabledAsync) {
        const originalSetIsEnabled = Audio.setIsEnabledAsync
        Audio.setIsEnabledAsync = async (enabled) => {
          try {
            return await originalSetIsEnabled(enabled)
          } catch (error) {
            // 静默处理Audio设置错误
            return false
          }
        }
      }
    } catch (error) {
      // 静默处理Expo拦截设置错误
    }
  }

  // 启用拦截器 - iOS优化
  enable() {
    this.isActive = true
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('✅ iOS弹窗拦截器已启用')
    }
  }

  // 禁用拦截器 - iOS优化
  disable() {
    this.isActive = false
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('⚠️ iOS弹窗拦截器已禁用')
    }
  }

  // 完全恢复原始方法（用于调试）
  restore() {
    try {
      // 恢复React Native Alert
      const { Alert } = require('react-native')
      const originalAlert = this.originalMethods.get('Alert.alert')
      if (originalAlert) {
        Alert.alert = originalAlert
      }

      // 恢复console.error
      if (console._originalError) {
        console.error = console._originalError
        delete console._originalError
      }

      console.log('⚠️ 所有拦截器已恢复为原始方法')
    } catch (e) {
      console.error('恢复拦截器时出错:', e)
    }
  }

  // 获取状态
  getStatus() {
    return {
      isActive: this.isActive,
      interceptedMethods: Array.from(this.originalMethods.keys()),
      interceptedKeywords: this.interceptedKeywords,
    }
  }
}

// 创建全局实例
const alertBlocker = new UnifiedAlertBlocker()

// 导出控制接口
export default {
  enable: () => alertBlocker.enable(),
  disable: () => alertBlocker.disable(),
  restore: () => alertBlocker.restore(),
  getStatus: () => alertBlocker.getStatus(),
  isActive: () => alertBlocker.isActive,
}
