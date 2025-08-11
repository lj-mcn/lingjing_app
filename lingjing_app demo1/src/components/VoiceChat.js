import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system'
import Icon from 'react-native-vector-icons/MaterialIcons'
import { Button } from '@rneui/themed'

const VoiceChat = ({ websocketUrl = 'ws://localhost:8080' }) => {
  // WebSocket 状态
  const [wsConnected, setWsConnected] = useState(false)
  const [wsStatus, setWsStatus] = useState('未连接')
  const ws = useRef(null)

  // 录音状态
  const [recording, setRecording] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingUri, setRecordingUri] = useState(null)

  // 处理状态
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentStep, setCurrentStep] = useState('')

  // 消息历史
  const [messages, setMessages] = useState([])

  // TTS 选项
  const [ttsOptions, setTtsOptions] = useState({
    mode: 'sft',
    spkId: '中文女',
  })

  // 音频播放
  const [sound, setSound] = useState(null)

  useEffect(() => {
    setupAudio()
    return () => {
      if (sound) {
        sound.unloadAsync()
      }
    }
  }, [sound])

  useEffect(() => () => {
    if (ws.current) {
      ws.current.close()
    }
  }, [])

  const setupAudio = async () => {
    try {
      await Audio.requestPermissionsAsync()
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })
    } catch (error) {
      console.error('音频权限设置失败:', error)
      Alert.alert('错误', '无法获取音频权限')
    }
  }

  const connectWebSocket = () => {
    try {
      addMessage('正在连接 WebSocket...', 'system')
      setWsStatus('连接中...')

      ws.current = new WebSocket(websocketUrl)

      ws.current.onopen = () => {
        console.log('WebSocket 连接成功')
        setWsConnected(true)
        setWsStatus('已连接')
        addMessage('WebSocket 连接成功', 'system')
      }

      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleWebSocketMessage(data)
      }

      ws.current.onclose = () => {
        console.log('WebSocket 连接关闭')
        setWsConnected(false)
        setWsStatus('连接关闭')
        addMessage('WebSocket 连接关闭', 'system')
      }

      ws.current.onerror = (error) => {
        console.error('WebSocket 错误:', error)
        setWsConnected(false)
        setWsStatus('连接错误')
        addMessage('WebSocket 连接错误', 'error')
      }
    } catch (error) {
      console.error('WebSocket 连接失败:', error)
      Alert.alert('连接失败', error.message)
    }
  }

  const disconnectWebSocket = () => {
    if (ws.current) {
      ws.current.close()
      ws.current = null
    }
  }

  const handleWebSocketMessage = (data) => {
    console.log('收到 WebSocket 消息:', data)

    switch (data.type) {
      case 'connected':
        addMessage(data.message, 'system')
        break
      case 'status':
        setCurrentStep(data.status)
        if (data.status === 'processing_tts_cosyvoice') {
          addMessage(`正在使用 CosyVoice 生成语音 (${data.ttsMode})`, 'status')
        } else {
          addMessage(`处理状态: ${data.status}`, 'status')
        }
        break
      case 'stt_result':
        addMessage(`👤 您说: ${data.transcript}`, 'user')
        break
      case 'llm_result':
        addMessage(`🤖 AI 回复: ${data.response}`, 'assistant')
        break
      case 'voice_response':
        setIsProcessing(false)
        setCurrentStep('')
        addMessage(`🎵 语音生成完成 (${data.ttsMode})`, 'system')
        if (data.audioUrl) {
          playAudio(data.audioUrl)
        }
        break
      case 'processing_error':
        setIsProcessing(false)
        setCurrentStep('')
        addMessage(`❌ 处理错误: ${data.error}`, 'error')
        break
      default:
        console.log('未处理的消息类型:', data.type)
    }
  }

  const addMessage = (content, type = 'info') => {
    const message = {
      id: Date.now(),
      content,
      type,
      timestamp: new Date().toLocaleTimeString(),
    }
    setMessages((prev) => [message, ...prev])
  }

  const startRecording = async () => {
    try {
      console.log('开始录音')
      setIsRecording(true)

      const { recording: newRecording } = await Audio.Recording.createAsync({
        isMeteringEnabled: true,
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 22050,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 22050,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 128000,
        },
      })

      setRecording(newRecording)
      addMessage('🎤 开始录音...', 'system')
    } catch (error) {
      console.error('录音启动失败:', error)
      Alert.alert('录音失败', error.message)
      setIsRecording(false)
    }
  }

  const stopRecording = async () => {
    if (!recording) return

    try {
      console.log('停止录音')
      setIsRecording(false)
      addMessage('⏹ 停止录音', 'system')

      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      setRecordingUri(uri)
      setRecording(null)

      console.log('录音保存到:', uri)

      // 自动发送录音
      if (wsConnected && uri) {
        sendAudioToWebSocket(uri)
      }
    } catch (error) {
      console.error('停止录音失败:', error)
      Alert.alert('停止录音失败', error.message)
    }
  }

  const sendAudioToWebSocket = async (audioUri) => {
    if (!ws.current || !wsConnected) {
      Alert.alert('错误', 'WebSocket 未连接')
      return
    }

    try {
      setIsProcessing(true)
      addMessage('📤 发送音频数据...', 'system')

      // 读取音频文件并转换为 base64
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      const message = {
        type: 'voice_input',
        audio: audioBase64,
        sessionId: `expo-session-${Date.now()}`,
        ttsOptions,
      }

      ws.current.send(JSON.stringify(message))
      addMessage('音频已发送，等待处理...', 'system')
    } catch (error) {
      console.error('发送音频失败:', error)
      Alert.alert('发送失败', error.message)
      setIsProcessing(false)
    }
  }

  const playAudio = async (audioUrl) => {
    try {
      console.log('播放音频:', audioUrl)
      addMessage('🔊 播放语音回复...', 'system')

      if (sound) {
        await sound.unloadAsync()
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
      )

      setSound(newSound)

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          addMessage('✅ 语音播放完成', 'system')
        }
      })
    } catch (error) {
      console.error('音频播放失败:', error)
      addMessage(`❌ 音频播放失败: ${error.message}`, 'error')
    }
  }

  const changeTTSMode = (mode) => {
    setTtsOptions((prev) => ({ ...prev, mode }))
    addMessage(`TTS 模式已切换到: ${mode}`, 'system')
  }

  const changeSpkId = (spkId) => {
    setTtsOptions((prev) => ({ ...prev, spkId }))
    addMessage(`说话人已切换到: ${spkId}`, 'system')
  }

  const getMessageStyle = (type) => {
    switch (type) {
      case 'user':
        return [styles.message, styles.userMessage]
      case 'assistant':
        return [styles.message, styles.assistantMessage]
      case 'system':
        return [styles.message, styles.systemMessage]
      case 'status':
        return [styles.message, styles.statusMessage]
      case 'error':
        return [styles.message, styles.errorMessage]
      default:
        return [styles.message]
    }
  }

  return (
    <View style={styles.container}>
      {/* WebSocket 状态栏 */}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <Icon
            name="wifi"
            size={20}
            color={wsConnected ? 'green' : 'red'}
          />
          <Text style={styles.statusText}>{wsStatus}</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusText}>TTS: {ttsOptions.mode}</Text>
          <Text style={styles.statusText}>说话人: {ttsOptions.spkId}</Text>
        </View>
      </View>

      {/* TTS 模式选择 */}
      <View style={styles.ttsControls}>
        <Text style={styles.sectionTitle}>TTS 模式:</Text>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              ttsOptions.mode === 'sft' && styles.activeMode,
            ]}
            onPress={() => changeTTSMode('sft')}
          >
            <Text style={styles.modeButtonText}>SFT</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              ttsOptions.mode === 'instruct' && styles.activeMode,
            ]}
            onPress={() => changeTTSMode('instruct')}
          >
            <Text style={styles.modeButtonText}>指令</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 说话人选择 */}
      <View style={styles.ttsControls}>
        <Text style={styles.sectionTitle}>说话人:</Text>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              ttsOptions.spkId === '中文女' && styles.activeMode,
            ]}
            onPress={() => changeSpkId('中文女')}
          >
            <Text style={styles.modeButtonText}>中文女</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              ttsOptions.spkId === '中文男' && styles.activeMode,
            ]}
            onPress={() => changeSpkId('中文男')}
          >
            <Text style={styles.modeButtonText}>中文男</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 连接控制 */}
      <View style={styles.controls}>
        <Button
          title={wsConnected ? '断开连接' : '连接服务器'}
          onPress={wsConnected ? disconnectWebSocket : connectWebSocket}
          buttonStyle={[
            styles.controlButton,
            wsConnected ? styles.disconnectButton : styles.connectButton,
          ]}
        />
      </View>

      {/* 录音控制 */}
      <View style={styles.recordControls}>
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordingButton,
            (!wsConnected || isProcessing) && styles.disabledButton,
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={!wsConnected || isProcessing}
        >
          <Icon
            name={isRecording ? 'stop' : 'mic'}
            size={30}
            color="white"
          />
        </TouchableOpacity>
        <Text style={styles.recordText}>
          {isRecording ? '点击停止录音' : '点击开始录音'}
        </Text>
      </View>

      {/* 处理状态 */}
      {isProcessing && (
        <View style={styles.processingStatus}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.processingText}>
            {currentStep || '处理中...'}
          </Text>
        </View>
      )}

      {/* 消息历史 */}
      <ScrollView style={styles.messagesContainer}>
        {messages.map((message) => (
          <View key={message.id} style={getMessageStyle(message.type)}>
            <Text style={styles.messageTime}>{message.timestamp}</Text>
            <Text style={styles.messageText}>{message.content}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 16,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  ttsControls: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
  },
  activeMode: {
    backgroundColor: '#007AFF',
  },
  modeButtonText: {
    fontSize: 14,
    color: 'black',
  },
  controls: {
    marginBottom: 16,
  },
  controlButton: {
    borderRadius: 8,
    paddingVertical: 12,
  },
  connectButton: {
    backgroundColor: '#4CAF50',
  },
  disconnectButton: {
    backgroundColor: '#f44336',
  },
  recordControls: {
    alignItems: 'center',
    marginBottom: 16,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingButton: {
    backgroundColor: '#ff4444',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  recordText: {
    fontSize: 14,
    color: '#666',
  },
  processingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  processingText: {
    fontSize: 14,
    color: '#007AFF',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
  },
  message: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  userMessage: {
    backgroundColor: '#E3F2FD',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: '#F3E5F5',
    alignSelf: 'flex-start',
  },
  systemMessage: {
    backgroundColor: '#E8F5E8',
  },
  statusMessage: {
    backgroundColor: '#FFF3E0',
  },
  errorMessage: {
    backgroundColor: '#FFEBEE',
  },
  messageTime: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
  },
})

export default VoiceChat
