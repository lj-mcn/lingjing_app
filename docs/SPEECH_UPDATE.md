# 语音聊天功能更新文档

## 概述

本次更新将语音识别模型从原有的多种云服务改为使用 **SenseVoice-small**，语音合成从原有服务改为使用 **Edge TTS**，参考111.py的实现方式。

## 新功能特性

### 1. SenseVoice-small 语音识别
- **模型**: SenseVoice-small
- **支持语言**: 自动检测 (中文、英文、粤语、日语、韩语)
- **特点**: 高精度、低延迟、支持多语言自动切换
- **连接方式**: 通过WebSocket与后端SenseVoice服务通信

### 2. Edge TTS 语音合成
- **服务**: Microsoft Edge Text-to-Speech
- **默认语音**: zh-CN-XiaoyiNeural (中文女声-小艺)
- **支持参数**: 语速、音调、音量调节
- **格式**: MP3输出
- **连接方式**: 通过WebSocket与后端服务通信

## 配置说明

### 语音服务配置 (llmConfig.js)

```javascript
sttTts: {
  provider: 'auto', // 自动选择：SenseVoice STT + Edge TTS
  
  // SenseVoice配置
  sensevoice: {
    model: 'sensevoice-small',
    language: 'auto', // 自动检测语言
    use_itn: false,
    enabled: true,
  },
  
  // Edge TTS配置
  edgeTts: {
    voice: 'zh-CN-XiaoyiNeural', // 默认中文女声
    rate: '0%', // 语速
    pitch: '+0Hz', // 音调
    volume: '+0%', // 音量
    enabled: true,
  },
}
```

### 可用语音选项

| 语音代码 | 描述 | 语言 |
|---------|------|------|
| zh-CN-XiaoyiNeural | 中文女声-小艺 | 中文 |
| zh-CN-YunxiNeural | 中文男声-云希 | 中文 |
| zh-CN-XiaoxiaoNeural | 中文女声-晓晓 | 中文 |
| zh-CN-YunyangNeural | 中文男声-云扬 | 中文 |
| en-US-AnaNeural | 英文女声-安娜 | 英文 |
| en-US-AriaNeural | 英文女声-艾瑞亚 | 英文 |

## 服务优先级

### STT (语音识别) 优先级
1. **SenseVoice** (新增，最高优先级)
2. Google Cloud Speech-to-Text
3. OpenAI Whisper
4. Azure Speech
5. Expo Speech Recognition
6. Web Speech API
7. 模拟模式

### TTS (语音合成) 优先级
1. **Edge TTS** (新增，最高优先级)
2. Expo Speech
3. Google Cloud Text-to-Speech
4. OpenAI TTS
5. Azure Speech
6. Web Speech API
7. 模拟模式

## WebSocket消息协议

### 语音识别请求
```javascript
{
  type: 'voice_request',
  requestId: 'voice_req_123_timestamp',
  timestamp: Date.now(),
  data: {
    audio_data: 'base64_encoded_audio',
    audio_format: 'wav',
    sample_rate: 16000,
    channels: 1,
    bit_depth: 16
  }
}
```

### 语音识别响应
```javascript
{
  type: 'voice_response',
  requestId: 'voice_req_123_timestamp',
  success: true,
  data: {
    asr_result: '识别的文本内容',
    confidence: 0.95,
    language: 'zh-CN'
  }
}
```

### TTS请求
```javascript
{
  type: 'tts_request',
  requestId: 'tts_req_123_timestamp',
  timestamp: Date.now(),
  data: {
    text: '要合成的文本',
    voice: 'zh-CN-XiaoyiNeural',
    rate: '0%',
    pitch: '+0Hz',
    volume: '+0%',
    format: 'mp3'
  }
}
```

### TTS响应
```javascript
{
  type: 'tts_response',
  requestId: 'tts_req_123_timestamp',
  success: true,
  data: {
    audio_data: 'base64_encoded_mp3',
    format: 'mp3',
    voice: 'zh-CN-XiaoyiNeural'
  }
}
```

## 使用示例

### 在React Native组件中使用

```javascript
import sttTtsService from '../services/STTTTSService'
import senceVoiceService from '../services/SenceVoiceService'

// 1. 连接SenseVoice服务
await senceVoiceService.connect('ws://10.91.225.137:8000')

// 2. 语音识别
const sttResult = await sttTtsService.intelligentSTT(audioUri)
if (sttResult.success) {
  console.log('识别结果:', sttResult.text)
  console.log('置信度:', sttResult.confidence)
}

// 3. 语音合成
const ttsResult = await sttTtsService.intelligentTTS('你好，我是嘎巴龙！', {
  voice: 'zh-CN-XiaoyiNeural',
  rate: '+10%', // 稍快一点
  pitch: '+5Hz' // 音调稍高
})
if (ttsResult.success) {
  console.log('合成成功:', ttsResult.format)
  // 播放音频...
}
```

## 后端要求

后端服务需要支持以下功能：

1. **SenseVoice-small模型**: 用于语音识别
2. **Edge TTS集成**: 用于语音合成
3. **WebSocket服务**: 处理实时语音请求
4. **音频格式转换**: 支持WAV输入、MP3输出

具体实现可参考111.py中的以下部分：
- SenseVoice模型加载和推理 (第292-295行)
- Edge TTS异步调用 (第265-268行)
- 音频文件处理 (第182-250行)

## 注意事项

1. **网络连接**: 确保前端能够连接到SenseVoice WebSocket服务
2. **音频格式**: 输入音频建议使用16kHz WAV格式
3. **性能优化**: SenseVoice-small提供更快的识别速度
4. **语言支持**: 自动语言检测减少了配置复杂度
5. **错误处理**: 服务不可用时会自动降级到其他可用服务

## 测试验证

1. 测试SenseVoice语音识别准确性
2. 测试Edge TTS语音合成质量
3. 测试多语言自动切换功能
4. 测试网络断线重连机制
5. 测试音频播放和录制功能