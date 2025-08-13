# SenceVoice WebSocket 接口规范

## 概述

SenceVoice WebSocket 接口提供完整的语音交互功能，包括语音识别（ASR）、声纹识别、关键词唤醒、大语言模型对话和语音合成（TTS）。本文档定义了客户端与服务端之间的通信协议规范。

## 服务器信息

- **协议**: WebSocket
- **默认端口**: 8000
- **默认地址**: ws://localhost:8000
- **消息格式**: JSON
- **编码**: UTF-8

## 消息类型

### 1. 基础消息结构

所有消息都遵循以下基本结构：

```json
{
  "type": "消息类型",
  "requestId": "请求ID（可选）",
  "timestamp": 时间戳（毫秒）,
  "data": {...}  // 具体数据（可选）
}
```

### 2. 消息类型枚举

| 消息类型 | 方向 | 描述 |
|---------|------|------|
| `voice_request` | C→S | 语音识别和对话请求 |
| `voice_response` | S→C | 语音识别和对话响应 |
| `sv_enroll_request` | C→S | 声纹注册请求 |
| `sv_enroll_response` | S→C | 声纹注册响应 |
| `status_request` | C→S | 状态查询请求 |
| `status_response` | S→C | 状态查询响应 |
| `reset_kws` | C→S | 重置关键词状态请求 |
| `reset_kws_response` | S→C | 重置关键词状态响应 |
| `ping` | C→S | 心跳检测 |
| `pong` | S→C | 心跳响应 |
| `error` | S→C | 错误消息 |

## 详细接口规范

### 1. 语音识别和对话接口

#### 请求 (voice_request)

```json
{
  "type": "voice_request",
  "requestId": "voice_req_1_1642567890123",
  "timestamp": 1642567890123,
  "data": {
    "audio_data": "base64编码的音频数据",
    "audio_format": "wav",
    "sample_rate": 16000,
    "channels": 1,
    "bit_depth": 16
  }
}
```

**字段说明:**
- `audio_data`: 必填，base64编码的音频数据
- `audio_format`: 音频格式，默认"wav"
- `sample_rate`: 采样率，默认16000Hz
- `channels`: 声道数，默认1（单声道）
- `bit_depth`: 位深度，默认16位

#### 响应 (voice_response)

```json
{
  "type": "voice_response",
  "requestId": "voice_req_1_1642567890123",
  "success": true,
  "timestamp": 1642567890456,
  "data": {
    "success": true,
    "asr_result": "你好小千",
    "llm_response": "你好！我是小千，有什么可以帮助你的吗？",
    "audio_response": "base64编码的TTS音频",
    "response_type": "voice_chat_success"
  }
}
```

#### 错误响应示例

```json
{
  "type": "voice_response",
  "requestId": "voice_req_1_1642567890123",
  "success": false,
  "timestamp": 1642567890456,
  "data": {
    "success": false,
    "error": "关键词未激活",
    "error_code": "KWS_NOT_ACTIVATED",
    "message": "很抱歉，唤醒词错误，请说出正确的唤醒词哦",
    "audio_response": "base64编码的错误提示音频",
    "asr_result": "你好"
  }
}
```

### 2. 声纹注册接口

#### 请求 (sv_enroll_request)

```json
{
  "type": "sv_enroll_request",
  "requestId": "sv_enroll_req_1_1642567890123",
  "timestamp": 1642567890123,
  "data": {
    "audio_data": "base64编码的音频数据",
    "audio_format": "wav",
    "sample_rate": 16000,
    "channels": 1,
    "bit_depth": 16
  }
}
```

#### 响应 (sv_enroll_response)

```json
{
  "type": "sv_enroll_response",
  "requestId": "sv_enroll_req_1_1642567890123",
  "success": true,
  "timestamp": 1642567890456,
  "data": {
    "success": true,
    "message": "声纹注册完成！现在只有你可以命令我啦！",
    "audio_response": "base64编码的TTS音频",
    "response_type": "sv_enrollment_success"
  }
}
```

### 3. 状态查询接口

#### 请求 (status_request)

```json
{
  "type": "status_request",
  "requestId": "status_req_1_1642567890123",
  "timestamp": 1642567890123
}
```

#### 响应 (status_response)

```json
{
  "type": "status_response",
  "requestId": "status_req_1_1642567890123",
  "success": true,
  "timestamp": 1642567890456,
  "data": {
    "kws_enabled": true,
    "kws_activated": false,
    "sv_enabled": true,
    "sv_enrolled": true,
    "kws_keyword": "ni hao xiao qian",
    "sv_threshold": 0.35
  }
}
```

### 4. 重置关键词状态接口

#### 请求 (reset_kws)

```json
{
  "type": "reset_kws",
  "requestId": "reset_kws_req_1_1642567890123",
  "timestamp": 1642567890123
}
```

#### 响应 (reset_kws_response)

```json
{
  "type": "reset_kws_response",
  "requestId": "reset_kws_req_1_1642567890123",
  "success": true,
  "timestamp": 1642567890456,
  "message": "关键词状态已重置"
}
```

### 5. 心跳检测接口

#### 请求 (ping)

```json
{
  "type": "ping",
  "timestamp": 1642567890123
}
```

#### 响应 (pong)

```json
{
  "type": "pong",
  "timestamp": 1642567890456
}
```

### 6. 错误消息

```json
{
  "type": "error",
  "success": false,
  "error": "错误描述",
  "timestamp": 1642567890456,
  "requestId": "相关请求ID（可选）"
}
```

## 错误代码

| 错误代码 | 描述 | 处理建议 |
|---------|------|---------|
| `AUDIO_PROCESS_FAILED` | 音频处理失败 | 检查音频格式和数据完整性 |
| `AUDIO_TOO_SHORT` | 音频时长不足 | 声纹注册需要至少3秒音频 |
| `ASR_FAILED` | 语音识别失败 | 重新发送音频或检查音频质量 |
| `KWS_NOT_ACTIVATED` | 关键词未激活 | 说出正确的唤醒词 |
| `SV_NOT_ENROLLED` | 声纹未注册 | 先进行声纹注册 |
| `SV_VERIFICATION_FAILED` | 声纹验证失败 | 重新说话或重新注册声纹 |
| `SV_ENROLLMENT_FAILED` | 声纹注册失败 | 检查音频质量和时长 |
| `VOICE_CHAT_FAILED` | 语音对话失败 | 检查系统状态或重试 |

## 配置模板

### 服务端配置 (sencevoice_server_config.yaml)

```yaml
server:
  host: "0.0.0.0"
  port: 8000

models:
  sencevoice_model_path: "/path/to/SenseVoice"
  llm_model_path: "/path/to/Qwen2.5"
  sv_model_path: "/path/to/cam++"

features:
  enable_kws: true
  enable_sv: true
  kws_keyword: "ni hao xiao qian"
  sv_threshold: 0.35

paths:
  sv_enroll_dir: "./SpeakerVerification_DIR/enroll_wav/"
  output_dir: "./output"

audio:
  sample_rate: 16000
  channels: 1
  bit_depth: 16
```

### 客户端配置 (sencevoice_client_config.yaml)

```yaml
servers:
  - url: "ws://localhost:8000"
    name: "本地SenceVoice服务器"
    priority: 1
    enabled: true
    description: "本地开发服务器"

websocket:
  timeout: 60
  ping_interval: 20
  ping_timeout: 10
  max_message_size: 10485760  # 10MB for audio data
  compression: false

retry:
  max_retries: 10
  retry_interval: 3
  max_retry_interval: 60
  exponential_backoff: true
  jitter: true

audio:
  default_format: "wav"
  default_sample_rate: 16000
  default_channels: 1
  default_bit_depth: 16
  request_timeout: 30.0

health_check:
  enabled: true
  interval: 30
  timeout: 5
  max_failures: 5
```

## 使用流程

### 1. 基本连接流程

```
1. 客户端连接到WebSocket服务器
2. 发送status_request查询服务器状态
3. 根据需要发送声纹注册请求
4. 发送语音请求进行对话
5. 处理服务器响应
```

### 2. 声纹注册流程

```
1. 检查服务器状态（sv_enrolled: false）
2. 录制至少3秒的音频
3. 发送sv_enroll_request
4. 等待sv_enroll_response确认注册成功
```

### 3. 语音对话流程

```
1. 录制音频（如果启用KWS，需包含唤醒词）
2. 将音频转换为base64编码
3. 发送voice_request
4. 等待voice_response
5. 播放返回的TTS音频（如果有）
```

## 音频要求

### 输入音频格式
- **格式**: WAV (推荐) 或其他常见格式
- **采样率**: 16000Hz (推荐)
- **声道**: 1 (单声道)
- **位深度**: 16位
- **编码**: Base64字符串
- **最大大小**: 10MB

### 输出音频格式
- **格式**: MP3
- **编码**: Base64字符串
- **语音**: Edge-TTS zh-CN-XiaoyiNeural

## 安全考虑

1. **音频数据**: 确保音频数据的完整性和正确性
2. **连接安全**: 建议在生产环境中使用WSS（WebSocket Secure）
3. **身份验证**: 通过声纹识别进行用户身份验证
4. **数据隐私**: 音频数据仅在服务器端临时处理，不会永久存储

## 示例代码

### Python客户端示例

```python
import asyncio
import base64
from sencevoice_client import SenceVoiceClient

async def main():
    client = SenceVoiceClient()
    
    # 连接到服务器
    await client.connect()
    
    # 获取状态
    status = await client.get_status()
    print(f"KWS: {status.kws_enabled}, SV: {status.sv_enabled}")
    
    # 发送语音请求
    with open("audio.wav", "rb") as f:
        audio_data = base64.b64encode(f.read()).decode()
    
    response = await client.send_voice_request(audio_data)
    print(f"ASR: {response.asr_result}")
    print(f"LLM: {response.llm_response}")
    
    # 断开连接
    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
```

### JavaScript客户端示例

```javascript
class SenceVoiceClient {
    constructor(url = 'ws://localhost:8000') {
        this.url = url;
        this.ws = null;
        this.requestId = 0;
        this.pendingRequests = new Map();
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);
            
            this.ws.onopen = () => resolve();
            this.ws.onerror = (error) => reject(error);
            this.ws.onmessage = (event) => this.handleMessage(event);
        });
    }
    
    async sendVoiceRequest(audioBlob) {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        
        const requestId = `voice_req_${++this.requestId}_${Date.now()}`;
        
        const message = {
            type: 'voice_request',
            requestId: requestId,
            timestamp: Date.now(),
            data: {
                audio_data: base64Audio,
                audio_format: 'wav',
                sample_rate: 16000,
                channels: 1,
                bit_depth: 16
            }
        };
        
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });
            this.ws.send(JSON.stringify(message));
        });
    }
    
    handleMessage(event) {
        const data = JSON.parse(event.data);
        const requestId = data.requestId;
        
        if (requestId && this.pendingRequests.has(requestId)) {
            const { resolve } = this.pendingRequests.get(requestId);
            this.pendingRequests.delete(requestId);
            resolve(data);
        }
    }
}

// 使用示例
async function example() {
    const client = new SenceVoiceClient();
    await client.connect();
    
    // 录制音频
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = async (event) => {
        const response = await client.sendVoiceRequest(event.data);
        console.log('ASR结果:', response.data.asr_result);
        console.log('LLM响应:', response.data.llm_response);
    };
    
    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), 3000); // 录制3秒
}
```

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| 1.0.0 | 2024-01-01 | 初始版本，包含基础语音交互功能 |

## 联系方式

如有问题或建议，请联系开发团队。