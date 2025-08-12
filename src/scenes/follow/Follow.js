import React, { useEffect, useContext, useState } from 'react'
import { Text, View, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native'
import ScreenTemplate from '../../components/ScreenTemplate'
import Button from '../../components/Button'
import DigitalAvatar from '../../components/DigitalAvatar'
import ConfigTester from '../../components/ConfigTester'
import digitalHumanService from '../../services/DigitalHumanService'
import { colors, fontSize } from 'theme'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'
import { UserDataContext } from '../../context/UserDataContext'
import { useNavigation } from '@react-navigation/native'

export default function Follow() {
  const navigation = useNavigation()
  const { userData } = useContext(UserDataContext)
  const { scheme } = useContext(ColorSchemeContext)
  const isDark = scheme === 'dark'
  const colorScheme = {
    text: isDark? colors.white : colors.primaryText,
    background: isDark? colors.black : colors.white,
    inputBackground: isDark? '#333' : '#f5f5f5'
  }

  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [showConfigTester, setShowConfigTester] = useState(false)

  useEffect(() => {
    console.log('Follow screen - Connect with Gabalong')
  }, [])

  const handleMessage = (message) => {
    setMessages(prev => [...prev, message])
  }

  const handleSendText = async () => {
    if (inputText.trim().length === 0) return
    
    const userMessage = inputText.trim()
    setInputText('')
    
    // 发送文本消息
    const result = await digitalHumanService.sendTextMessage(userMessage)
    if (!result.success) {
      console.error('发送消息失败:', result.error)
    }
  }

  return (
    <ScreenTemplate>
      <View style={[styles.container]}>
        {/* 数字人头部区域 */}
        <View style={styles.avatarContainer}>
          {/* 背景装饰 */}
          <View style={[styles.backgroundDecoration, {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'
          }]} />
          
          <DigitalAvatar 
            style={styles.avatar}
            videoStyle={styles.avatarVideo}
            onMessage={handleMessage}
            enableInteraction={true}
          />
          <Text style={[styles.welcomeText, {color: colorScheme.text}]}>
            你好！我是嘎巴龙 🐉
          </Text>
          <Text style={[styles.avatarName, {color: colorScheme.text}]}>
            点击我开始语音对话，或在下方输入文字
          </Text>
          
          {/* 测试按钮 */}
          <TouchableOpacity 
            style={styles.testButton}
            onPress={() => setShowConfigTester(true)}
          >
            <Text style={styles.testButtonText}>🧪 测试服务连接</Text>
          </TouchableOpacity>
        </View>
        
        {/* 对话历史区域 */}
        <View style={styles.chatContainer}>
          <ScrollView 
            style={[styles.messagesContainer, {backgroundColor: colorScheme.inputBackground}]}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <Text style={[styles.emptyText, {color: colorScheme.text}]}>
                开始和嘎巴龙聊天吧！✨
              </Text>
            ) : (
              messages.map((msg, index) => (
                <View key={index} style={[
                  styles.messageItem,
                  msg.role === 'user' ? styles.userMessage : styles.assistantMessage
                ]}>
                  <Text style={[
                    styles.messageText,
                    {color: msg.role === 'user' ? colors.white : colorScheme.text}
                  ]}>
                    {msg.role === 'user' ? '我：' : '嘎巴龙：'}{msg.message}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
        
        {/* 文本输入区域 */}
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.textInput, {
              backgroundColor: colorScheme.inputBackground,
              color: colorScheme.text
            }]}
            placeholder="输入消息..."
            placeholderTextColor={isDark ? '#999' : '#666'}
            value={inputText}
            onChangeText={setInputText}
            multiline={true}
            maxLength={500}
          />
          <Button
            label='发送'
            color={colors.tertiary}
            onPress={handleSendText}
            style={styles.sendButton}
          />
        </View>
        
        {/* 配置测试器 */}
        {showConfigTester && (
          <ConfigTester onClose={() => setShowConfigTester(false)} />
        )}
      </View>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width:'100%',
    paddingVertical: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    position: 'relative',
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
    width: 200,
    height: 280,
    borderRadius: 15,
  },
  welcomeText: {
    fontSize: fontSize.large,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },
  avatarName: {
    fontSize: fontSize.small,
    textAlign: 'center',
    marginBottom: 15,
    opacity: 0.8,
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  messagesContainer: {
    flex: 1,
    borderRadius: 10,
    padding: 15,
    maxHeight: 200,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: fontSize.middle,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  messageItem: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
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
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    fontSize: fontSize.middle,
    maxHeight: 100,
  },
  sendButton: {
    minWidth: 60,
  },
  backgroundDecoration: {
    position: 'absolute',
    width: 280,
    height: 360,
    borderRadius: 30,
    zIndex: -1,
    opacity: 0.3,
  },
  testButton: {
    marginTop: 15,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderColor: '#007AFF',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  testButtonText: {
    color: '#007AFF',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
})