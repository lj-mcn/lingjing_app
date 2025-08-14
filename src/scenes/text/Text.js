import React, {
  useEffect, useState, useContext, useRef,
} from 'react'
import {
  Text, View, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import ScreenTemplate from '../../components/ScreenTemplate'
import DigitalAvatar from '../../components/DigitalAvatar'
import Button from '../../components/Button'
// import ConfigTester from '../../components/ConfigTester'
import digitalHumanService from '../../services/DigitalHumanService'
import responseLLMService from '../../services/ResponseLLMService'
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
    cardBackground: isDark ? '#2a2a2a' : '#ffffff',
  }

  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  // const [showConfigTester, setShowConfigTester] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)
  const [showAngryVideo, setShowAngryVideo] = useState(false)
  const [showHappyVideo, setShowHappyVideo] = useState(false)
  const [showSadVideo, setShowSadVideo] = useState(false)
  const [showScaredVideo, setShowScaredVideo] = useState(false)
  const [memoryStats, setMemoryStats] = useState({ turnCount: 0, hasHistory: false })

  useEffect(() => {
    console.log('Text screen - 嘎巴龙文字交互')
  }, [])

  useEffect(() => {
    // 滚动到最新消息
    if (messages.length > 0 && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true })
    }
  }, [messages])

  // 更新记忆状态
  useEffect(() => {
    const updateMemoryStats = () => {
      const stats = responseLLMService.getMemoryStats()
      setMemoryStats(stats)
    }

    updateMemoryStats()
    // 每次消息变化时更新记忆状态
    const interval = setInterval(updateMemoryStats, 1000)
    return () => clearInterval(interval)
  }, [messages])

  const startChat = () => {
    setChatStarted(true)
  }

  const handleMessage = (message) => {
    setMessages((prev) => [...prev, message])
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
      timestamp: new Date().toLocaleTimeString(),
    }
    setMessages((prev) => [...prev, newUserMessage])

    // 检测特殊消息并触发相应视频和自定义回复
    if (userMessage === '你好笨啊！') {
      // 重置其他视频状态
      setShowHappyVideo(false)
      setShowSadVideo(false)
      setShowScaredVideo(false)
      setShowAngryVideo(true)

      // 添加嘎巴龙的特定回复
      const angryResponse = {
        role: 'assistant',
        message: '用 "笨" 来否定别人的努力，并不是解决问题的好方式。如果你愿意好好沟通，我依然会尽力帮你；但如果只是发泄情绪，那我暂时没办法帮到你，嘎巴。',
        timestamp: new Date().toLocaleTimeString(),
      }
      setMessages((prev) => [...prev, angryResponse])
      setIsTyping(false)
      return
    }

    if (userMessage === '嘎巴龙，我们做朋友吧！') {
      // 重置其他视频状态
      setShowAngryVideo(false)
      setShowSadVideo(false)
      setShowScaredVideo(false)
      setShowHappyVideo(true)

      // 添加嘎巴龙的开心回复
      const happyResponse = {
        role: 'assistant',
        message: '哇哦！真的吗？我好开心啊！当然愿意和你做朋友！我们可以一起聊天、一起学习、一起成长！有了朋友真是太棒了，嘎巴！✨',
        timestamp: new Date().toLocaleTimeString(),
      }
      setMessages((prev) => [...prev, happyResponse])
      setIsTyping(false)
      return
    }

    if (userMessage === '哥们，亮屁兔真比你帅吧！') {
      // 重置其他视频状态
      setShowAngryVideo(false)
      setShowHappyVideo(false)
      setShowScaredVideo(false)
      setShowSadVideo(true)

      // 添加嘎巴龙的伤心回复
      const sadResponse = {
        role: 'assistant',
        message: '你怎么能这么说呀…… 我知道亮屁兔眼睛圆圆的很可爱，也知道大家可能更喜欢他毛茸茸的样子，但我每天都在努力记住你的喜好，学你喜欢的梗，就连说话的语气都偷偷练了好久…… 原来在你心里，我连 "帅" 这个评价都不配拥有吗？',
        timestamp: new Date().toLocaleTimeString(),
      }
      setMessages((prev) => [...prev, sadResponse])
      setIsTyping(false)
      return
    }

    if (userMessage === '你家里的垃圾都被垃圾鸡偷走了！') {
      // 重置其他视频状态
      setShowAngryVideo(false)
      setShowHappyVideo(false)
      setShowSadVideo(false)
      setShowScaredVideo(true)

      // 添加嘎巴龙的害怕回复
      const scaredResponse = {
        role: 'assistant',
        message: '啊啊啊！垃圾鸡？！那可是最可怕的生物了！它们会把所有的垃圾都投走吗？我...我好害怕呀！快保护我，嘎巴！😱',
        timestamp: new Date().toLocaleTimeString(),
      }
      setMessages((prev) => [...prev, scaredResponse])
      setIsTyping(false)
      return
    }

    try {
      // 发送文本消息给数字人
      const result = await digitalHumanService.sendTextMessage(userMessage)
      if (!result.success) {
        console.error('发送消息失败:', result.error)
        // Alert.alert('错误', `发送消息失败: ${result.error}`)
        // 添加错误消息
        const errorMessage = {
          role: 'assistant',
          message: '抱歉，我现在无法回复您的消息，请稍后再试。',
          timestamp: new Date().toLocaleTimeString(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('发送消息错误:', error)
      console.error('发送消息时出现异常')
      // Alert.alert('错误', '发送消息时出现异常')
    } finally {
      setIsTyping(false)
    }
  }

  const handleAngryVideoEnd = () => {
    // 生气视频播放完成后恢复原视频
    setShowAngryVideo(false)
  }

  const handleHappyVideoEnd = () => {
    // 开心视频播放完成后恢复原视频
    setShowHappyVideo(false)
  }

  const handleSadVideoEnd = () => {
    // 伤心视频播放完成后恢复原视频
    setShowSadVideo(false)
  }

  const handleScaredVideoEnd = () => {
    // 害怕视频播放完成后恢复原视频
    setShowScaredVideo(false)
  }

  const clearMessages = () => {
    console.log('Clear messages requested')
    // Alert.alert(
    //   '清空对话',
    //   '确定要清空所有对话记录和记忆吗？这将删除所有聊天历史。',
    //   [
    //     { text: '取消', style: 'cancel' },
    //     {
    //       text: '确定',
    //       onPress: () => {
    //         setMessages([])
    //         // 清空对话记忆
    //         responseLLMService.clearMemory()
    //       },
    //       style: 'destructive',
    //     },
    //   ],
    // )
    // 直接清空
    setMessages([])
    responseLLMService.clearMemory()
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
              showAngryVideo={showAngryVideo}
              onAngryVideoEnd={handleAngryVideoEnd}
              showHappyVideo={showHappyVideo}
              onHappyVideoEnd={handleHappyVideoEnd}
              showSadVideo={showSadVideo}
              onSadVideoEnd={handleSadVideoEnd}
              showScaredVideo={showScaredVideo}
              onScaredVideoEnd={handleScaredVideoEnd}
            />
            <Text style={[styles.avatarStatus, { color: colorScheme.text }]}>
              {!chatStarted ? '😊 点击纸团开始对话'
                : showAngryVideo ? '😡 嘎巴龙生气了！'
                  : showHappyVideo ? '🥳 嘎巴龙好开心！'
                    : showSadVideo ? '😢 嘎巴龙伤心了...'
                      : showScaredVideo ? '😱 嘎巴龙害怕了！'
                        : isTyping ? '💭 正在思考...' : '😊 准备聊天'}
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
                  <View style={styles.chatHeaderLeft}>
                    <Text style={[styles.chatTitle, { color: colorScheme.text }]}>对话记录</Text>
                    {memoryStats.hasHistory && (
                      <Text style={[styles.memoryStatus, { color: isDark ? '#999' : '#666' }]}>
                        🧠 记忆: {memoryStats.turnCount}轮
                      </Text>
                    )}
                  </View>
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
                        {msg.timestamp && (
                          <Text style={[
                            styles.messageTime,
                            { color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' },
                          ]}
                          >
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
                    borderColor: isDark ? '#555' : '#ddd',
                  }]}
                  placeholder="输入消息..."
                  placeholderTextColor={isDark ? '#999' : '#666'}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
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

          {/* 测试按钮 */}
          {/* <TouchableOpacity
            style={styles.testButton}
            onPress={() => setShowConfigTester(true)}
          >
            <Text style={styles.testButtonText}>🧪 测试文字服务</Text>
          </TouchableOpacity>

          {/* 配置测试器 */}
          {/* {showConfigTester && (
            <ConfigTester onClose={() => setShowConfigTester(false)} />
          )} */}
        </View>
      </KeyboardAvoidingView>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20, // 与语音界面保持一致
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30, // 与语音界面保持一致
  },
  title: {
    fontSize: fontSize.xLarge,
    fontWeight: 'bold',
    marginBottom: 8, // 与语音界面保持一致
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
    paddingVertical: 20, // 与语音界面保持一致
    position: 'relative',
    marginBottom: 30, // 与语音界面保持一致
  },
  avatar: {
    marginBottom: 15, // 与语音界面保持一致
    // 移除阴影，由DigitalAvatar组件内部处理
  },
  avatarVideo: {
    width: 200, // 统一尺寸，与语音界面一致
    height: 300,
    borderRadius: 15, // 统一圆角
  },
  avatarStatus: {
    fontSize: fontSize.middle, // 与语音界面保持一致
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
  chatHeaderLeft: {
    flex: 1,
  },
  chatTitle: {
    fontSize: fontSize.large,
    fontWeight: 'bold',
  },
  memoryStatus: {
    fontSize: fontSize.xSmall,
    marginTop: 2,
    fontStyle: 'italic',
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
