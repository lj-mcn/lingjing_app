import axios from 'axios';

class STTTTSService {
  constructor() {
    // 使用模拟模式，不依赖OpenAI
    this.useSimulation = true;
    this.sttEndpoint = 'https://api.openai.com/v1/audio/transcriptions';
    this.ttsEndpoint = 'https://api.openai.com/v1/audio/speech';
    this.apiKey = '';
    this.sttModel = 'whisper-1';
    this.ttsModel = 'tts-1';
    this.ttsVoice = 'alloy';
  }

  setConfig({ apiKey, sttEndpoint, ttsEndpoint, sttModel, ttsModel, ttsVoice }) {
    if (apiKey) this.apiKey = apiKey;
    if (sttEndpoint) this.sttEndpoint = sttEndpoint;
    if (ttsEndpoint) this.ttsEndpoint = ttsEndpoint;
    if (sttModel) this.sttModel = sttModel;
    if (ttsModel) this.ttsModel = ttsModel;
    if (ttsVoice) this.ttsVoice = ttsVoice;
  }

  async speechToText(audioUri) {
    try {
      if (!this.apiKey) {
        throw new Error('API密钥未配置');
      }

      if (!audioUri) {
        throw new Error('音频文件路径为空');
      }

      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/wav',
        name: 'audio.wav'
      });
      formData.append('model', this.sttModel);
      formData.append('language', 'zh'); // 指定中文

      const response = await axios.post(this.sttEndpoint, formData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'multipart/form-data'
        },
        timeout: 30000
      });

      if (response.data && response.data.text) {
        return {
          success: true,
          text: response.data.text,
          language: response.data.language
        };
      } else {
        throw new Error('无效的STT响应格式');
      }
    } catch (error) {
      console.error('语音转文字失败:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  async textToSpeech(text, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('API密钥未配置');
      }

      if (!text || text.trim().length === 0) {
        throw new Error('文本内容为空');
      }

      const requestData = {
        model: options.model || this.ttsModel,
        input: text,
        voice: options.voice || this.ttsVoice,
        response_format: options.format || 'mp3',
        speed: options.speed || 1.0
      };

      const response = await axios.post(this.ttsEndpoint, requestData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'blob',
        timeout: 30000
      });

      if (response.data) {
        // 将音频数据转换为base64
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
          reader.onloadend = () => {
            const base64data = reader.result.split(',')[1];
            resolve({
              success: true,
              audioData: base64data,
              format: requestData.response_format
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(response.data);
        });
      } else {
        throw new Error('无效的TTS响应格式');
      }
    } catch (error) {
      console.error('文字转语音失败:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  // 本地模拟STT（用于开发测试）
  async mockSpeechToText(audioUri) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockTexts = [
          '你好，我想和你聊天',
          '今天天气怎么样？',
          '请帮我介绍一下你自己',
          '我感觉有点无聊',
          '能不能讲个笑话？'
        ];
        const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)];
        
        resolve({
          success: true,
          text: randomText,
          language: 'zh',
          isMock: true
        });
      }, 1000);
    });
  }

  // 本地模拟TTS（用于开发测试）
  async mockTextToSpeech(text) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // 返回一个模拟的音频数据
        const mockAudioBase64 = 'UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmgfDD2F0fPEbSAFKXvB6+ONQA0PZ7zz26piHgU8ltLuzXEjCC13yO/eizEIHWq4+eGWT'; // 这是一个示例base64
        
        resolve({
          success: true,
          audioData: mockAudioBase64,
          format: 'mp3',
          isMock: true
        });
      }, 1500);
    });
  }

  // 检查是否使用模拟模式
  isSimulationMode() {
    return this.useSimulation || !this.apiKey || this.apiKey.trim().length === 0;
  }

  // 智能调用STT（默认使用模拟模式）
  async intelligentSTT(audioUri) {
    console.log('使用模拟STT服务 - 不依赖OpenAI');
    return await this.mockSpeechToText(audioUri);
  }

  // 智能调用TTS（默认使用模拟模式）
  async intelligentTTS(text, options = {}) {
    console.log('使用模拟TTS服务 - 不依赖OpenAI');
    return await this.mockTextToSpeech(text);
  }

  // 启用真实API模式（如果将来需要）
  enableRealAPI(apiKey) {
    this.useSimulation = false;
    this.apiKey = apiKey;
    console.log('已启用真实STT/TTS API');
  }

  // 启用模拟模式
  enableSimulation() {
    this.useSimulation = true;
    console.log('已启用模拟STT/TTS服务');
  }
}

// 创建单例实例
const sttTtsService = new STTTTSService();
export default sttTtsService;