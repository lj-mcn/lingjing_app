import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import digitalHumanService from '../services/DigitalHumanService';
import llmConfig from '../config/llmConfig';

export default function LLMTester() {
  const [status, setStatus] = useState('未初始化');
  const [isInitialized, setIsInitialized] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  const testInitialization = async () => {
    try {
      setStatus('正在初始化...');
      addLog('🚀 开始测试初始化');

      // 验证配置
      addLog('📋 验证配置...');
      const configValidation = llmConfig.validateConfig();
      addLog(`📋 配置验证: ${configValidation.isValid ? '✅ 成功' : '❌ 失败'}`);
      
      if (!configValidation.isValid) {
        addLog(`❌ 配置错误: ${configValidation.errors.join(', ')}`);
        setStatus('配置错误');
        return;
      }

      if (configValidation.warnings && configValidation.warnings.length > 0) {
        configValidation.warnings.forEach(warning => {
          addLog(`⚠️ 警告: ${warning}`);
        });
      }

      // 准备配置
      addLog('⚙️ 准备初始化配置...');
      const config = {
        llm: {
          websocketUrl: llmConfig.responseLLM.websocketUrl,
          timeout: llmConfig.responseLLM.timeout,
          maxTokens: llmConfig.responseLLM.maxTokens,
          model: llmConfig.responseLLM.model
        },
        sttTts: {
          useSimulation: true
        }
      };

      addLog(`🌐 LLM服务器地址: ${config.llm.websocketUrl}`);
      addLog(`⏱️ 超时设置: ${config.llm.timeout}ms`);
      addLog(`🤖 使用模型: ${config.llm.model}`);
      addLog('🔧 调用digitalHumanService.initialize...');

      // 设置回调监听初始化过程
      digitalHumanService.setCallbacks({
        onStatusChange: (newStatus) => {
          addLog(`📊 状态变化: ${newStatus}`);
        },
        onError: (error) => {
          addLog(`❌ 服务错误: ${error}`);
        },
        onMessage: (message) => {
          addLog(`💬 消息: [${message.role}] ${message.message}`);
        }
      });

      // 初始化服务
      const initialized = await digitalHumanService.initialize(config);
      
      if (initialized) {
        addLog('✅ 数字人服务初始化成功!');
        
        // 检查各个组件状态
        const status = digitalHumanService.getStatus();
        addLog(`📊 服务状态: 连接=${status.isConnected}, WebSocket=${status.wsConnected}`);
        
        setStatus('初始化成功');
        setIsInitialized(true);
      } else {
        addLog('❌ 数字人服务初始化失败');
        setStatus('初始化失败');
      }

    } catch (error) {
      addLog(`❌ 初始化异常: ${error.message}`);
      addLog(`📍 错误堆栈: ${error.stack}`);
      setStatus('初始化异常');
      console.error('初始化异常:', error);
    }
  };

  const testMessage = async () => {
    if (!isInitialized) {
      addLog('❌ 服务未初始化，无法发送消息');
      Alert.alert('错误', '请先初始化服务');
      return;
    }

    try {
      const testMessages = [
        '你好',
        '你叫什么名字？',
        '今天天气怎么样？',
        '能讲个笑话吗？'
      ];
      
      const randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)];
      
      addLog(`💬 发送测试消息: "${randomMessage}"`);
      addLog('⏳ 等待LLM响应...');
      
      const result = await digitalHumanService.sendTextMessage(randomMessage);
      
      if (result.success) {
        addLog(`✅ 消息发送成功!`);
        addLog(`🤖 AI回复: ${result.message}`);
        
        // 检查服务状态
        const status = digitalHumanService.getStatus();
        addLog(`📊 服务状态更新: 连接=${status.isConnected}, WebSocket=${status.wsConnected}`);
      } else {
        addLog(`❌ 消息发送失败: ${result.error}`);
        
        // 提供故障排除建议
        if (result.error.includes('未连接')) {
          addLog('💡 建议: 检查同学的LLM服务器是否启动');
          addLog('💡 建议: 确认IP地址和端口号是否正确');
        } else if (result.error.includes('超时')) {
          addLog('💡 建议: 检查网络连接和服务器响应时间');
        }
      }
    } catch (error) {
      addLog(`❌ 消息发送异常: ${error.message}`);
      addLog(`📍 错误详情: ${error.stack}`);
      
      // 提供调试建议
      addLog('🔧 调试建议:');
      addLog('   1. 检查LLM服务器是否正常运行');
      addLog('   2. 确认网络连接是否正常');
      addLog('   3. 查看控制台是否有WebSocket连接错误');
    }
  };

  const testNetworkConnection = async () => {
    addLog('🌐 开始网络连接测试...');
    
    try {
      const serverUrl = llmConfig.responseLLM.websocketUrl;
      const serverIP = serverUrl.replace('ws://', '').replace('wss://', '').split(':')[0];
      const serverPort = serverUrl.split(':')[2] || '8000';
      
      addLog(`🎯 目标服务器: ${serverIP}:${serverPort}`);
      addLog('📡 测试网络连接...');
      
      // 简单的网络连通性测试
      const startTime = Date.now();
      try {
        // 模拟ping测试（实际上React Native不能直接ping）
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('连接超时'));
          }, 5000);
          
          // 尝试创建WebSocket连接来测试连通性
          const testWs = new WebSocket(serverUrl);
          
          testWs.onopen = () => {
            clearTimeout(timeout);
            testWs.close();
            resolve();
          };
          
          testWs.onerror = (error) => {
            clearTimeout(timeout);
            reject(error);
          };
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        addLog(`✅ 网络连接测试成功! 延迟: ${duration}ms`);
        addLog('💡 服务器可达，网络连接正常');
        
      } catch (networkError) {
        addLog(`❌ 网络连接测试失败: ${networkError.message}`);
        addLog('💡 可能的问题:');
        addLog('   • 同学的电脑没有启动LLM服务器');
        addLog('   • IP地址错误或网络不通');
        addLog('   • 防火墙阻止了连接');
        addLog('   • 端口号不正确');
      }
      
    } catch (error) {
      addLog(`❌ 网络测试异常: ${error.message}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LLM服务测试</Text>
      
      <Text style={styles.status}>状态: {status}</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={testNetworkConnection}>
          <Text style={styles.buttonText}>网络测试</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testInitialization}>
          <Text style={styles.buttonText}>初始化</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, !isInitialized && styles.buttonDisabled]} 
          onPress={testMessage}
          disabled={!isInitialized}
        >
          <Text style={styles.buttonText}>发送消息</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={clearLogs}>
          <Text style={styles.buttonText}>清除日志</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logsContainer}>
        <Text style={styles.logsTitle}>日志:</Text>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  status: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
    minWidth: 80,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  logsContainer: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 10,
    borderRadius: 5,
  },
  logsTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
  logText: {
    fontSize: 12,
    marginBottom: 2,
    fontFamily: 'monospace',
  },
});