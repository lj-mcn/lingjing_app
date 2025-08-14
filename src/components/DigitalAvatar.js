import React, { useRef, useEffect, useState } from 'react'
import {
  View, StyleSheet, Text,
} from 'react-native'
import { Video } from 'expo-av'
import digitalHumanService from '../services/DigitalHumanService'


export default function DigitalAvatar({
  style,
  videoStyle,
  autoPlay = true,
  loop = true,
  showControls = false,
  enableInteraction = true,
  onMessage = null,
}) {
  const videoRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle, recording, processing, speaking
  const [isInitialized, setIsInitialized] = useState(false)
  const [videoError, setVideoError] = useState(null)

  useEffect(() => {
    if (autoPlay && videoRef.current) {
      console.log('尝试播放数字人视频...')
      videoRef.current.playAsync().then(() => {
        console.log('✅ 数字人视频播放成功')
      }).catch((error) => {
        console.error('❌ 数字人视频播放失败:', error)
      })
    }
  }, [autoPlay])

  useEffect(() => {
    if (enableInteraction && !isInitialized) {
      initializeDigitalHuman()
    }
  }, [enableInteraction])

  const initializeDigitalHuman = async () => {
    try {
      console.log('开始初始化数字人...')

      // 导入配置
      const llmConfig = await import('../config/llmConfig.js').then((m) => m.default)
      console.log('LLM配置加载完成')

      // 验证配置
      const configValidation = llmConfig.validateConfig()
      console.log('配置验证结果:', configValidation)

      if (!configValidation.isValid) {
        console.error('配置验证失败:', configValidation.errors)
        alert(`配置错误:\n${configValidation.errors.join('\n')}`)
        return
      }

      if (configValidation.warnings && configValidation.warnings.length > 0) {
        console.warn('配置警告:', configValidation.warnings)
      }

      // 配置数字人服务（使用我们自己的LLM）
      const config = {
        llm: {
          websocket_url: llmConfig.responseLLM.websocket_url,
          timeout: llmConfig.responseLLM.timeout,
          max_tokens: llmConfig.responseLLM.max_tokens,
          model: llmConfig.responseLLM.model,
        },
        websocket_url: llmConfig.responseLLM.websocket_url, // 添加顶级websocket_url
        sttTts: {},
      }

      console.log('环境配置:', llmConfig.getEnvironmentConfig())
      console.log('初始化配置:', config)

      console.log('开始调用digitalHumanService.initialize...')
      const initialized = await digitalHumanService.initialize(config)
      console.log('初始化结果:', initialized)

      if (initialized) {
        console.log('数字人服务初始化成功!')
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
          },
        })
      }
    } catch (error) {
      console.error('初始化数字人失败:', error)
    }
  }


  const getStatusText = () => {
    if (!enableInteraction) return ''

    switch (status) {
      case 'recording':
        return '🎤 正在录音... (点击停止)'
      case 'processing':
        return '🤔 正在思考中...'
      case 'speaking':
        return '🗣️ 正在回复中...'
      case 'connected':
        return '✅ 已连接，点击开始对话'
      case 'disconnected':
        return '⚠️ 连接断开，点击重试'
      default:
        return isInitialized ? '👋 点击开始语音对话' : '⏳ 正在初始化...'
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'recording':
        return '#ff4444' // 红色 - 录音中
      case 'processing':
        return '#ffaa00' // 橙色 - 处理中
      case 'speaking':
        return '#00aa44' // 绿色 - 说话中
      case 'connected':
        return '#00aa44' // 绿色 - 已连接
      case 'disconnected':
        return '#ff6666' // 红色 - 断开连接
      default:
        return isInitialized ? '#4CAF50' : '#999999' // 初始化完成/未完成
    }
  }


  return (
    <View style={[styles.container, style]}>
      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          style={[styles.video, videoStyle]}
          source={require('../../assets/images/嘎巴龙待机.mp4')}
          useNativeControls={showControls}
          resizeMode="cover"
          isLooping={loop}
          shouldPlay={autoPlay}
          onLoad={(loadStatus) => {
            console.log('数字人视频加载完成:', loadStatus)
            setVideoError(null)
          }}
          onError={(error) => {
            console.error('数字人视频加载失败:', error)
            setVideoError(error)
          }}
          onPlaybackStatusUpdate={(playbackStatus) => {
            if (playbackStatus.error) {
              console.error('数字人视频播放错误:', playbackStatus.error)
              setVideoError(playbackStatus.error)
            }
          }}
        />

        {/* 视频加载失败时的后备显示 */}
        {videoError && (
          <View style={styles.fallbackContainer}>
            <Text style={styles.fallbackEmoji}>🐉</Text>
            <Text style={styles.fallbackText}>嘎巴龙</Text>
          </View>
        )}

        {/* 状态指示器 */}
        {enableInteraction && (
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
        )}
      </View>

      {/* 状态文字 */}
      {enableInteraction && (
        <Text style={styles.statusText}>{getStatusText()}</Text>
      )}

    </View>
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 200,
    height: 300,
  },
  video: {
    width: 200,
    height: 300,
    borderRadius: 20,
    backgroundColor: '#f0f0f0', // 添加背景色以便调试
  },
  statusIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#666666',
  },
  statusText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  fallbackContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
  },
  fallbackEmoji: {
    fontSize: 60,
    marginBottom: 10,
  },
  fallbackText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
  },
})
