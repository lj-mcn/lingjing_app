import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { Header } from '@rneui/themed'
import VoiceChat from '../../components/VoiceChat'

const VoiceChatScreen = ({ navigation }) => {
  const [websocketUrl, setWebsocketUrl] = useState('ws://192.168.1.100:8080')

  const handleBack = () => {
    Alert.alert(
      '退出语音聊天',
      '确定要退出语音聊天吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: () => navigation.goBack(),
          style: 'destructive',
        },
      ],
    )
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <Header
          centerComponent={{
            text: 'CosyVoice 语音聊天',
            style: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
          }}
          leftComponent={{
            icon: 'arrow-back',
            color: '#fff',
            onPress: handleBack,
          }}
          rightComponent={{
            icon: 'help-outline',
            color: '#fff',
            onPress: () => {
              Alert.alert(
                '使用说明',
                '1. 首先连接到 WebSocket 服务器\n'
                + '2. 选择 TTS 模式和说话人\n'
                + '3. 点击录音按钮开始录音\n'
                + '4. 再次点击停止录音并发送\n'
                + '5. 等待 AI 处理并播放回复\n\n'
                + '注意：请确保服务器地址正确',
              )
            },
          }}
          backgroundColor="#007AFF"
        />

        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* WebSocket URL 配置 */}
          <View style={styles.urlConfig}>
            <Text style={styles.urlLabel}>WebSocket 服务器地址:</Text>
            <TextInput
              style={styles.urlInput}
              value={websocketUrl}
              onChangeText={setWebsocketUrl}
              placeholder="ws://your-server:8080"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.urlHint}>
              本地测试: ws://192.168.1.x:8080{'\n'}
              Firebase: wss://your-project.cloudfunctions.net/websocketService
            </Text>
          </View>

          <VoiceChat websocketUrl={websocketUrl} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  urlConfig: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  urlLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  urlInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fafafa',
    marginBottom: 8,
  },
  urlHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
})

export default VoiceChatScreen
