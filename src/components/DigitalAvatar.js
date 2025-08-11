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
      // 配置数字人服务（开发模式，使用模拟服务）
      const config = {
        llm: {
          // 在生产环境中配置真实的API密钥
          // apiKey: 'your-openai-api-key'
        },
        sttTts: {
          // 在生产环境中配置真实的API密钥
          // apiKey: 'your-openai-api-key'
        }
      }

      const initialized = await digitalHumanService.initialize(config)
      if (initialized) {
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
          resizeMode="contain"
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
  },
  video: {
    width: 200,
    height: 300,
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