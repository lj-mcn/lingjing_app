import React, { useEffect, useState, useContext } from 'react'
import {
  Text, View, ScrollView, StyleSheet, TouchableOpacity, Alert, Image,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import ScreenTemplate from '../../components/ScreenTemplate'
import DigitalAvatar from '../../components/DigitalAvatar'
// import ConfigTester from '../../components/ConfigTester'
import digitalHumanService from '../../services/DigitalHumanService'
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

  useEffect(() => {
    console.log('Voice screen - 嘎巴龙语音交互')
  }, [])

  const handleMessage = (message) => {
    setMessages((prev) => [...prev, message])
  }

  const startChat = () => {
    setChatStarted(true)
  }

  const startVoiceRecording = async () => {
    setIsListening(true)
    const result = await digitalHumanService.startVoiceRecording()
    if (!result.success) {
      console.error('无法启动语音录制:', result.error)
      // Alert.alert('错误', `无法启动语音录制: ${result.error}`)
      setIsListening(false)
    }
  }

  const stopVoiceRecording = async () => {
    setIsListening(false)
    const result = await digitalHumanService.stopVoiceRecording()
    if (!result.success) {
      console.error('语音处理失败:', result.error)
      // Alert.alert('错误', `语音处理失败: ${result.error}`)
    }
  }

  // 切换智能对话模式
  const toggleSmartConversationMode = async () => {
    if (smartConversationMode) {
      const result = await digitalHumanService.stopSmartConversation()
      if (result.success) {
        setSmartConversationMode(false)
        setIsListening(false)
        setVadState('idle')
      }
    } else {
      if (!chatStarted) {
        setChatStarted(true)
      }

      const result = await digitalHumanService.startSmartConversation()
      if (result.success) {
        setSmartConversationMode(true)
        setIsListening(true)
        setVadState('listening')
      }
    }
  }

  // 监听数字人服务状态变化
  useEffect(() => {
    digitalHumanService.setCallbacks({
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
        digitalHumanService.stopSmartConversation()
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
              onPress={startChat}
              activeOpacity={0.8}
            >
              <Image
                source={require('../../../assets/images/纸团.png')}
                style={styles.paperBallImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* 智能对话控制按钮 */}
            <View style={styles.smartControlContainer}>
              <TouchableOpacity
                style={[
                  styles.smartButton,
                  smartConversationMode ? styles.smartButtonActive : styles.smartButtonInactive,
                ]}
                onPress={toggleSmartConversationMode}
                activeOpacity={0.8}
              >
                <Text style={styles.smartButtonIcon}>
                  {smartConversationMode ? '🤖' : '🚀'}
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
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12,
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
    paddingVertical: 18,
    paddingHorizontal: 35,
    borderRadius: 30,
    marginBottom: 10,
    minWidth: 220,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  smartButtonActive: {
    backgroundColor: '#ff6b6b',
    shadowColor: '#ff6b6b',
  },
  smartButtonInactive: {
    backgroundColor: '#4ecdc4',
    shadowColor: '#4ecdc4',
  },
  smartButtonIcon: {
    fontSize: 28,
    marginBottom: 5,
  },
  smartButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
})
