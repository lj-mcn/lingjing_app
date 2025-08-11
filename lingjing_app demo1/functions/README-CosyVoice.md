# CosyVoice TTS 集成说明

## 项目架构

```
语音输入 → STT服务 → LLM服务 → CosyVoice TTS → 音频输出
```

## CosyVoice 集成功能

### 支持的 TTS 模式

1. **SFT模式** (默认)
   - 使用预训练说话人
   - 参数: `tts_text`, `spk_id`
   - 适用: 基础语音合成

2. **Zero-shot模式**
   - 声音克隆
   - 参数: `tts_text`, `prompt_text`, `prompt_wav`
   - 适用: 个性化语音合成

3. **跨语言模式**
   - 跨语言语音合成
   - 参数: `tts_text`, `prompt_wav`
   - 适用: 多语言场景

4. **指令模式**
   - 基于指令的语音合成
   - 参数: `tts_text`, `spk_id`, `instruct_text`
   - 适用: 情感或风格控制

### 配置说明

#### 环境变量
```bash
# CosyVoice API 服务地址
COSYVOICE_API_URL=http://localhost:50000
```

#### 配置文件
- `config/cosyvoice.js`: CosyVoice 相关配置
- 包含说话人ID、TTS模式、音频处理等设置

## API 接口

### WebSocket 接口

**连接地址**: `ws://your-domain/websocketService`

**消息格式**:
```javascript
{
  "type": "voice_input",
  "audio": "base64-encoded-audio",
  "sessionId": "unique-session-id",
  "ttsOptions": {
    "mode": "sft",              // sft|zero_shot|cross_lingual|instruct
    "spkId": "中文女",           // 说话人ID
    "instructText": "温柔地朗读" // 指令模式专用
  }
}
```

**响应消息类型**:
- `connected`: 连接确认
- `status`: 处理状态更新
- `stt_result`: 语音识别结果
- `llm_result`: AI回复内容
- `voice_response`: 最终语音文件
- `processing_error`: 处理错误

### Firebase Cloud Functions

**函数名**: `processVoiceInput`

**调用方式**:
```javascript
const processVoice = firebase.functions().httpsCallable('processVoiceInput')
const result = await processVoice({
  audio: audioBase64String
})
```

## 部署说明

### 1. 启动 CosyVoice 服务

```bash
# FastAPI 服务器
python runtime/python/fastapi/server.py --port 50000 --model_dir iic/CosyVoice-300M

# gRPC 服务器 (可选)
python runtime/python/grpc/server.py --port 50000 --max_conc 4
```

### 2. 配置环境变量

```bash
# 设置 CosyVoice API 地址
export COSYVOICE_API_URL=http://your-cosyvoice-server:50000
```

### 3. 部署 Firebase Functions

```bash
cd functions
npm install
firebase deploy --only functions
```

### 4. 本地测试

```bash
# 启动本地 WebSocket 服务器
node test-websocket.js

# 运行集成测试
node test-cosyvoice-integration.js
```

## 使用示例

### 基础 SFT 模式
```javascript
ws.send(JSON.stringify({
  type: 'voice_input',
  audio: audioBase64,
  ttsOptions: {
    mode: 'sft',
    spkId: '中文女'
  }
}))
```

### 指令模式
```javascript
ws.send(JSON.stringify({
  type: 'voice_input',
  audio: audioBase64,
  ttsOptions: {
    mode: 'instruct',
    spkId: '中文女',
    instructText: '用温柔的声音朗读'
  }
}))
```

### Zero-shot 声音克隆
```javascript
ws.send(JSON.stringify({
  type: 'voice_input',
  audio: audioBase64,
  ttsOptions: {
    mode: 'zero_shot',
    promptText: '这是提示文本',
    promptAudio: promptAudioBuffer
  }
}))
```

## 监控和调试

### 日志查看
```bash
# Firebase Functions 日志
firebase functions:log

# 本地测试日志
# 查看控制台输出即可
```

### 健康检查
```bash
# 检查 WebSocket 服务状态
curl http://your-domain/websocketService/health

# 检查 CosyVoice API 状态
curl http://your-cosyvoice-server:50000/
```

## 故障排除

### 常见问题

1. **CosyVoice API 连接失败**
   - 检查 `COSYVOICE_API_URL` 环境变量
   - 确认 CosyVoice 服务器正在运行
   - 检查网络连接和防火墙设置

2. **音频流处理错误**
   - 检查音频数据格式和大小
   - 确认 Firebase Storage 配置正确
   - 检查存储权限设置

3. **WebSocket 连接问题**
   - 检查 Firebase Functions 部署状态
   - 确认 WebSocket 服务正在运行
   - 检查客户端连接参数

### 性能优化

1. **音频处理优化**
   - 使用合适的音频压缩格式
   - 控制音频文件大小
   - 实现音频缓存机制

2. **API 调用优化**
   - 设置合理的超时时间
   - 实现重试机制
   - 使用连接池

3. **存储优化**
   - 定期清理过期音频文件
   - 使用 CDN 加速音频下载
   - 实现音频文件压缩

## 扩展功能

1. **多模型支持**: 支持不同的 CosyVoice 模型
2. **批量处理**: 支持批量语音合成
3. **缓存机制**: 实现智能音频缓存
4. **实时流式**: 支持实时流式音频传输