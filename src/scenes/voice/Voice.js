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
  // 移除isListening状态，因为不再需要独立的语音按钮
  // const [showConfigTester, setShowConfigTester] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)

  useEffect(() => {
    console.log('Voice screen - 嘎巴龙语音交互')
  }, [])

  const handleMessage = (message) => {
    setMessages((prev) => [...prev, message])
  }

  const toggleChat = async () => {
    if (!chatStarted) {
      // 开始对话
      setChatStarted(true)
      const result = await digitalHumanService.startVoiceConversation()
      if (result.success) {
        console.log(`✅ 语音对话已开始: ${result.message}`)
      } else {
        console.error('❌ 语音对话启动失败:', result.error)
        Alert.alert('错误', `无法启动语音对话: ${result.error}`)
        setChatStarted(false)
      }
    } else {
      // 结束对话
      const result = await digitalHumanService.stopVoiceConversation()
      if (result) {
        console.log('✅ 语音对话已结束')
      }
      setChatStarted(false)
    }
  }

  // 移除语音录制相关函数，现在由DigitalAvatar内部处理

  return (
    <ScreenTemplate>
      <ScrollView style={styles.container}>
        {/* 头部标题 */}
        <View style={styles.headerContainer}>
          <Text style={[styles.title, { color: colorScheme.text }]}>
            🎤 语音对话
          </Text>
          <Text style={[styles.subtitle, { color: colorScheme.text }]}>
            与嘎巴龙进行语音交互
          </Text>
        </View>

        {/* 数字人区域 */}
        <View style={styles.avatarContainer}>
          <View style={[styles.backgroundDecoration, {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
          }]}
          />

          <DigitalAvatar
            style={styles.avatar}
            videoStyle={styles.avatarVideo}
            onMessage={handleMessage}
            enableInteraction={false}
          />

          <Text style={[styles.avatarStatus, { color: colorScheme.text }]}>
            {!chatStarted ? '😊 点击纸团开始对话' : '🗣️ 对话模式已开启'}
          </Text>
        </View>

        {/* 纸团按钮 - 开始/关闭对话切换 */}
        <View style={styles.paperBallContainer}>
          <TouchableOpacity
            style={[
              styles.paperBallButton,
              chatStarted && styles.paperBallButtonActive,
            ]}
            onPress={toggleChat}
            activeOpacity={0.8}
          >
            <Image
              source={require('../../../assets/images/纸团.png')}
              style={[
                styles.paperBallImage,
                chatStarted && styles.paperBallImageActive,
              ]}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={[styles.paperBallText, { color: colorScheme.text }]}>
            {!chatStarted ? '点击纸团开始语音对话 ✨' : '点击纸团关闭对话 ❌'}
          </Text>
        </View>

        {/* 对话历史 - 只在开启对话时显示 */}
        {chatStarted && (
          <View style={[styles.chatContainer, { backgroundColor: colorScheme.cardBackground }]}>
            <Text style={[styles.chatTitle, { color: colorScheme.text }]}>对话记录</Text>
            <ScrollView style={styles.messagesContainer}>
              {messages.length === 0 ? (
                <Text style={[styles.emptyText, { color: colorScheme.text }]}>
                  开始与嘎巴龙对话吧！🗣️
                </Text>
              ) : (
                messages.map((msg, index) => (
                  <View
                    key={index}
                    style={[
                      styles.messageItem,
                      msg.role === 'user' ? styles.userMessage : styles.assistantMessage,
                    ]}
                  >
                    <Text style={[
                      styles.messageText,
                      { color: msg.role === 'user' ? colors.white : colorScheme.text },
                    ]}
                    >
                      {msg.role === 'user' ? '👤 我：' : '🐉 嘎巴龙：'}{msg.message}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  avatarVideo: {
    width: 180,
    height: 250,
    borderRadius: 15,
  },
  avatarStatus: {
    fontSize: fontSize.middle,
    textAlign: 'center',
    fontWeight: '500',
  },
  backgroundDecoration: {
    position: 'absolute',
    width: 250,
    height: 320,
    borderRadius: 30,
    zIndex: -1,
    opacity: 0.3,
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
  testButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderColor: '#007AFF',
    borderWidth: 1,
    borderRadius: 25,
    paddingHorizontal: 30,
    paddingVertical: 12,
    alignSelf: 'center',
    marginBottom: 20,
  },
  testButtonText: {
    color: '#007AFF',
    fontSize: fontSize.small,
    textAlign: 'center',
    fontWeight: '500',
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
  paperBallButtonActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(76, 175, 80, 0.5)',
  },
  paperBallImage: {
    width: 100,
    height: 100,
  },
  paperBallImageActive: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  paperBallText: {
    fontSize: fontSize.large,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
    opacity: 0.8,
  },
})
