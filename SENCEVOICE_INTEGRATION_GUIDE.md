# SenceVoice 声纹识别集成指南

## 概述

本项目已集成SenceVoice WebSocket服务，支持完整的声纹识别语音交互功能，包括：

- 🎤 **语音识别 (ASR)** - 将语音转换为文字
- 🔐 **声纹识别和注册** - 用户身份验证
- 🔑 **关键词唤醒 (KWS)** - 唤醒词激活
- 🧠 **大语言模型对话** - 智能对话响应
- 🗣️ **语音合成 (TTS)** - 将文字转换为语音

## 架构说明

```
前端 (React Native)
├── SenceVoiceService.js      # SenceVoice WebSocket客户端
├── DigitalHumanService.js    # 数字人服务（已集成SenceVoice）
└── senceVoiceConfig.js       # 配置文件

后端 (Python WebSocket服务器)
├── sencevoice_websocket_server.py  # SenceVoice WebSocket服务器
├── sencevoice_server_config.yaml   # 服务器配置文件
└── start_sencevoice_server.py      # 启动脚本
```

## 快速开始

### 1. 后端服务器部署

#### 安装Python依赖
```bash
pip install websockets pyyaml
```

#### 启动SenceVoice服务器
```bash
# 使用启动脚本（推荐）
python start_sencevoice_server.py

# 或直接启动服务器
python sencevoice_websocket_server.py
```

#### 服务器配置
编辑 `sencevoice_server_config.yaml` 文件：

```yaml
server:
  host: "0.0.0.0"
  port: 8000

models:
  sencevoice_model_path: "/path/to/SenseVoice"  # 修改为实际路径
  llm_model_path: "/path/to/Qwen2.5"           # 修改为实际路径
  sv_model_path: "/path/to/cam++"              # 修改为实际路径

features:
  enable_kws: true
  enable_sv: true
  kws_keyword: "ni hao xiao qian"  # 唤醒词
  sv_threshold: 0.35               # 声纹识别阈值

audio:
  sample_rate: 16000
  channels: 1
  bit_depth: 16
```

### 2. 前端配置

#### 在数字人服务初始化时添加SenceVoice配置：

```javascript
import digitalHumanService from './src/services/DigitalHumanService'

// 初始化数字人服务
const config = {
  sencevoice_url: 'ws://localhost:8000',  // SenceVoice服务器地址
  // 其他配置...
}

digitalHumanService.initialize(config)
```

#### 修改客户端配置：

编辑 `src/config/senceVoiceConfig.js`：

```javascript
const senceVoiceConfig = {
  servers: [
    {
      url: "ws://your-server-ip:8000",  // 修改为实际服务器地址
      name: "SenceVoice服务器",
      enabled: true
    }
  ]
  // 其他配置...
}
```

## 使用流程

### 1. 基本语音对话流程

```
1. 用户点击"开始对话" → 开始录音
2. 系统检测SenceVoice服务状态
3. 如果需要声纹注册：
   - 用户录制3+秒音频 → 发送注册请求 → 完成注册
4. 如果需要关键词激活：
   - 用户说唤醒词 → 激活成功
5. 正常对话：
   - 用户说话 → ASR识别 → LLM响应 → TTS播放
```

### 2. 声纹注册流程

```
1. 检测到声纹未注册
2. 提示用户录制至少3秒音频
3. 发送声纹注册请求
4. 服务器处理并存储声纹特征
5. 返回注册成功确认
6. 后续对话将进行声纹验证
```

### 3. 关键词唤醒流程

```
1. 检测到关键词未激活
2. 提示用户说出唤醒词
3. 用户说话 → ASR识别
4. 检测唤醒词匹配 → 激活成功
5. 后续对话无需再说唤醒词
```

## 接口规范

### WebSocket消息格式

#### 语音识别和对话请求
```javascript
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

#### 语音响应
```javascript
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

#### 声纹注册请求
```javascript
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

### 错误码说明

| 错误码 | 描述 | 处理建议 |
|--------|------|----------|
| `KWS_NOT_ACTIVATED` | 关键词未激活 | 说出正确的唤醒词 |
| `SV_NOT_ENROLLED` | 声纹未注册 | 先进行声纹注册 |
| `SV_VERIFICATION_FAILED` | 声纹验证失败 | 重新说话或重新注册 |
| `AUDIO_TOO_SHORT` | 音频时长不足 | 录制更长时间的音频 |
| `ASR_FAILED` | 语音识别失败 | 检查音频质量或重试 |

## 状态管理

### 服务器状态
```javascript
{
  "kws_enabled": true,      // 关键词唤醒是否启用
  "kws_activated": false,   // 关键词是否已激活
  "sv_enabled": true,       // 声纹识别是否启用
  "sv_enrolled": false,     // 声纹是否已注册
  "kws_keyword": "ni hao xiao qian",  // 唤醒词
  "sv_threshold": 0.35      // 声纹识别阈值
}
```

### 客户端状态监控
```javascript
// 获取SenceVoice服务状态
const status = digitalHumanService.getSenceVoiceStatus()

// 检查连接状态
if (status?.connectionStatus?.isConnected) {
  console.log('SenceVoice服务已连接')
}

// 检查是否需要声纹注册
if (senceVoiceService.isEnrollmentRequired()) {
  console.log('需要声纹注册')
}

// 检查是否需要关键词激活
if (senceVoiceService.isKeywordActivationRequired()) {
  console.log('需要关键词激活')
}
```

## 故障排除

### 常见问题

1. **连接失败**
   - 检查服务器是否启动：`netstat -an | findstr :8000`
   - 检查防火墙设置
   - 确认服务器地址和端口正确

2. **声纹注册失败**
   - 确保音频时长至少3秒
   - 检查音频格式是否正确
   - 确认麦克风权限已授予

3. **关键词激活失败**
   - 确认唤醒词发音准确
   - 检查音频质量
   - 尝试重置关键词状态

4. **语音识别准确率低**
   - 确保环境安静
   - 检查麦克风距离
   - 确认音频采样率设置

### 日志查看

#### 服务器日志
```bash
# 查看服务器日志文件
tail -f sencevoice_server.log
```

#### 客户端日志
```javascript
// 启用调试模式
senceVoiceConfig.features.debugMode = true

// 查看浏览器/React Native调试控制台
```

### 性能优化

1. **音频压缩**
   - 使用合适的音频格式和质量
   - 限制录音时长
   - 启用音频压缩（如果支持）

2. **网络优化**
   - 使用本地网络部署
   - 启用WebSocket压缩
   - 适当调整超时设置

3. **内存管理**
   - 及时清理临时音频文件
   - 限制并发请求数量
   - 定期重启长时间运行的服务

## 开发建议

### 集成步骤

1. **阶段1：基础连接**
   - 启动SenceVoice服务器
   - 实现WebSocket连接
   - 测试心跳和状态查询

2. **阶段2：声纹注册**
   - 实现声纹注册流程
   - 添加用户界面提示
   - 测试注册成功/失败场景

3. **阶段3：语音对话**
   - 实现完整语音对话流程
   - 添加关键词唤醒逻辑
   - 测试各种错误场景

4. **阶段4：优化和监控**
   - 添加性能监控
   - 优化用户体验
   - 完善错误处理

### 测试建议

1. **单元测试**
   - 测试WebSocket连接和断开
   - 测试消息序列化和反序列化
   - 测试错误处理逻辑

2. **集成测试**
   - 测试完整的语音对话流程
   - 测试声纹注册和验证
   - 测试网络异常恢复

3. **用户测试**
   - 测试不同用户的声纹识别
   - 测试各种环境下的语音识别
   - 测试长时间使用的稳定性

## 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 支持基础语音识别和对话
- 支持声纹注册和验证
- 支持关键词唤醒功能

## 支持和反馈

如遇到问题或需要技术支持，请：

1. 查看本文档的故障排除部分
2. 检查日志文件获取详细错误信息
3. 确认配置文件设置正确
4. 联系开发团队获取支持