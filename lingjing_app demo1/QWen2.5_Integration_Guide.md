# QWen2.5大模型集成指南

## 概述

本指南描述了如何在现有的语音聊天系统中集成QWen2.5大模型，使用WebSocket通信协议。

## 文件修改说明

### 1. 大模型服务 (13_SenceVoice_QWen2.5_edgeTTS_realTime.py)

**修改内容:**
- 移除了语音识别(SenceVoice)和语音合成(EdgeTTS)相关代码
- 保留了QWen2.5大模型核心推理功能  
- 添加了WebSocket服务器实现
- 提供`/llm/chat`接口用于文本对话

**主要功能:**
- 启动WebSocket服务器 (ws://localhost:8765)
- 接收文本输入并返回QWen2.5模型生成的回复
- 支持ping/pong心跳检测
- 错误处理和状态反馈

### 2. LLM服务 (functions/services/llmService.js)

**修改内容:**
- 更新API URL为WebSocket地址 (ws://localhost:8765)
- 保持现有的WebSocket通信逻辑
- 模型名称更新为 "Qwen2.5-1.5B-Instruct"

### 3. 前端应用 (VoiceChat组件)

**无需修改** - 现有的WebSocket通信机制可以直接使用

## 启动步骤

### 1. 启动QWen2.5大模型服务

```bash
cd "ASR-LLM-TTS-master/ASR-LLM-TTS-master/ASR-LLM-TTS-master"
python 13_SenceVoice_QWen2.5_edgeTTS_realTime.py
```

服务将在 `ws://localhost:8765` 启动

### 2. 启动WebSocket中转服务

```bash
cd functions
npm install
node websocketService.js
```

服务将在 `http://localhost:8080` 启动

### 3. 启动React Native应用

```bash
npx expo start
```

### 4. 测试集成

运行测试脚本验证QWen2.5服务：

```bash
python test_qwen_integration.py
```

## 通信流程

1. **用户录音** → React Native VoiceChat组件
2. **音频数据** → WebSocket中转服务 (localhost:8080)
3. **语音识别** → 现有STT服务
4. **文本对话** → QWen2.5 WebSocket服务 (localhost:8765)
5. **模型响应** → 返回给WebSocket中转服务
6. **语音合成** → 现有TTS服务
7. **音频播放** → React Native应用

## WebSocket消息格式

### 发送给QWen2.5服务

```json
{
  "type": "text",
  "data": "用户输入的文本",
  "model": "Qwen2.5-1.5B-Instruct"
}
```

### QWen2.5服务响应

```json
{
  "status": "success",
  "llm_response": "模型生成的回复",
  "model": "Qwen2.5-1.5B-Instruct"
}
```

## 注意事项

1. **模型路径**: 确保QWen2.5模型文件路径正确
2. **端口配置**: 确保8765端口未被占用
3. **依赖安装**: 需要安装`websockets`库: `pip install websockets`
4. **内存要求**: QWen2.5-1.5B模型需要足够的显存/内存
5. **网络配置**: 确保防火墙允许8765端口访问

## 故障排除

- **连接失败**: 检查QWen2.5服务是否正常启动
- **模型加载错误**: 验证模型路径和权限
- **内存不足**: 考虑使用更小的模型版本
- **响应超时**: 增加WebSocket超时设置

## 扩展功能

可以根据需要扩展以下功能：
- 多模型支持
- 对话历史管理
- 性能监控
- 负载均衡