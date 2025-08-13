import React, { useEffect, useState, useContext, useRef } from 'react'
import { Text, View, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import ScreenTemplate from '../../components/ScreenTemplate'
import DigitalAvatar from '../../components/DigitalAvatar'
import Button from '../../components/Button'
<<<<<<< HEAD
import ConfigTester from '../../components/ConfigTester'
=======
>>>>>>> 813-llm
import digitalHumanService from '../../services/DigitalHumanService'
import { colors, fontSize } from '../../theme'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'
import { UserDataContext } from '../../context/UserDataContext'

export default function TextChat() {
  const navigation = useNavigation()
  const { userData } = useContext(UserDataContext)
  const { scheme } = useContext(ColorSchemeContext)
  const scrollViewRef = useRef(null)
  const isDark = scheme === 'dark'
  const colorScheme = {
    text: isDark ? colors.white : colors.primaryText,
    background: isDark ? colors.black : colors.white,
    inputBackground: isDark ? '#333' : '#f5f5f5',
    cardBackground: isDark ? '#2a2a2a' : '#ffffff'
  }

  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
<<<<<<< HEAD
  const [showConfigTester, setShowConfigTester] = useState(false)
=======
>>>>>>> 813-llm
  const [chatStarted, setChatStarted] = useState(false)

  useEffect(() => {
    console.log('Text screen - 嘎巴龙文字交互')
  }, [])

  useEffect(() => {
    // 滚动到最新消息
    if (messages.length > 0 && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true })
    }
  }, [messages])

  const startChat = () => {
    setChatStarted(true)
  }

  const handleMessage = (message) => {
    setMessages(prev => [...prev, message])
  }

  const handleSendText = async () => {
    if (inputText.trim().length === 0) return
    
    const userMessage = inputText.trim()
    setInputText('')
    setIsTyping(true)
    
    // 添加用户消息到对话历史
    const newUserMessage = {
      role: 'user',
      message: userMessage,
      timestamp: new Date().toLocaleTimeString()
    }
    setMessages(prev => [...prev, newUserMessage])
    
    try {
      // 发送文本消息给数字人
      const result = await digitalHumanService.sendTextMessage(userMessage)
      if (!result.success) {
        Alert.alert('错误', '发送消息失败: ' + result.error)
        // 添加错误消息
        const errorMessage = {
          role: 'assistant',
          message: '抱歉，我现在无法回复您的消息，请稍后再试。',
          timestamp: new Date().toLocaleTimeString()
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('发送消息错误:', error)
      Alert.alert('错误', '发送消息时出现异常')
    } finally {
      setIsTyping(false)
    }
  }

  const clearMessages = () => {
    Alert.alert(
      '清空对话',
      '确定要清空所有对话记录吗？',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确定', 
          onPress: () => setMessages([]),
          style: 'destructive'
        }
      ]
    )
  }

  return (
    <ScreenTemplate>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          {/* 头部标题 */}
          <View style={styles.headerContainer}>
            <Text style={[styles.title, { color: colorScheme.text }]}>
              💬 文字对话
            </Text>
            <Text style={[styles.subtitle, { color: colorScheme.text }]}>
              与嘎巴龙进行文字交流
            </Text>
          </View>

          {/* 数字人区域 */}
          <View style={styles.avatarContainer}>
            <DigitalAvatar 
              style={styles.avatar}
              videoStyle={styles.avatarVideo}
              onMessage={handleMessage}
              enableInteraction={chatStarted}
            />
            <Text style={[styles.avatarStatus, { color: colorScheme.text }]}>
              {!chatStarted ? '😊 点击纸团开始对话' :
               isTyping ? '💭 正在思考...' : '😊 准备聊天'}
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
                点击纸团开始文字对话 ✨
              </Text>
            </View>
          ) : (
            <>
              {/* 对话区域 */}
              <View style={[styles.chatContainer, { backgroundColor: colorScheme.cardBackground }]}>
                <View style={styles.chatHeader}>
                  <Text style={[styles.chatTitle, { color: colorScheme.text }]}>对话记录</Text>
                  {messages.length > 0 && (
                    <TouchableOpacity onPress={clearMessages}>
                      <Text style={styles.clearButton}>🗑️ 清空</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                <ScrollView 
                  ref={scrollViewRef}
                  style={styles.messagesContainer}
                  showsVerticalScrollIndicator={false}
                >
                  {messages.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colorScheme.text }]}>
                      在下方输入框开始和嘎巴龙聊天吧！✨
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
                        {msg.timestamp && (
                          <Text style={[
                            styles.messageTime,
                            { color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }
                          ]}>
                            {msg.timestamp}
                          </Text>
                        )}
                      </View>
                    ))
                  )}
                  {isTyping && (
                    <View style={[styles.messageItem, styles.assistantMessage]}>
                      <Text style={[styles.messageText, { color: colorScheme.text }]}>
                        🐉 嘎巴龙正在输入...
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>

              {/* 输入区域 */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.textInput, {
                    backgroundColor: colorScheme.inputBackground,
                    color: colorScheme.text,
                    borderColor: isDark ? '#555' : '#ddd'
                  }]}
                  placeholder="输入消息..."
                  placeholderTextColor={isDark ? '#999' : '#666'}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline={true}
                  maxLength={500}
                  editable={!isTyping}
                />
                <Button
                  label={isTyping ? '...' : '发送'}
                  color={colors.tertiary}
                  onPress={handleSendText}
                  style={styles.sendButton}
                  disable={isTyping || inputText.trim().length === 0}
                />
              </View>
            </>
          )}

<<<<<<< HEAD
          {/* 测试按钮 */}
          <TouchableOpacity 
            style={styles.testButton}
            onPress={() => setShowConfigTester(true)}
          >
            <Text style={styles.testButtonText}>🧪 测试文字服务</Text>
          </TouchableOpacity>

          {/* 配置测试器 */}
          {showConfigTester && (
            <ConfigTester onClose={() => setShowConfigTester(false)} />
          )}
=======
>>>>>>> 813-llm
        </View>
      </KeyboardAvoidingView>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: fontSize.xLarge,
    fontWeight: 'bold',
    marginBottom: 5,
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
    paddingVertical: 15,
    marginBottom: 20,
  },
  avatar: {
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  avatarVideo: {
    width: 120,
    height: 160,
    borderRadius: 12,
  },
  avatarStatus: {
    fontSize: fontSize.small,
    textAlign: 'center',
    fontWeight: '500',
  },
  chatContainer: {
    flex: 1,
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  chatTitle: {
    fontSize: fontSize.large,
    fontWeight: 'bold',
  },
  clearButton: {
    color: '#ff4757',
    fontSize: fontSize.small,
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: fontSize.middle,
    opacity: 0.6,
    fontStyle: 'italic',
    paddingVertical: 40,
  },
  messageItem: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    maxWidth: '85%',
  },
  userMessage: {
    backgroundColor: colors.tertiary,
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: fontSize.small,
    lineHeight: 18,
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 10,
    opacity: 0.7,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    fontSize: fontSize.middle,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    minWidth: 60,
    paddingVertical: 8,
  },
<<<<<<< HEAD
  testButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderColor: '#007AFF',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 25,
    paddingVertical: 8,
    alignSelf: 'center',
    marginTop: 5,
  },
  testButtonText: {
    color: '#007AFF',
    fontSize: fontSize.small,
    textAlign: 'center',
    fontWeight: '500',
  },
=======
>>>>>>> 813-llm
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