import React, {
  useRef, useEffect, useState, useContext,
} from 'react'
import {
  View, StyleSheet, Dimensions, TouchableOpacity, Text, Animated,
} from 'react-native'
import { Video } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { ColorSchemeContext } from '../context/ColorSchemeContext'
import digitalHumanService from '../services/DigitalHumanService'

// 禁用Video组件的错误弹窗
const DISABLE_VIDEO_ALERTS = true

const { width, height } = Dimensions.get('window')

export default function DigitalAvatar({
  style,
  videoStyle,
  autoPlay = true,
  loop = true,
  showControls = false,
  enableInteraction = true,
  onMessage = null,
  showAngryVideo = false,
  onAngryVideoEnd = null,
  showHappyVideo = false,
  onHappyVideoEnd = null,
  showSadVideo = false,
  onSadVideoEnd = null,
  showScaredVideo = false,
  onScaredVideoEnd = null,
}) {
  const videoRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle, recording, processing, speaking
  const [isInitialized, setIsInitialized] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [videoError, setVideoError] = useState(null)

  // 沉浸式效果相关状态
  const glowOpacity = useRef(new Animated.Value(0.3)).current
  const pulseScale = useRef(new Animated.Value(1)).current
  const maskOpacity = useRef(new Animated.Value(1)).current

  // 获取主题信息
  const { scheme } = useContext(ColorSchemeContext)
  const isDark = scheme === 'dark'

  useEffect(() => {
    if (autoPlay && videoRef.current) {
      console.log('尝试播放数字人视频...')
      videoRef.current.playAsync().then(() => {
        console.log('✅ 数字人视频播放成功')
      }).catch((error) => {
        // 使用专门的拦截日志格式，避免触发任何弹窗机制
        console.log('🎯 数字人视频播放失败（已拦截）:', error.message || error)
        // 完全注释掉原始错误日志和弹窗
        // console.error('❌ 数字人视频播放失败:', error)
        // alert('数字人视频播放失败')
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
        // alert(`配置错误:\n${configValidation.errors.join('\n')}`)
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
            // 使用console.log以避免触发任何可能的错误弹窗
            console.log('🎯 数字人服务错误（已拦截）:', error.message || error)
            // 注释掉可能的弹窗显示，但保留日志记录
            // Alert.alert('错误', error)
            setStatus('idle')
          },
        })
      }
    } catch (error) {
      console.error('初始化数字人失败:', error)
    }
  }

  const handleAvatarPress = async () => {
    if (!enableInteraction || !isInitialized) {
      console.log('数字人未就绪，无法开始对话')
      return
    }

    if (status === 'idle') {
      // 开始语音对话
      console.log('🎙️ 用户点击开始语音对话')
      const result = await digitalHumanService.startVoiceConversation()
      if (result.success) {
        console.log(`✅ 语音对话已开始: ${result.message}`)
      } else {
        console.error('❌ 语音对话启动失败:', result.error)
      }
    } else if (status === 'recording') {
      // 结束录音并处理
      console.log('🛑 用户点击停止录音')
      const processed = await digitalHumanService.stopVoiceConversation()
      if (processed) {
        console.log('✅ 语音对话处理完成')
      } else {
        // 使用console.log以避免触发任何可能的错误弹窗
        console.log('🎯 语音对话处理失败（已拦截）')
      }
    } else if (status === 'processing') {
      console.log('⏳ 正在处理中，请稍候...')
    } else if (status === 'speaking') {
      console.log('🗣️ 数字人正在说话中...')
    }
  }

  const getStatusText = () => {
    if (!enableInteraction) return ''

    switch (status) {
      case 'recording':
        return ''
      case 'processing':
        return ''
      case 'speaking':
        return ''
      case 'connected':
        return ''
      case 'disconnected':
        return ''
      default:
        return isInitialized ? '' : ''
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

  // 获取智能背景融合颜色
  const getBackgroundBlendColors = () => {
    // 根据主题动态调整背景色
    const baseColor = isDark ? 'rgba(30, 30, 30, ' : 'rgba(248, 248, 248, '
    const accentColor = isDark ? 'rgba(60, 60, 60, ' : 'rgba(240, 240, 240, '

    return {
      background: `${baseColor}0.7)`,
      accent: `${accentColor}0.4)`,
      transparent: 'transparent',
    }
  }

  // 获取渐变遮罩颜色（根据状态和情绪）
  const getGradientMaskColors = () => {
    let primaryColor = isDark ? 'rgba(20, 20, 20, ' : 'rgba(255, 255, 255, '

    // 根据状态调整融合颜色
    if (showAngryVideo) {
      primaryColor = 'rgba(255, 68, 68, '
    } else if (showHappyVideo) {
      primaryColor = 'rgba(255, 215, 0, '
    } else if (showSadVideo) {
      primaryColor = 'rgba(59, 130, 246, '
    } else if (showScaredVideo) {
      primaryColor = 'rgba(139, 69, 19, '
    } else {
      switch (status) {
        case 'recording':
          primaryColor = 'rgba(255, 68, 68, '
          break
        case 'processing':
          primaryColor = 'rgba(255, 170, 0, '
          break
        case 'speaking':
          primaryColor = 'rgba(0, 170, 68, '
          break
        default:
          primaryColor = isDark ? 'rgba(40, 40, 40, ' : 'rgba(250, 250, 250, '
      }
    }

    return [
      'transparent', // 中心透明
      `${primaryColor}0.05)`, // 轻微融合
      `${primaryColor}0.15)`, // 中间层
      `${primaryColor}0.35)`, // 边缘融合
    ]
  }

  // 获取优化的环境光效颜色
  const getAmbientLightColors = () => {
    const blendColors = getBackgroundBlendColors()

    if (showAngryVideo) {
      return [blendColors.background, 'rgba(255, 68, 68, 0.08)', blendColors.transparent]
    } if (showHappyVideo) {
      return [blendColors.background, 'rgba(255, 215, 0, 0.08)', blendColors.transparent]
    } if (showSadVideo) {
      return [blendColors.background, 'rgba(59, 130, 246, 0.08)', blendColors.transparent]
    } if (showScaredVideo) {
      return [blendColors.background, 'rgba(139, 69, 19, 0.08)', blendColors.transparent]
    }
    switch (status) {
      case 'recording':
        return [blendColors.background, 'rgba(255, 68, 68, 0.12)', blendColors.transparent]
      case 'processing':
        return [blendColors.background, 'rgba(255, 170, 0, 0.12)', blendColors.transparent]
      case 'speaking':
        return [blendColors.background, 'rgba(0, 170, 68, 0.12)', blendColors.transparent]
      default:
        return [blendColors.background, blendColors.accent, blendColors.transparent]
    }
  }

  // 动态光效动画
  useEffect(() => {
    let animation
    let glowAnimation

    if (status === 'recording') {
      // 录音时的脉动效果（更快更明显）
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.08,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      )

      glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 0.7,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      )
    } else if (status === 'speaking') {
      // 说话时的光效波动（更柔和）
      glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 0.6,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.2,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      )

      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.03,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      )
    } else if (status === 'processing') {
      // 处理时的旋转光效
      glowAnimation = Animated.loop(
        Animated.timing(glowOpacity, {
          toValue: 0.5,
          duration: 1500,
          useNativeDriver: true,
        }),
      )
    } else {
      // 静止状态 - 平滑过渡
      Animated.timing(glowOpacity, {
        toValue: 0.25,
        duration: 1000,
        useNativeDriver: true,
      }).start()

      Animated.timing(pulseScale, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start()

      // 遮罩透明度调整
      Animated.timing(maskOpacity, {
        toValue: 0.8,
        duration: 1000,
        useNativeDriver: true,
      }).start()
    }

    // 状态变化时调整遮罩透明度
    if (status === 'recording' || status === 'speaking') {
      Animated.timing(maskOpacity, {
        toValue: 0.6, // 活跃状态时降低遮罩透明度
        duration: 800,
        useNativeDriver: true,
      }).start()
    } else {
      Animated.timing(maskOpacity, {
        toValue: 0.8,
        duration: 800,
        useNativeDriver: true,
      }).start()
    }

    if (animation) {
      animation.start()
    }
    if (glowAnimation) {
      glowAnimation.start()
    }

    return () => {
      if (animation) {
        animation.stop()
      }
      if (glowAnimation) {
        glowAnimation.stop()
      }
    }
  }, [status, showAngryVideo, showHappyVideo, showSadVideo, showScaredVideo])

  const handleVideoStatusUpdate = (videoStatus) => {
    // 当生气视频播放完成时，通知父组件
    if (showAngryVideo && videoStatus.didJustFinish && onAngryVideoEnd) {
      onAngryVideoEnd()
    }
    // 当开心视频播放完成时，通知父组件
    if (showHappyVideo && videoStatus.didJustFinish && onHappyVideoEnd) {
      onHappyVideoEnd()
    }
    // 当伤心视频播放完成时，通知父组件
    if (showSadVideo && videoStatus.didJustFinish && onSadVideoEnd) {
      onSadVideoEnd()
    }
    // 当害怕视频播放完成时，通知父组件
    if (showScaredVideo && videoStatus.didJustFinish && onScaredVideoEnd) {
      onScaredVideoEnd()
    }
  }

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handleAvatarPress}
      activeOpacity={enableInteraction ? 0.8 : 1}
      disabled={!enableInteraction || !isInitialized}
    >

      <View style={[styles.videoContainer, videoStyle && { width: videoStyle.width, height: videoStyle.height }]}>
        {/* 毛玻璃背景层（如果支持） */}
        <BlurView
          intensity={isDark ? 25 : 20}
          style={styles.blurBackground}
          tint={isDark ? 'dark' : 'light'}
        />

        {/* 后备背景层 */}
        <View style={[
          styles.fallbackBackground,
          {
            backgroundColor: isDark ? 'rgba(20, 20, 20, 0.6)' : 'rgba(250, 250, 250, 0.6)',
          },
        ]}
        />
        <Video
          ref={videoRef}
          style={[styles.video, videoStyle]}
          source={
            showAngryVideo
              ? require('../../assets/images/嘎巴龙生气.mp4')
              : showHappyVideo
                ? require('../../assets/images/嘎巴龙开心.mp4')
                : showSadVideo
                  ? require('../../assets/images/嘎巴龙伤心.mp4')
                  : showScaredVideo
                    ? require('../../assets/images/嘎巴龙害怕.mp4')
                    : require('../../assets/images/嘎巴龙待机.mp4')
          }
          useNativeControls={showControls}
          resizeMode="cover"
          isLooping={showAngryVideo || showHappyVideo || showSadVideo || showScaredVideo ? false : loop}
          shouldPlay={autoPlay}
          onLoad={(status) => {
            console.log('数字人视频加载完成:', status)
            setVideoLoaded(true)
            setVideoError(null)
          }}
          onError={DISABLE_VIDEO_ALERTS ? ((error) => {
            // 使用专门的拦截日志格式，避免触发任何弹窗机制
            console.log('🎯 数字人视频加载失败（已拦截）:', error.message || error)
            setVideoError(error)
            setVideoLoaded(false)
            // 完全不调用console.error或弹窗
          }) : ((error) => {
            console.error('数字人视频加载失败:', error)
            setVideoError(error)
            setVideoLoaded(false)
          })}
          onPlaybackStatusUpdate={(status) => {
            // 处理视频状态更新
            handleVideoStatusUpdate(status)

            // 处理视频播放错误
            if (status.error) {
              if (DISABLE_VIDEO_ALERTS) {
                // 使用专门的拦截日志格式，避免触发任何弹窗机制
                console.log('🎯 数字人视频播放错误（已拦截）:', status.error.message || status.error)
              } else {
                console.error('数字人视频播放错误:', status.error)
              }
              setVideoError(status.error)
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
    width: 200,
    height: 300,
    // 完全移除边框和阴影
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    // 移除阴影效果，由其他层处理
    shadowOpacity: 0,
    elevation: 0,
    // 确保没有任何边框样式
    borderColor: 'transparent',
    outlineWidth: 0,
  },
  video: {
    width: 200,
    height: 300,
    // 完全移除边框和圆角，实现无缝融合
    borderRadius: 0, // 移除所有圆角
    borderWidth: 0, // 确保没有边框
    backgroundColor: 'transparent',
    overflow: 'hidden',
    opacity: 1, // 恢复完全不透明，由其他层处理融合
    // 移除所有可能产生边框的属性
    borderColor: 'transparent',
    outlineWidth: 0,
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
  // 深度融合效果样式
  backgroundBlendContainer: {
    position: 'absolute',
    width: 320, // 更大的背景融合区域
    height: 420,
    zIndex: -2, // 在所有元素后面
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundBlend: {
    width: '100%',
    height: '100%',
    borderRadius: 160,
    opacity: 0.6,
  },
  blurBackground: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 23,
    zIndex: -1, // 在视频后面
    overflow: 'hidden',
  },
  fallbackBackground: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 23,
    zIndex: -2, // 在BlurView后面作为后备
  },
  gradientMaskContainer: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    zIndex: 2, // 在视频上面，作为遮罩层
    pointerEvents: 'none',
  },
  gradientMask: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  innerGlow: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 16,
    zIndex: 1, // 在视频上面但在遮罩下面
    pointerEvents: 'none',
  },
})
