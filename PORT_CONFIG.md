# 项目端口配置文档

## 🔌 主要端口配置

### 大模型服务器端口 (后端)
- **主服务器**: `ws://10.91.225.137:8000`
- **备用服务器1**: `ws://10.91.225.138:8000` 
- **备用服务器2**: `ws://10.91.225.139:8000`
- **Python启动默认**: `localhost:8000`

### 前端WebSocket端口 (数字人动画)
- **主服务**: `ws://localhost:3000/ws`

## 📋 配置文件位置

### 前端配置
```javascript
// src/config/llmConfig.js:32
websocketUrl: 'ws://10.91.225.137:8000'

// .env:6
LLM_SERVER_URL=ws://10.91.225.137:8000

// .env:21
WEBSOCKET_URL=ws://localhost:3000/ws
```

### 后端配置
```python
# response/websocket_llm_adapter.py:111
def __init__(self, host="localhost", port=8000):

# response/start_llm_server.py:29
port = 8000
```

## 🚀 启动命令配置

### 后端大模型服务器启动
```bash
# 默认启动 (localhost:8000)
python websocket_llm_adapter.py

# 指定IP和端口启动
python websocket_llm_adapter.py --host 0.0.0.0 --port 8000

# 通过启动脚本
python start_llm_server.py [host] [port]
```

### 前端React Native启动
```bash
# 启动前端应用
npm start
# 或
yarn start
```

## 🌐 网络配置说明

### 连接参数
- **内网IP**: `10.91.225.137` (当前配置的同学电脑IP)
- **端口开放**: 需要确保防火墙开放8000端口
- **协议**: WebSocket (ws://)
- **超时设置**: 60秒
- **重连机制**: 10次重试，3秒间隔

### 防火墙配置
```bash
# Linux防火墙开放8000端口
sudo iptables -A INPUT -p tcp --dport 8000 -j ACCEPT

# macOS防火墙 (通过系统偏好设置或命令行配置)
```

## 📡 接口通信格式

### 前端发送格式
```json
{
  "type": "llm_request",
  "requestId": 123,
  "data": {
    "prompt": "用户输入内容",
    "systemPrompt": "系统提示词",
    "conversationHistory": [],
    "maxTokens": 512
  },
  "timestamp": 1648888888888
}
```

### 后端响应格式
```json
{
  "type": "llm_response",
  "requestId": 123,
  "success": true,
  "message": "大模型回复内容",
  "timestamp": 1648888888888
}
```

## 🔧 故障排查

### 连接测试
```bash
# 测试WebSocket连接
wscat -c ws://10.91.225.137:8000

# 检查端口占用
lsof -i :8000

# 网络连通性测试
ping 10.91.225.137
telnet 10.91.225.137 8000
```

### 常见问题
1. **连接超时**: 检查网络连通性和防火墙设置
2. **端口占用**: 使用`lsof -i :8000`检查端口状态
3. **IP地址变化**: 确认大模型服务器的实际IP地址
4. **服务未启动**: 确认后端Python服务正在运行

## 📝 配置更新步骤

### 更改大模型服务器地址
1. 修改 `src/config/llmConfig.js` 中的 `websocketUrl`
2. 修改 `.env` 文件中的 `LLM_SERVER_URL`
3. 重启前端应用

### 更改服务器端口
1. 修改后端启动命令的 `--port` 参数
2. 同步更新前端配置文件中的端口号
3. 重启前后端服务

## 📄 相关文件列表

### 前端文件
- `src/config/llmConfig.js` - LLM配置文件
- `src/services/ResponseLLMService.js` - LLM服务类
- `src/services/WebSocketService.js` - WebSocket服务类
- `.env` - 环境变量配置

### 后端文件
- `response/websocket_llm_adapter.py` - WebSocket LLM适配器
- `response/start_llm_server.py` - 服务器启动脚本
- `response/requirements.txt` - Python依赖

### 文档文件
- `REMOTE_LLM_SETUP.md` - 远程LLM部署文档
- `DEBUG_CHECKLIST.md` - 调试检查清单
- `LLM_SETUP_SIMPLE.md` - LLM简单设置指南

---
*最后更新: 2025-08-11*