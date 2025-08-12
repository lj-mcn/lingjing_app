# WebSocket LLM Server

基于大模型组的模型，提供WebSocket接口的LLM响应服务。

## 功能特性

- 基于Qwen2.5模型的中文对话生成
- WebSocket实时通信
- 支持对话历史上下文
- 可配置系统提示
- 轻量级架构，专注于LLM响应生成

## 安装依赖

```bash
pip install -r requirements.txt
```

## 启动服务

### 方式1: 使用启动脚本（推荐）
```bash
python start_llm_server.py
```

### 方式2: 直接启动
```bash
python websocket_llm_adapter.py --host localhost --port 8000
```

### 自定义参数
```bash
# 指定主机和端口
python start_llm_server.py 0.0.0.0 8080

# 或使用命令行参数
python websocket_llm_adapter.py --host 0.0.0.0 --port 8080 --model "Qwen/Qwen2.5-7B-Instruct"
```

## WebSocket API

### 请求格式
```json
{
  "type": "llm_request",
  "requestId": 1,
  "data": {
    "prompt": "你好",
    "systemPrompt": "你是一个友好的助手",
    "conversationHistory": [
      {"role": "user", "content": "之前的问题"},
      {"role": "assistant", "content": "之前的回答"}
    ],
    "maxTokens": 512
  },
  "timestamp": 1642147200000
}
```

### 响应格式
```json
{
  "type": "llm_response",
  "requestId": 1,
  "success": true,
  "message": "你好！我是千问，很高兴和你聊天！",
  "timestamp": 1642147201000
}
```

### 错误响应
```json
{
  "type": "llm_response",
  "requestId": 1,
  "success": false,
  "error": "错误信息",
  "timestamp": 1642147201000
}
```

## 与前端集成

该服务已经与React Native应用的`ResponseLLMService`和`DigitalHumanService`集成。

默认WebSocket地址: `ws://localhost:8000/ws/llm`

## 系统要求

- Python 3.8+
- PyTorch 2.0+
- 8GB+ RAM (推荐16GB)
- CUDA支持的GPU (可选，但推荐用于更快的推理)

## 注意事项

1. 首次运行会自动下载模型文件，需要良好的网络连接
2. 模型加载需要几分钟时间，请耐心等待
3. 如需使用其他模型，请确保模型兼容Transformers库