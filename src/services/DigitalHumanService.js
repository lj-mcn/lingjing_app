import webSocketService from './WebSocketService';
import audioService from './AudioService';
import responseLLMService from './ResponseLLMService';
import sttTtsService from './STTTTSService';

class DigitalHumanService {
  constructor() {
    this.isConnected = false;
    this.isConversing = false;
    this.conversationCallbacks = {
      onStart: null,
      onEnd: null,
      onMessage: null,
      onError: null,
      onStatusChange: null
    };
    
    this.setupWebSocketCallbacks();
  }

  setupWebSocketCallbacks() {
    webSocketService.setOnConnect(() => {
      this.isConnected = true;
      this.notifyStatusChange('connected');
      console.log('数字人服务已连接');
    });

    webSocketService.setOnDisconnect(() => {
      this.isConnected = false;
      this.notifyStatusChange('disconnected');
      console.log('数字人服务已断开');
    });

    webSocketService.setOnError((error) => {
      this.notifyError('WebSocket连接错误: ' + error.message);
    });

    webSocketService.setOnMessage((data) => {
      this.handleWebSocketMessage(data);
    });
  }

  async initialize(config = {}) {
    try {
      console.log('开始初始化数字人服务...');
      
      // 配置各个服务
      console.log('初始化ResponseLLM服务...');
      if (config.llm) {
        const llmInitialized = await responseLLMService.initialize(config.llm);
        if (!llmInitialized) {
          console.warn('ResponseLLM服务初始化失败，但继续初始化其他服务');
        }
      } else {
        const llmInitialized = await responseLLMService.initialize();
        if (!llmInitialized) {
          console.warn('ResponseLLM服务初始化失败，但继续初始化其他服务');
        }
      }
      
      console.log('配置STT/TTS服务...');
      if (config.sttTts) {
        sttTtsService.setConfig(config.sttTts);
      }

      console.log('初始化音频服务...');
      // 音频服务初始化失败不应该阻止整个服务
      try {
        const audioInitialized = await audioService.initializeAudio();
        if (!audioInitialized) {
          console.warn('音频服务初始化失败，但继续初始化');
        }
      } catch (audioError) {
        console.warn('音频服务初始化失败:', audioError.message);
      }

      // 连接WebSocket（如果提供了URL）
      if (config.websocketUrl) {
        try {
          webSocketService.connect(config.websocketUrl);
        } catch (wsError) {
          console.warn('WebSocket连接失败:', wsError.message);
        }
      }

      console.log('数字人服务初始化完成');
      return true;
    } catch (error) {
      console.error('数字人服务初始化失败:', error);
      this.notifyError('初始化失败: ' + error.message);
      return false;
    }
  }

  async startVoiceConversation() {
    try {
      if (this.isConversing) {
        console.log('对话已在进行中');
        return false;
      }

      this.isConversing = true;
      this.notifyStatusChange('recording');
      this.notifyConversationStart();

      // 开始录音
      const recordingStarted = await audioService.startRecording();
      if (!recordingStarted) {
        throw new Error('开始录音失败');
      }

      console.log('语音对话已开始');
      return true;
    } catch (error) {
      console.error('开始语音对话失败:', error);
      this.isConversing = false;
      this.notifyError('开始对话失败: ' + error.message);
      return false;
    }
  }

  async stopVoiceConversation() {
    try {
      if (!this.isConversing) {
        console.log('没有正在进行的对话');
        return false;
      }

      this.notifyStatusChange('processing');

      // 停止录音并获取音频文件
      const audioUri = await audioService.stopRecording();
      if (!audioUri) {
        throw new Error('录音失败');
      }

      // 语音转文字
      const sttResult = await sttTtsService.intelligentSTT(audioUri);
      if (!sttResult.success) {
        throw new Error('语音识别失败: ' + sttResult.error);
      }

      console.log('用户说:', sttResult.text);
      this.notifyMessage('user', sttResult.text);

      // 发送给大模型
      const llmResult = await responseLLMService.sendMessage(sttResult.text);
      if (!llmResult.success) {
        throw new Error('大模型响应失败: ' + llmResult.error);
      }

      console.log('AI回复:', llmResult.message);
      this.notifyMessage('assistant', llmResult.message);

      // 文字转语音
      const ttsResult = await sttTtsService.intelligentTTS(llmResult.message);
      if (ttsResult.success) {
        // 播放AI回复的语音
        await audioService.playAudioFromBase64(ttsResult.audioData);
        this.notifyStatusChange('speaking');
      } else {
        console.error('语音合成失败:', ttsResult.error);
      }

      this.isConversing = false;
      this.notifyStatusChange('idle');
      this.notifyConversationEnd();
      
      return true;
    } catch (error) {
      console.error('语音对话处理失败:', error);
      this.isConversing = false;
      this.notifyStatusChange('idle');
      this.notifyError('对话处理失败: ' + error.message);
      return false;
    }
  }

  async sendTextMessage(text) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('消息内容为空');
      }

      this.notifyStatusChange('processing');
      this.notifyMessage('user', text);

      // 发送给大模型
      const llmResult = await responseLLMService.sendMessage(text);
      if (!llmResult.success) {
        throw new Error('大模型响应失败: ' + llmResult.error);
      }

      console.log('AI回复:', llmResult.message);
      this.notifyMessage('assistant', llmResult.message);

      // 如果需要语音回复
      const ttsResult = await sttTtsService.intelligentTTS(llmResult.message);
      if (ttsResult.success) {
        await audioService.playAudioFromBase64(ttsResult.audioData);
        this.notifyStatusChange('speaking');
      }

      this.notifyStatusChange('idle');
      return {
        success: true,
        message: llmResult.message
      };
    } catch (error) {
      console.error('文本消息处理失败:', error);
      this.notifyStatusChange('idle');
      this.notifyError('消息处理失败: ' + error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  handleWebSocketMessage(data) {
    try {
      switch (data.type) {
        case 'stt_result':
          this.handleSTTResult(data);
          break;
        case 'llm_response':
          this.handleLLMResponse(data);
          break;
        case 'tts_result':
          this.handleTTSResult(data);
          break;
        default:
          console.log('未知的WebSocket消息类型:', data.type);
      }
    } catch (error) {
      console.error('处理WebSocket消息失败:', error);
      this.notifyError('消息处理失败: ' + error.message);
    }
  }

  handleSTTResult(data) {
    if (data.success && data.text) {
      this.notifyMessage('user', data.text);
    } else {
      this.notifyError('语音识别失败: ' + data.error);
    }
  }

  handleLLMResponse(data) {
    if (data.success && data.message) {
      this.notifyMessage('assistant', data.message);
    } else {
      this.notifyError('大模型响应失败: ' + data.error);
    }
  }

  async handleTTSResult(data) {
    if (data.success && data.audioData) {
      try {
        await audioService.playAudioFromBase64(data.audioData);
        this.notifyStatusChange('speaking');
      } catch (error) {
        this.notifyError('播放语音失败: ' + error.message);
      }
    } else {
      this.notifyError('语音合成失败: ' + data.error);
    }
  }

  // 回调函数管理
  setCallbacks(callbacks) {
    this.conversationCallbacks = { ...this.conversationCallbacks, ...callbacks };
  }

  notifyConversationStart() {
    if (this.conversationCallbacks.onStart) {
      this.conversationCallbacks.onStart();
    }
  }

  notifyConversationEnd() {
    if (this.conversationCallbacks.onEnd) {
      this.conversationCallbacks.onEnd();
    }
  }

  notifyMessage(role, message) {
    if (this.conversationCallbacks.onMessage) {
      this.conversationCallbacks.onMessage({ role, message, timestamp: Date.now() });
    }
  }

  notifyError(error) {
    if (this.conversationCallbacks.onError) {
      this.conversationCallbacks.onError(error);
    }
  }

  notifyStatusChange(status) {
    if (this.conversationCallbacks.onStatusChange) {
      this.conversationCallbacks.onStatusChange(status);
    }
  }

  // 获取状态
  getStatus() {
    return {
      isConnected: this.isConnected,
      isConversing: this.isConversing,
      audioStatus: audioService.getRecordingStatus(),
      wsConnected: webSocketService.isConnected()
    };
  }

  // 清理资源
  async cleanup() {
    try {
      this.isConversing = false;
      await audioService.cleanup();
      webSocketService.disconnect();
      responseLLMService.cleanup();
      console.log('数字人服务清理完成');
    } catch (error) {
      console.error('数字人服务清理失败:', error);
    }
  }
}

// 创建单例实例
const digitalHumanService = new DigitalHumanService();
export default digitalHumanService;