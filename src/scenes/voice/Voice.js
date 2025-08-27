import React, { useEffect, useState, useContext } from 'react'
import {
  Text, View, ScrollView, StyleSheet, TouchableOpacity, Alert, Image, Animated,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import ScreenTemplate from '../../components/ScreenTemplate'
import DigitalAvatar from '../../components/DigitalAvatar'
// import ConfigTester from '../../components/ConfigTester'
import digitalAssistant from '../../services/assistant/DigitalAssistant'
import { colors, fontSize } from '../../theme'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'
import { UserDataContext } from '../../context/UserDataContext'

export default function Voice() {
  const navigation = useNavigation()
  const { userData } = useContext(UserDataContext)
  const { scheme } = useContext(ColorSchemeContext)
  const isDark = scheme === 'dark'
  const colorScheme = {
    text: isDark ? colors.white : colors.primaryText,
    background: isDark ? colors.black : colors.white,
    cardBackground: isDark ? '#333' : '#f8f9fa',
  }

  const [messages, setMessages] = useState([])
  const [isListening, setIsListening] = useState(false)
  // const [showConfigTester, setShowConfigTester] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)
  const [smartConversationMode, setSmartConversationMode] = useState(false)
  const [vadState, setVadState] = useState('idle') // 语音活动状态
  const [paperBallScale] = useState(new Animated.Value(1)) // 纸团缩放动画
  const [isManualRecording, setIsManualRecording] = useState(false) // 手动录音状态
  const [isPTTRecording, setIsPTTRecording] = useState(false) // PTT录音状态
  const [pttButtonScale] = useState(new Animated.Value(1)) // PTT按钮缩放动画

  useEffect(() => {
    console.log('Voice screen - 嘎巴龙语音交互')
  }, [])

  const handleMessage = (message) => {
    setMessages((prev) => [...prev, message])
  }

  const startChat = () => {
    setChatStarted(true)
  }

  // 纸团点击处理，立即触发并播放动画
  const handlePaperBallPress = () => {
    // 立即执行startChat
    startChat()
    // 同时播放放大动画作为视觉反馈
    Animated.spring(paperBallScale, {
      toValue: 1.2,
      useNativeDriver: true,
      tension: 150,
      friction: 3,
    }).start()
  }

  // 纸团按下动画
  const handlePaperBallPressIn = () => {
    Animated.spring(paperBallScale, {
      toValue: 1.2,
      useNativeDriver: true,
      tension: 150,
      friction: 3,
    }).start()
  }

  const handlePaperBallPressOut = () => {
    Animated.spring(paperBallScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 150,
      friction: 3,
    }).start()
  }

  const startVoiceRecording = async () => {
    setIsListening(true)
    const result = await digitalAssistant.startVoiceRecording()
    if (!result.success) {
      console.error('无法启动语音录制:', result.error)
      // Alert.alert('错误', `无法启动语音录制: ${result.error}`)
      setIsListening(false)
    }
  }

  const stopVoiceRecording = async () => {
    setIsListening(false)
    const result = await digitalAssistant.stopVoiceRecording()
    if (!result.success) {
      console.error('语音处理失败:', result.error)
      // Alert.alert('错误', `语音处理失败: ${result.error}`)
    }
  }

  // 手动麦克风按钮处理
  const handleManualMicPress = async () => {
    if (isManualRecording) {
      // 停止录音
      console.log('🎤 停止手动录音')
      setIsManualRecording(false)
      const result = await digitalAssistant.stopManualVoiceRecording()
      if (!result.success) {
        console.error('语音处理失败:', result.error)
      }
    } else {
      // 开始录音 - 首先停止AI语音输出
      console.log('🎤 开始手动录音 - 停止AI输出')
      setIsManualRecording(true)

      // 立即停止AI说话并开始录音
      const result = await digitalAssistant.startManualVoiceRecording()
      if (!result.success) {
        console.error('无法启动语音录制:', result.error)
        setIsManualRecording(false)
      }
    }
  }

  // PTT按钮按下处理 - 开始录音
  const handlePTTPressIn = async () => {
    try {
      console.log('🎤 PTT按下 - 开始录音')
      setIsPTTRecording(true)

      // 按钮缩放动画
      Animated.spring(pttButtonScale, {
        toValue: 1.1,
        useNativeDriver: true,
        tension: 150,
        friction: 4,
      }).start()

      // 开始录音
      const result = await digitalAssistant.startManualVoiceRecording()
      if (!result.success) {
        console.error('PTT录音启动失败:', result.error)
        setIsPTTRecording(false)
        // 恢复按钮大小
        Animated.spring(pttButtonScale, {
          toValue: 1,
          useNativeDriver: true,
        }).start()
      }
    } catch (error) {
      console.error('PTT按下失败:', error)
      setIsPTTRecording(false)
    }
  }

  // PTT按钮松开处理 - 停止录音
  const handlePTTPressOut = async () => {
    try {
      console.log('🎤 PTT松开 - 停止录音')

      // 恢复按钮大小
      Animated.spring(pttButtonScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 150,
        friction: 4,
      }).start()

      if (isPTTRecording) {
        setIsPTTRecording(false)
        // 停止录音并处理
        const result = await digitalAssistant.stopManualVoiceRecording()
        if (!result.success) {
          console.error('PTT录音停止失败:', result.error)
        }
      }
    } catch (error) {
      console.error('PTT松开失败:', error)
      setIsPTTRecording(false)
    }
  }

  // 切换智能对话模式 - 保留但改为备用功能
  const toggleSmartConversationMode = async () => {
    if (smartConversationMode) {
      const result = await digitalAssistant.stopSmartConversation()
      if (result.success) {
        setSmartConversationMode(false)
        setIsListening(false)
        setVadState('idle')
      }
    } else {
      if (!chatStarted) {
        setChatStarted(true)
      }

      const result = await digitalAssistant.startSmartConversation()
      if (result.success) {
        setSmartConversationMode(true)
        setIsListening(true)
        setVadState('listening')
      }
    }
  }

  // 监听数字人服务状态变化
  useEffect(() => {
    digitalAssistant.setCallbacks({
      onStatusChange: (status) => {
        if (status === 'listening') {
          setVadState('listening')
        } else if (status === 'speaking') {
          setVadState('speaking')
        } else if (status === 'silence') {
          setVadState('silence')
        } else if (status === 'processing') {
          setVadState('processing')
        } else if (status === 'idle') {
          setVadState('idle')
        }
      },
      onMessage: handleMessage,
    })

    // 清理函数，组件卸载时清理状态
    return () => {
      // 如果组件卸载时还有活跃的对话模式，进行清理
      if (smartConversationMode) {
        digitalAssistant.stopSmartConversation()
      }
    }
  }, [smartConversationMode])

  return (
    <ScreenTemplate>
      <ScrollView style={styles.container}>
        {/* 头部标题 - 隐藏 */}
        <View style={[styles.headerContainer, { opacity: 0, height: 0 }]}>
          <Text style={[styles.title, { color: 'transparent', opacity: 0 }]}>
            🎤 语音对话
          </Text>
          <Text style={[styles.subtitle, { color: 'transparent', opacity: 0 }]}>
            与嘎巴龙进行语音交互
          </Text>
        </View>

        {/* 数字人区域 */}
        <View style={styles.avatarContainer}>
          {/* 移除旧的背景装饰，使用沉浸式效果 */}
          <DigitalAvatar
            style={styles.avatar}
            videoStyle={styles.avatarVideo}
            onMessage={handleMessage}
            enableInteraction={chatStarted}
          />

        </View>

        {!chatStarted ? (
          /* 纸团按钮 - 开始聊天 */
          <View style={styles.paperBallContainer}>
            <TouchableOpacity
              style={styles.paperBallButton}
              onPress={handlePaperBallPress}
              activeOpacity={1}
            >
              <Animated.View style={{ transform: [{ scale: paperBallScale }] }}>
                <Image
                  source={require('../../../assets/images/纸团.png')}
                  style={styles.paperBallImage}
                  resizeMode="contain"
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* PTT (Push-to-Talk) 主按钮 */}
            <View style={styles.smartControlContainer}>
              <TouchableOpacity
                style={[
                  styles.pttButton,
                  isPTTRecording ? styles.pttButtonActive : styles.pttButtonInactive,
                ]}
                onPressIn={handlePTTPressIn}
                onPressOut={handlePTTPressOut}
                activeOpacity={1}
                delayPressOut={0}
              >
                <Animated.View style={{ transform: [{ scale: pttButtonScale }] }}>
                  <Text style={styles.pttButtonIcon}>
                    {isPTTRecording ? '🔴' : '🎤'}
                  </Text>
                  <Text style={[
                    styles.pttButtonText,
                    isPTTRecording ? styles.pttButtonTextActive : styles.pttButtonTextInactive,
                  ]}
                  >
                    {isPTTRecording ? '录音中...' : '按住说话'}
                  </Text>
                  <Text style={styles.pttButtonHint}>
                    {isPTTRecording ? '松开发送' : '按下开始录音'}
                  </Text>
                </Animated.View>
              </TouchableOpacity>

              {/* 模式切换按钮 - 可选的智能对话模式 */}
              <TouchableOpacity
                style={styles.modeToggleButton}
                onPress={toggleSmartConversationMode}
                activeOpacity={0.7}
              >
                <Text style={styles.modeToggleText}>
                  {smartConversationMode ? '退出智能模式' : '智能连续对话'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 原有的单次录音按钮（在智能对话模式下隐藏） */}
            {!smartConversationMode && (
              <View style={styles.controlContainer}>
                <TouchableOpacity
                  style={[
                    styles.voiceButton,
                    isListening ? styles.voiceButtonActive : styles.voiceButtonInactive,
                  ]}
                  onPress={isListening ? stopVoiceRecording : startVoiceRecording}
                  activeOpacity={0.8}
                >
                  <Text style={styles.voiceButtonIcon}>
                    {isListening ? '⏹️' : '🎤'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 对话历史 - 隐藏 */}
            <View style={[styles.chatContainer, { backgroundColor: 'transparent', opacity: 0 }]}>
              <Text style={[styles.chatTitle, { color: 'transparent' }]}>对话记录</Text>
              <ScrollView style={styles.messagesContainer}>
                {messages.length === 0 ? (
                  <Text style={[styles.emptyText, { color: 'transparent' }]}>
                    按下语音按钮开始对话吧！🗣️
                  </Text>
                ) : (
                  messages.map((msg, index) => (
                    <View
                      key={index}
                      style={[
                        styles.messageItem,
                        msg.role === 'user' ? styles.userMessage : styles.assistantMessage,
                        { opacity: 0 },
                      ]}
                    >
                      <Text style={[
                        styles.messageText,
                        { color: 'transparent' },
                      ]}
                      >
                        {msg.role === 'user' ? '👤 我：' : '🐉 嘎巴龙：'}{msg.message}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </>
        )}

        {/* 测试按钮 */}
        {/* <TouchableOpacity
          style={styles.testButton}
          onPress={() => setShowConfigTester(true)}
        >
          <Text style={styles.testButtonText}>🧪 测试语音服务</Text>
        </TouchableOpacity>

        {/* 配置测试器 */}
        {/* {showConfigTester && (
          <ConfigTester onClose={() => setShowConfigTester(false)} />
        )} */}
      </ScrollView>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: fontSize.xLarge,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.middle,
    opacity: 0.8,
    textAlign: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    position: 'relative',
    marginBottom: 30,
  },
  avatar: {
    marginBottom: 15,
    // 移除阴影，由DigitalAvatar组件内部处理
  },
  avatarVideo: {
    width: 200, // 统一尺寸
    height: 300,
    borderRadius: 15, // 统一圆角
  },
  avatarStatus: {
    fontSize: fontSize.middle,
    textAlign: 'center',
    fontWeight: '500',
  },
  // 移除旧的背景装饰，使用沉浸式效果
  // backgroundDecoration: {
  //   position: 'absolute',
  //   width: 250,
  //   height: 320,
  //   borderRadius: 30,
  //   zIndex: -1,
  //   opacity: 0.3,
  // },
  controlContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  voiceButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  voiceButtonActive: {
    backgroundColor: '#ff4757',
  },
  voiceButtonInactive: {
    backgroundColor: 'transparent',
  },
  voiceButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
    opacity: 0,
  },
  voiceButtonText: {
    color: 'transparent',
    fontSize: fontSize.small,
    fontWeight: 'bold',
  },
  chatContainer: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    minHeight: 200,
  },
  chatTitle: {
    fontSize: fontSize.large,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  messagesContainer: {
    maxHeight: 300,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: fontSize.middle,
    opacity: 0.6,
    fontStyle: 'italic',
    paddingVertical: 30,
  },
  messageItem: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    maxWidth: '85%',
  },
  userMessage: {
    backgroundColor: colors.tertiary,
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: fontSize.small,
    lineHeight: 20,
  },
  paperBallContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    flex: 1,
    justifyContent: 'center',
  },
  paperBallButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  paperBallImage: {
    width: 100,
    height: 100,
  },
  paperBallText: {
    fontSize: fontSize.large,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
    opacity: 0.8,
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
    fontStyle: 'italic',
  },
  smartControlContainer: {
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  smartButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
    height: 160,
    borderRadius: 80,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 15,
  },
  smartButtonActive: {
    backgroundColor: '#f5f5dc',
    shadowColor: '#d2b48c',
    borderWidth: 1,
    borderColor: '#e6e6fa',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 15,
  },
  smartButtonInactive: {
    backgroundColor: '#f5f5dc',
    shadowColor: '#d2b48c',
    borderWidth: 1,
    borderColor: '#e6e6fa',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 15,
  },
  smartButtonIcon: {
    fontSize: 28,
    marginBottom: 5,
  },
  smartButtonText: {
    color: '#8b4513',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(139, 69, 19, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  manualMicButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    marginTop: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  manualMicButtonActive: {
    backgroundColor: '#ff4757', // 红色表示录音中
    shadowColor: '#ff4757',
  },
  manualMicButtonInactive: {
    backgroundColor: '#3742fa', // 蓝色表示可录音
    shadowColor: '#3742fa',
  },
  manualMicButtonIcon: {
    fontSize: 28,
    marginBottom: 4,
    color: 'white',
  },
  manualMicButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // PTT (Push-to-Talk) 按钮样式
  pttButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 180,
    height: 180,
    borderRadius: 90,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 20,
  },
  pttButtonActive: {
    backgroundColor: '#ff4757', // 录音时红色
    shadowColor: '#ff4757',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  pttButtonInactive: {
    backgroundColor: '#3742fa', // 待机时蓝色
    shadowColor: '#3742fa',
    borderWidth: 2,
    borderColor: '#e6e6fa',
  },
  pttButtonIcon: {
    fontSize: 40,
    marginBottom: 8,
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  pttButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  pttButtonTextActive: {
    color: '#ffffff',
    textShadowColor: 'rgba(255,71,87,0.5)',
  },
  pttButtonTextInactive: {
    color: '#ffffff',
    textShadowColor: 'rgba(55,66,250,0.5)',
  },
  pttButtonHint: {
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
    opacity: 0.9,
    fontWeight: '500',
  },
  // 模式切换按钮
  modeToggleButton: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 15,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  modeToggleText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
})
