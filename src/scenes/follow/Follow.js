import React, { useEffect, useContext, useState } from 'react'
import {
  Text, View, StyleSheet, ScrollView, TextInput, TouchableOpacity,
} from 'react-native'
import { colors, fontSize } from 'theme'
import { useNavigation } from '@react-navigation/native'
import ScreenTemplate from '../../components/ScreenTemplate'
import Button from '../../components/Button'
import DigitalAvatar from '../../components/DigitalAvatar'
import digitalHumanService from '../../services/DigitalHumanService'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'
import { UserDataContext } from '../../context/UserDataContext'

export default function Follow() {
  const navigation = useNavigation()
  const { userData } = useContext(UserDataContext)
  const { scheme } = useContext(ColorSchemeContext)
  const isDark = scheme === 'dark'
  const colorScheme = {
    text: isDark ? colors.white : colors.primaryText,
    background: isDark ? colors.black : colors.white,
    inputBackground: isDark ? '#333' : '#f5f5f5',
  }

  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')

  useEffect(() => {
    console.log('Follow screen - 关注列表')
  }, [])

  const handleMessage = (message) => {
    setMessages((prev) => [...prev, message])
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
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
          }]}
          />

          <DigitalAvatar
            style={styles.avatar}
            videoStyle={styles.avatarVideo}
            onMessage={handleMessage}
            enableInteraction
          />
          <Text style={[styles.welcomeText, { color: colorScheme.text }]}>
            你好！我是嘎巴龙 🐉
          </Text>
          <Text style={[styles.avatarName, { color: colorScheme.text }]}>
            点击我开始语音对话，或在下方输入文字
          </Text>

        </View>

        {/* 对话历史区域 */}
        <View style={styles.chatContainer}>
          <ScrollView
            style={[styles.messagesContainer, { backgroundColor: colorScheme.inputBackground }]}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <Text style={[styles.emptyText, { color: colorScheme.text }]}>
                开始和嘎巴龙聊天吧！✨
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
              color: colorScheme.text,
            }]}
            placeholder="输入消息..."
            placeholderTextColor={isDark ? '#999' : '#666'}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <Button
            label="发送"
            color={colors.tertiary}
            onPress={handleSendText}
            style={styles.sendButton}
          />
        </View>
      </View>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    paddingVertical: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
    position: 'relative',
  },
  avatar: {
    width: 200,
    height: 260,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  avatarVideo: {
    width: '100%',
    height: '100%',
  },
  welcomeText: {
    fontSize: fontSize.large,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  avatarName: {
    fontSize: fontSize.middle,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 20,
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messagesContainer: {
    flex: 1,
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    maxHeight: 300,
  },
  emptyText: {
    fontSize: fontSize.middle,
    textAlign: 'center',
    opacity: 0.7,
    fontStyle: 'italic',
    marginTop: 20,
  },
  messageItem: {
    marginVertical: 5,
    padding: 10,
    borderRadius: 10,
    maxWidth: '85%',
  },
  userMessage: {
    backgroundColor: colors.tertiary,
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: 'rgba(100, 100, 100, 0.1)',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: fontSize.small,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'flex-end',
    gap: 10,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: fontSize.small,
    minHeight: 45,
    maxHeight: 120,
  },
  sendButton: {
    minWidth: 70,
    paddingVertical: 12,
  },
  backgroundDecoration: {
    position: 'absolute',
    width: 280,
    height: 360,
    borderRadius: 30,
    zIndex: -1,
    opacity: 0.3,
  },
})
