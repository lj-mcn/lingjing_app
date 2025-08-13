import React, { useEffect, useState, useContext } from 'react'
import { Text, View, ScrollView, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import ScreenTemplate from '../../components/ScreenTemplate'
import DigitalAvatar from '../../components/DigitalAvatar'
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
    cardBackground: isDark ? '#333' : '#f8f9fa'
  }

  const [messages, setMessages] = useState([])
  const [isListening, setIsListening] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)

  useEffect(() => {
    console.log('Voice screen - 嘎巴龙语音交互')
  }, [])

  const handleMessage = (message) => {
    setMessages(prev => [...prev, message])
  }

  const startChat = () => {
    setChatStarted(true)
  }

  const startVoiceRecording = async () => {
    setIsListening(true)
    const result = await digitalHumanService.startVoiceRecording()
    if (!result.success) {
      Alert.alert('错误', '无法启动语音录制: ' + result.error)
      setIsListening(false)
    }
  }

  const stopVoiceRecording = async () => {
    setIsListening(false)
    const result = await digitalHumanService.stopVoiceRecording()
    if (!result.success) {
      Alert.alert('错误', '语音处理失败: ' + result.error)
    }
  }

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
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'
          }]} />
          
          <DigitalAvatar 
            style={styles.avatar}
            videoStyle={styles.avatarVideo}
            onMessage={handleMessage}
            enableInteraction={chatStarted}
          />
          
          <Text style={[styles.avatarStatus, { color: colorScheme.text }]}>
            {!chatStarted ? '😊 点击纸团开始对话' : 
             isListening ? '🎧 正在聆听...' : '💤 等待语音输入'}
          </Text>
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
            <Text style={[styles.paperBallText, { color: colorScheme.text }]}>
              点击纸团开始语音对话 ✨
            </Text>
          </View>
        ) : (
          <>
            {/* 语音控制按钮 */}
            <View style={styles.controlContainer}>
              <TouchableOpacity
                style={[
                  styles.voiceButton,
                  isListening ? styles.voiceButtonActive : styles.voiceButtonInactive
                ]}
                onPress={isListening ? stopVoiceRecording : startVoiceRecording}
                activeOpacity={0.8}
              >
                <Text style={styles.voiceButtonIcon}>
                  {isListening ? '⏹️' : '🎤'}
                </Text>
                <Text style={styles.voiceButtonText}>
                  {isListening ? '停止录音' : '开始语音'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 对话历史 */}
            <View style={[styles.chatContainer, { backgroundColor: colorScheme.cardBackground }]}>
              <Text style={[styles.chatTitle, { color: colorScheme.text }]}>对话记录</Text>
              <ScrollView style={styles.messagesContainer}>
                {messages.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colorScheme.text }]}>
                    按下语音按钮开始对话吧！🗣️
                  </Text>
                ) : (
                  messages.map((msg, index) => (
                    <View key={index} style={[
                      styles.messageItem,
                      msg.role === 'user' ? styles.userMessage : styles.assistantMessage
                    ]}>
                      <Text style={[
                        styles.messageText,
                        { color: msg.role === 'user' ? colors.white : colorScheme.text }
                      ]}>
                        {msg.role === 'user' ? '👤 我：' : '🐉 嘎巴龙：'}{msg.message}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </>
        )}

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
    backgroundColor: colors.tertiary,
  },
  voiceButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  voiceButtonText: {
    color: colors.white,
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
})