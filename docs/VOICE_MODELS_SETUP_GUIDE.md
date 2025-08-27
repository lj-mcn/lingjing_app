# 🎵 Kokoro TTS + SenseVoice-small 部署指南

## 📋 概述

本指南将帮助你集成 **Kokoro TTS** (语音合成) 和 **SenseVoice-small** (语音识别) 到现有的数字人对话系统中。

### 🎯 目标架构
```
App Frontend ←→ VoiceService.js ←→ voice_service_server.py ←→ [Kokoro TTS + SenseVoice]
                                        ↓
                          ResponsLLMService.js ←→ Qwen2.5-1.5B-Instruct
```

## 🚀 快速开始

### 1️⃣ 自动安装 (推荐)

```bash
# 运行自动安装脚本
python setup_voice_models.py

# 按提示完成安装
```

### 2️⃣ 手动安装

#### 安装Python依赖
```bash
pip install torch torchaudio transformers
pip install websockets funasr modelscope
pip install soundfile librosa
```

#### 下载SenseVoice模型
```python
from modelscope import snapshot_download
from funasr import AutoModel

# 下载模型
model_dir = snapshot_download('iic/SenseVoiceSmall', cache_dir='./voice_models/sensevoice')

# 测试模型加载
model = AutoModel(model=model_dir, trust_remote_code=True)
```

#### 下载Kokoro TTS
```bash
cd voice_models
git clone https://github.com/hexgrad/kokoro kokoro_tts
cd kokoro_tts
pip install -r requirements.txt
```

## 🔧 配置

### 环境变量配置 (.env)
```env
# 语音服务配置
VOICE_SERVICE_URL=ws://192.168.18.138:8001
VOICE_SERVICE_BACKUP_1=ws://localhost:8001
VOICE_SERVICE_BACKUP_2=ws://127.0.0.1:8001
```

### 前端配置 (src/config/llmConfig.js)
```javascript
sttTts: {
  provider: 'voice_service',
  voice_service: {
    enabled: true,
    websocket_url: process.env.VOICE_SERVICE_URL || 'ws://192.168.18.138:8001',
    tts: {
      model: 'kokoro-v0_19',
      voice_style: 'default',
      format: 'wav',
    },
    stt: {
      model: 'sensevoice-small',
      language: 'zh',
      enable_itn: true,
    },
  },
}
```

## 🖥️ 启动服务

### 1. 启动语音服务器
```bash
# 基础启动
python voice_service_server.py

# 自定义端口
python voice_service_server.py --port 8001

# 指定模型路径
python voice_service_server.py --kokoro-path ./models/kokoro --sensevoice-path ./models/sensevoice
```

### 2. 启动LLM服务器 (如果还没启动)
```bash
python response/websocket_llm_adapter.py --port 8000
```

### 3. 启动App前端
```bash
npm start
# 或
expo start
```

## 🧪 测试

### 测试语音服务连接
```javascript
import voiceService from './src/services/VoiceService'

// 初始化服务
await voiceService.initialize()

// 测试TTS
const ttsResult = await voiceService.textToSpeech("你好，我是嘎巴龙")
console.log('TTS结果:', ttsResult)

// 测试STT (需要base64编码的音频数据)
const sttResult = await voiceService.speechToText(audioBase64)
console.log('STT结果:', sttResult)
```

### 完整对话流程测试
```
用户说话 → SenseVoice识别 → Qwen生成回复 → Kokoro合成语音 → 播放给用户
```

## 📱 前端集成

### 在数字人服务中使用
```javascript
// src/services/DigitalHumanService.js
import voiceService from './VoiceService'

class DigitalHumanService {
  async processVoiceInput(audioData) {
    try {
      // 1. 语音转文字
      const sttResult = await voiceService.speechToText(audioData)
      
      // 2. 发送给LLM获取回复
      const llmResult = await responseLLMService.sendMessage(sttResult.text)
      
      // 3. 文字转语音
      const ttsResult = await voiceService.textToSpeech(llmResult.message)
      
      // 4. 播放音频
      await this.playAudio(ttsResult.audio_data)
      
      return { success: true }
    } catch (error) {
      console.error('语音处理失败:', error)
      return { success: false, error: error.message }
    }
  }
}
```

## 🐛 故障排除

### 常见问题

1. **模型下载失败**
   ```bash
   # 使用镜像源
   pip install -i https://pypi.tuna.tsinghua.edu.cn/simple/ funasr
   ```

2. **GPU内存不足**
   ```python
   # 修改 voice_service_server.py 中的设备配置
   self.device = torch.device("cpu")  # 强制使用CPU
   ```

3. **WebSocket连接失败**
   - 检查防火墙设置
   - 确认端口8001未被占用
   - 检查IP地址是否正确

4. **音频格式问题**
   - 确保音频采样率为16000Hz
   - 支持的格式：wav, mp3, m4a

### 性能优化

1. **模型量化** (减少内存使用)
   ```python
   # 在模型初始化时启用量化
   model = AutoModel(
       model=model_path,
       device=device,
       torch_dtype=torch.float16  # 使用半精度
   )
   ```

2. **并发处理**
   ```python
   # 可以同时处理多个TTS/STT请求
   # voice_service_server.py 已支持并发
   ```

## 📊 监控和日志

### 查看服务状态
```bash
# 查看语音服务日志
tail -f voice_service.log

# 检查端口占用
netstat -an | grep :8001
```

### 性能监控
```javascript
// 获取服务状态
const status = voiceService.getServiceStatus()
console.log('语音服务状态:', status)
```

## 🔄 更新升级

### 更新模型
```bash
# 删除旧模型
rm -rf voice_models/sensevoice
rm -rf voice_models/kokoro_tts

# 重新运行安装脚本
python setup_voice_models.py
```

### 更新服务代码
```bash
# 重启语音服务
pkill -f voice_service_server.py
python voice_service_server.py
```

## 🎯 下一步

1. **优化模型性能** - 根据硬件配置调整模型参数
2. **添加更多语音风格** - Kokoro支持多种语音风格
3. **语音情感识别** - SenseVoice支持情感检测
4. **实时流式处理** - 实现实时语音对话

## 📞 技术支持

如遇到问题，请：
1. 查看日志文件：`voice_service.log`
2. 检查模型文件是否完整
3. 确认网络连接正常
4. 验证Python环境和依赖

---

🎉 **恭喜！现在你的数字人助手支持 Kokoro TTS + SenseVoice-small 语音功能了！**