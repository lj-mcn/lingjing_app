import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import llmConfig from '../config/llmConfig'
import llmService from '../services/LLMService'
import digitalHumanService from '../services/DigitalHumanService'

export default function ConfigTester({ onClose }) {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState({})

  const runConfigTest = async () => {
    setTesting(true)
    setResults({})
    
    try {
      // 1. 配置验证
      const configValidation = llmConfig.validateConfig()
      setResults(prev => ({ ...prev, config: configValidation }))
      
      if (!configValidation.isValid) {
        Alert.alert('配置错误', configValidation.errors.join('\n'))
        return
      }

      // 2. 测试LLM服务
      setResults(prev => ({ ...prev, llm: { testing: true } }))
      
      llmService.setConfig({
        apiKey: llmConfig.openai.apiKey,
        baseURL: llmConfig.openai.baseURL,
        model: llmConfig.openai.models.chat
      })

      const llmResult = await llmService.sendQuickMessage(
        '你好，请简短回复确认你收到了这条测试消息',
        llmConfig.gabalong.systemPrompt
      )

      setResults(prev => ({ 
        ...prev, 
        llm: { 
          success: llmResult.success, 
          message: llmResult.message?.substring(0, 100) + (llmResult.message?.length > 100 ? '...' : ''),
          error: llmResult.error 
        } 
      }))

      // 3. 测试数字人服务初始化
      setResults(prev => ({ ...prev, digitalHuman: { testing: true } }))
      
      const initConfig = {
        llm: {
          apiKey: llmConfig.openai.apiKey,
          baseURL: llmConfig.openai.baseURL,
          model: llmConfig.openai.models.chat
        },
        sttTts: {
          apiKey: llmConfig.openai.apiKey,
          baseURL: llmConfig.openai.baseURL,
          sttModel: llmConfig.openai.models.stt,
          ttsModel: llmConfig.openai.models.tts,
          voice: 'nova'
        }
      }

      const digitalHumanResult = await digitalHumanService.initialize(initConfig)
      setResults(prev => ({ 
        ...prev, 
        digitalHuman: { 
          success: digitalHumanResult,
          message: digitalHumanResult ? '数字人服务初始化成功' : '数字人服务初始化失败'
        } 
      }))

      if (digitalHumanResult && llmResult.success) {
        Alert.alert('测试完成', '所有服务测试通过！可以开始使用完整的语音聊天功能。')
      }

    } catch (error) {
      console.error('测试失败:', error)
      Alert.alert('测试失败', error.message)
    } finally {
      setTesting(false)
    }
  }

  const getStatusColor = (result) => {
    if (result?.testing) return '#ffaa00'
    if (result?.success === true) return '#00aa44'
    if (result?.success === false) return '#ff4444'
    return '#666666'
  }

  const getStatusText = (result) => {
    if (result?.testing) return '测试中...'
    if (result?.success === true) return '✓ 通过'
    if (result?.success === false) return '✗ 失败'
    return '等待测试'
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧪 大模型服务测试</Text>
      
      <View style={styles.configInfo}>
        <Text style={styles.configTitle}>当前配置:</Text>
        {Object.entries(llmConfig.getEnvironmentConfig()).map(([key, value]) => (
          <Text key={key} style={styles.configItem}>
            {key}: {String(value)}
          </Text>
        ))}
      </View>

      <View style={styles.testResults}>
        <Text style={styles.resultsTitle}>测试结果:</Text>
        
        <View style={styles.testItem}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(results.config) }]} />
          <Text style={styles.testLabel}>配置验证:</Text>
          <Text style={styles.testStatus}>{getStatusText(results.config)}</Text>
        </View>

        <View style={styles.testItem}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(results.llm) }]} />
          <Text style={styles.testLabel}>LLM服务:</Text>
          <Text style={styles.testStatus}>{getStatusText(results.llm)}</Text>
        </View>

        <View style={styles.testItem}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(results.digitalHuman) }]} />
          <Text style={styles.testLabel}>数字人服务:</Text>
          <Text style={styles.testStatus}>{getStatusText(results.digitalHuman)}</Text>
        </View>

        {results.llm?.message && (
          <View style={styles.responsePreview}>
            <Text style={styles.responseLabel}>AI回复预览:</Text>
            <Text style={styles.responseText}>{results.llm.message}</Text>
          </View>
        )}

        {(results.llm?.error || results.config?.errors?.length > 0) && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>错误信息:</Text>
            {results.config?.errors?.map((error, index) => (
              <Text key={index} style={styles.errorText}>{error}</Text>
            ))}
            {results.llm?.error && (
              <Text style={styles.errorText}>{results.llm.error}</Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity 
          style={[styles.button, styles.testButton]}
          onPress={runConfigTest}
          disabled={testing}
        >
          <Text style={styles.buttonText}>
            {testing ? '测试中...' : '开始测试'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.closeButton]}
          onPress={onClose}
        >
          <Text style={styles.buttonText}>关闭</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
    maxHeight: '80%',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#333',
  },
  configInfo: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  configTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  configItem: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  testResults: {
    marginBottom: 15,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  testItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  testLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  testStatus: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  responsePreview: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2d5a2d',
    marginBottom: 5,
  },
  responseText: {
    fontSize: 12,
    color: '#2d5a2d',
  },
  errorContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#ffebee',
    borderRadius: 8,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c62828',
    marginBottom: 5,
  },
  errorText: {
    fontSize: 11,
    color: '#c62828',
    marginBottom: 2,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  testButton: {
    backgroundColor: '#007AFF',
  },
  closeButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
})