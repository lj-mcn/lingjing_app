# 数字人自由打断功能使用指南

## 概述

基于111.py中webrtcvad的实现原理，我们为数字人对话系统集成了完整的自由打断功能。用户可以在AI播放音频时随时说话打断，系统会立即停止播放并开始录制用户的新输入。

## 核心特性

- 🎯 **实时语音检测**: 基于WebRTC VAD算法，精确检测用户语音
- 🔥 **即时打断**: 检测到语音后立即停止AI播放
- 🎤 **无缝对话**: 打断后自动开始录音，无需手动操作
- ⚙️ **灵活配置**: 支持多种环境和敏感度配置
- 🔄 **智能恢复**: 支持智能对话模式下的自动流程恢复

## 快速开始

### 1. 基本使用

```javascript
import digitalHumanService from './src/services/DigitalHumanService'
import { vadConfig } from './src/config/vadConfig'

// 初始化数字人服务
await digitalHumanService.initialize()

// 启用自由打断功能
const result = await digitalHumanService.enableVADInterruption()
if (result.success) {
  console.log('✅ 自由打断功能已启用')
}

// 开始智能对话（自动启用自由打断）
await digitalHumanService.enableSmartConversation()
```

### 2. 高级配置

```javascript
import vadService from './src/services/VADService'
import { vadPresets, getRecommendedConfig } from './src/config/vadConfig'

// 使用预设配置
const config = vadPresets.highSensitivity
vadService.updateConfig(config.webRTCVAD)

// 或者根据环境自动选择
const autoConfig = getRecommendedConfig('quiet')
vadService.updateConfig(autoConfig.webRTCVAD)

// 自定义配置
vadService.updateConfig({
  vadMode: 3,              // 最高敏感度
  voiceDetectionRate: 0.3, // 30%的帧包含语音即触发
  silenceThreshold: 800,   // 800ms静音后处理
  minimumSpeechDuration: 200 // 最小200ms语音
})
```

### 3. 回调函数设置

```javascript
// 设置VAD回调函数
digitalHumanService.setCallbacks({
  onStatusChange: (status) => {
    console.log('状态变化:', status)
    
    if (status === 'interrupted') {
      console.log('🔥 AI被用户打断!')
      // 可以在此更新UI状态
    }
  },
  
  onMessage: (message) => {
    console.log('消息:', message)
    // 处理系统消息和对话内容
  }
})

// 设置VAD特定回调
vadService.setCallbacks({
  onInterruptionTriggered: () => {
    console.log('🎯 自由打断被触发!')
    // 可以播放提示音或更新UI
  },
  
  onVoiceStart: () => {
    console.log('🗣️ 检测到用户开始说话')
  },
  
  onVoiceEnd: (data) => {
    console.log('✅ 用户说话结束', data)
  }
})
```

## 完整使用示例

```javascript
import digitalHumanService from './src/services/DigitalHumanService'
import vadService from './src/services/VADService'
import { vadPresets } from './src/config/vadConfig'

class DigitalHumanApp {
  constructor() {
    this.isInitialized = false
    this.setupCallbacks()
  }

  async initialize() {
    try {
      // 1. 初始化数字人服务
      console.log('📱 初始化数字人应用...')
      const initResult = await digitalHumanService.initialize()
      
      if (!initResult) {
        throw new Error('数字人服务初始化失败')
      }

      // 2. 配置VAD参数（根据环境选择）
      const vadConfig = vadPresets.mediumSensitivity
      vadService.updateConfig(vadConfig.webRTCVAD)

      // 3. 启用自由打断功能
      const vadResult = await digitalHumanService.enableVADInterruption()
      if (!vadResult.success) {
        console.warn('⚠️ 自由打断功能启用失败:', vadResult.error)
      }

      this.isInitialized = true
      console.log('✅ 数字人应用初始化完成')
      
      return true
    } catch (error) {
      console.error('❌ 初始化失败:', error)
      return false
    }
  }

  setupCallbacks() {
    digitalHumanService.setCallbacks({
      onStatusChange: (status) => {
        this.handleStatusChange(status)
      },
      
      onMessage: (message) => {
        this.handleMessage(message)
      },
      
      onError: (error) => {
        console.error('服务错误:', error)
      }
    })
  }

  handleStatusChange(status) {
    switch (status) {
      case 'speaking':
        console.log('🎵 AI开始播放音频')
        this.updateUI('AI正在回答...')
        break
        
      case 'interrupted':
        console.log('🔥 AI被用户打断')
        this.updateUI('我在听，请说话...')
        break
        
      case 'recording':
        console.log('🎤 开始录音')
        this.updateUI('正在录音...')
        break
        
      case 'processing':
        console.log('⚙️ 处理中')
        this.updateUI('正在思考...')
        break
        
      case 'idle':
        console.log('😌 空闲状态')
        this.updateUI('准备就绪')
        break
    }
  }

  handleMessage(message) {
    console.log(`${message.role}: ${message.message}`)
    
    if (message.role === 'assistant') {
      this.displayAIResponse(message.message)
    } else if (message.role === 'user') {
      this.displayUserInput(message.message)
    } else if (message.role === 'system') {
      this.displaySystemMessage(message.message)
    }
  }

  // 开始智能对话（支持自由打断）
  async startSmartConversation() {
    if (!this.isInitialized) {
      console.error('❌ 应用未初始化')
      return false
    }

    try {
      const result = await digitalHumanService.enableSmartConversation()
      if (result.success) {
        console.log('🚀 智能对话模式已启动（支持自由打断）')
        this.updateUI('智能对话已开启，开始说话即可')
        return true
      } else {
        console.error('❌ 启动智能对话失败:', result.error)
        return false
      }
    } catch (error) {
      console.error('❌ 启动智能对话异常:', error)
      return false
    }
  }

  // 停止智能对话
  async stopSmartConversation() {
    try {
      const result = await digitalHumanService.disableSmartConversation()
      if (result.success) {
        console.log('🛑 智能对话模式已停止')
        this.updateUI('智能对话已关闭')
        return true
      }
    } catch (error) {
      console.error('❌ 停止智能对话异常:', error)
    }
    return false
  }

  // 手动触发打断（用于测试）
  async triggerInterruption() {
    try {
      const result = await digitalHumanService.triggerManualInterruption()
      if (result.success) {
        console.log('🔧 手动打断成功')
      } else {
        console.warn('⚠️ 手动打断失败:', result.error)
      }
    } catch (error) {
      console.error('❌ 手动打断异常:', error)
    }
  }

  // 调整VAD敏感度
  adjustSensitivity(level) {
    let config
    switch (level) {
      case 'high':
        config = vadPresets.highSensitivity
        break
      case 'medium':
        config = vadPresets.mediumSensitivity
        break
      case 'low':
        config = vadPresets.lowSensitivity
        break
      default:
        config = vadPresets.mediumSensitivity
    }
    
    vadService.updateConfig(config.webRTCVAD)
    console.log(`📝 VAD敏感度已调整为: ${level}`)
  }

  // 获取系统状态
  getSystemStatus() {
    return {
      digitalHuman: digitalHumanService.getStatus(),
      vad: vadService.getStatus(),
      isInitialized: this.isInitialized
    }
  }

  // UI更新方法（需要根据实际UI框架实现）
  updateUI(message) {
    // 实际项目中需要根据使用的UI框架来实现
    console.log(`🖥️ UI更新: ${message}`)
  }

  displayAIResponse(message) {
    console.log(`🤖 AI: ${message}`)
    // 实际项目中需要在UI中显示AI回复
  }

  displayUserInput(message) {
    console.log(`👤 用户: ${message}`)
    // 实际项目中需要在UI中显示用户输入
  }

  displaySystemMessage(message) {
    console.log(`ℹ️ 系统: ${message}`)
    // 实际项目中需要在UI中显示系统消息
  }

  // 清理资源
  async cleanup() {
    try {
      await digitalHumanService.cleanup()
      console.log('✅ 资源清理完成')
    } catch (error) {
      console.error('❌ 资源清理失败:', error)
    }
  }
}

// 使用示例
const app = new DigitalHumanApp()

// 应用启动
app.initialize().then((success) => {
  if (success) {
    // 启动智能对话
    app.startSmartConversation()
    
    // 设置测试按钮（可选）
    // setupTestButtons(app)
  }
})

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
  app.cleanup()
})

export default DigitalHumanApp
```

## 配置选项详解

### VAD敏感度配置

```javascript
// 高敏感度 - 适用于安静环境
vadService.updateConfig({
  vadMode: 3,              // 最高敏感度
  voiceDetectionRate: 0.3, // 30%语音帧即触发
  silenceThreshold: 800,   // 800ms静音处理
})

// 中等敏感度 - 适用于一般环境
vadService.updateConfig({
  vadMode: 2,              // 中等敏感度
  voiceDetectionRate: 0.5, // 50%语音帧触发
  silenceThreshold: 1000,  // 1秒静音处理
})

// 低敏感度 - 适用于嘈杂环境
vadService.updateConfig({
  vadMode: 1,              // 低敏感度
  voiceDetectionRate: 0.7, // 70%语音帧触发
  silenceThreshold: 1500,  // 1.5秒静音处理
})
```

### 调试模式

```javascript
import { vadConfig } from './src/config/vadConfig'

// 启用调试模式
vadService.updateConfig({
  ...vadConfig.debug,
  logVADEvents: true,
  logInterruptions: true,
  showVADStatus: true,
})
```

## 最佳实践

### 1. 环境适配

```javascript
// 根据设备类型调整配置
const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
const config = isMobile ? vadPresets.lowSensitivity : vadPresets.mediumSensitivity
vadService.updateConfig(config.webRTCVAD)
```

### 2. 错误处理

```javascript
try {
  await digitalHumanService.enableVADInterruption()
} catch (error) {
  console.error('VAD启用失败，回退到传统模式')
  // 提供备选方案
}
```

### 3. 性能优化

```javascript
// 只在需要时启用自由打断
if (currentMode === 'smartConversation') {
  await digitalHumanService.enableVADInterruption()
} else {
  await digitalHumanService.disableVADInterruption()
}
```

## 故障排除

### 常见问题

1. **自由打断不响应**
   - 检查麦克风权限
   - 调整VAD敏感度
   - 确认浏览器支持Web Audio API

2. **误触发打断**
   - 降低VAD敏感度
   - 增加最小语音持续时间
   - 检查环境噪音

3. **打断后无响应**
   - 检查智能对话模式状态
   - 确认录音服务正常
   - 查看控制台错误日志

### 调试代码

```javascript
// 获取详细状态信息
const status = digitalHumanService.getStatus()
console.log('系统状态:', status)

// 监控VAD事件
vadService.setCallbacks({
  onStatusChange: (status) => {
    console.log('VAD状态:', status)
  }
})

// 手动测试打断功能
await digitalHumanService.triggerManualInterruption()
```

## 总结

该自由打断功能完全基于111.py中webrtcvad的实现原理，提供了：

- 🎯 **精确的语音检测**: 模仿webrtcvad的多特征判断算法
- 🔥 **即时响应**: 检测到语音后立即停止播放
- 🎤 **无缝集成**: 与现有数字人系统完美融合
- ⚙️ **灵活配置**: 支持不同环境和使用场景
- 🚀 **智能对话**: 支持真正的自然对话体验

通过合理配置和使用，可以实现与111.py中相同的自由打断效果，为用户提供流畅自然的对话体验。