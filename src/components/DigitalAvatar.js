import React, { useRef, useEffect, useState } from 'react'
import { View, StyleSheet, Dimensions, TouchableOpacity, Text } from 'react-native'
import { Video } from 'expo-av'
import digitalHumanService from '../services/DigitalHumanService'

const { width, height } = Dimensions.get('window')

export default function DigitalAvatar({ 
  style, 
  videoStyle, 
  autoPlay = true, 
  loop = true,
  showControls = false,
  enableInteraction = true,
  onMessage = null
}) {
  const videoRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle, recording, processing, speaking
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (autoPlay && videoRef.current) {
      videoRef.current.playAsync()
    }
  }, [autoPlay])

  useEffect(() => {
    if (enableInteraction && !isInitialized) {
      initializeDigitalHuman()
    }
  }, [enableInteraction])

  const initializeDigitalHuman = async () => {
    try {
      console.log('开始初始化数字人...');
      
      // 导入配置
      const llmConfig = await import('../config/llmConfig.js').then(m => m.default);
      console.log('LLM配置加载完成');
      
      // 验证配置
      const configValidation = llmConfig.validateConfig();
      console.log('配置验证结果:', configValidation);
      
      if (!configValidation.isValid) {
        console.error('配置验证失败:', configValidation.errors);
        alert('配置错误:\n' + configValidation.errors.join('\n'));
        return;
      }
      
      if (configValidation.warnings && configValidation.warnings.length > 0) {
        console.warn('配置警告:', configValidation.warnings);
      }

      // 配置数字人服务（使用我们自己的LLM）
      const config = {
        llm: {
          websocketUrl: llmConfig.responseLLM.websocketUrl,
          timeout: llmConfig.responseLLM.timeout,
          maxTokens: llmConfig.responseLLM.maxTokens,
          model: llmConfig.responseLLM.model
        },
        sttTts: {
          useSimulation: true // 使用模拟模式，不依赖外部API
        }
      }

      console.log('环境配置:', llmConfig.getEnvironmentConfig())
      console.log('初始化配置:', config)

      console.log('开始调用digitalHumanService.initialize...')
      const initialized = await digitalHumanService.initialize(config)
      console.log('初始化结果:', initialized)
      
      if (initialized) {
        console.log('数字人服务初始化成功!');
        setIsInitialized(true)
        
        // 设置回调函数
        digitalHumanService.setCallbacks({
          onStatusChange: (newStatus) => {
            setStatus(newStatus)
          },
          onMessage: (message) => {
            console.log(`[${message.role}]: ${message.message}`)
            if (onMessage) {
              onMessage(message)
            }
          },
          onError: (error) => {
            console.error('数字人服务错误:', error)
            setStatus('idle')
          }
        })
      }
    } catch (error) {
      console.error('初始化数字人失败:', error)
    }
  }

  const handleAvatarPress = async () => {
    if (!enableInteraction || !isInitialized) {
      return
    }

    if (status === 'idle') {
      // 开始语音对话
      const started = await digitalHumanService.startVoiceConversation()
      if (started) {
        console.log('开始语音对话')
      }
    } else if (status === 'recording') {
      // 结束录音并处理
      const processed = await digitalHumanService.stopVoiceConversation()
      if (processed) {
        console.log('语音对话处理完成')
      }
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'recording':
        return '🎤 正在录音...'
      case 'processing':
        return '🤔 思考中...'
      case 'speaking':
        return '🗣️ 正在说话...'
      default:
        return enableInteraction ? '👋 点击开始对话' : ''
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'recording':
        return '#ff4444'
      case 'processing':
        return '#ffaa00'
      case 'speaking':
        return '#00aa44'
      default:
        return '#666666'
    }
  }

  return (
    <TouchableOpacity 
      style={[styles.container, style]}
      onPress={handleAvatarPress}
      activeOpacity={enableInteraction ? 0.8 : 1}
      disabled={!enableInteraction || !isInitialized}
    >
      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          style={[styles.video, videoStyle]}
          source={require('../../assets/images/嘎巴龙待机.mp4')}
          useNativeControls={showControls}
          resizeMode="cover"
          isLooping={loop}
          shouldPlay={autoPlay}
        />
        
        {/* 状态指示器 */}
        {enableInteraction && (
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
        )}
      </View>
      
      {/* 状态文字 */}
      {enableInteraction && (
        <Text style={styles.statusText}>{getStatusText()}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
  },
  video: {
    width: 200,
    height: 300,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  statusIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#666666'
  },
  statusText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  }
})