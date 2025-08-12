# 数字人双工通信协议规范

## 🎯 概述

本文档定义了数字人对话系统中前端、后端WebSocket适配器和大模型端之间完整的双工通信协议规范，确保所有组件的消息格式、字段命名和JSON结构完全统一。

## 📋 组件架构

```
前端 (React Native)
    ↓ WebSocket
后端适配器 (websocket_llm_adapter.py) 
    ↓ 本地推理
大模型处理器 (LLMProcessor)
    
或者

前端 (React Native)
    ↓ WebSocket  
LLM响应接口 (llm_response.py)
    ↓ WebSocket
远程大模型服务器
```

## 🔌 WebSocket连接配置

### 连接端点
- **主服务器**: `ws://10.91.225.137:8000`
- **本地开发**: `ws://localhost:8000`
- **协议**: WebSocket (ws://)
- **超时设置**: 60秒
- **重连机制**: 最多10次重试，3秒间隔

### 连接参数
```json
{
  "timeout": 60000,
  "reconnectAttempts": 10,
  "reconnectDelay": 3000,
  "pingInterval": 20000,
  "maxMessageSize": 1048576
}
```

## 📨 消息格式规范

### 字段命名规则
- **顶级字段**: camelCase (`requestId`, `timestamp`)
- **data内字段**: snake_case (`prompt`, `system_prompt`, `conversation_history`, `max_tokens`)
- **消息类型**: snake_case (`llm_request`, `llm_response`)
- **时间戳**: JavaScript毫秒格式 (`Date.now()` / `int(time.time() * 1000)`)

### JSON编码规范
- **Python端**: `json.dumps(message, ensure_ascii=False)`
- **JavaScript端**: `JSON.stringify(message)`
- **字符编码**: UTF-8
- **中文支持**: 完整支持

## 🔄 完整消息流程

### 1. 前端发送LLM请求

**发送方**: React Native前端 (`ResponseLLMService.js`)
**接收方**: 后端WebSocket适配器

```json
{
  "type": "llm_request",
  "requestId": 123,
  "data": {
    "prompt": "用户输入的消息内容",
    "system_prompt": "你叫千问，是一个18岁的女大学生，性格活泼开朗，说话俏皮",
    "conversation_history": [
      {"role": "user", "content": "之前的用户消息"},
      {"role": "assistant", "content": "之前的AI回复"}
    ],
    "max_tokens": 512
  },
  "timestamp": 1672531200000
}
```

**前端代码实现**:
```javascript
const requestData = {
  type: 'llm_request',
  requestId: ++this.requestId,
  data: {
    prompt: userInput,
    conversation_history: conversationHistory,
    max_tokens: this.modelConfig.max_tokens,
    system_prompt: llmConfig.gabalong.system_prompt,
  },
  timestamp: Date.now(),
}
```

### 2. 后端处理和响应

**处理方**: WebSocket适配器 (`websocket_llm_adapter.py`) / LLM响应接口 (`llm_response.py`)

**字段提取**:
```python
request_id = data.get("requestId")
request_data = data.get("data", {})
prompt = request_data.get("prompt", "")
system_prompt = request_data.get("system_prompt")
conversation_history = request_data.get("conversation_history", [])
max_tokens = request_data.get("max_tokens", 512)
```

### 3. 大模型成功响应

**发送方**: 后端WebSocket适配器
**接收方**: React Native前端

```json
{
  "type": "llm_response",
  "requestId": 123,
  "success": true,
  "message": "你好！我是千问，很高兴和你聊天！",
  "timestamp": 1672531201000
}
```

**后端代码实现**:
```python
response = {
    "type": "llm_response",
    "requestId": request_id,
    "success": result["success"],
    "timestamp": int(time.time() * 1000)
}
if result["success"]:
    response["message"] = result["message"]
else:
    response["error"] = result["error"]
```

### 4. 大模型失败响应

```json
{
  "type": "llm_response",
  "requestId": 123,
  "success": false,
  "error": "模型处理失败: 输入过长",
  "timestamp": 1672531201000
}
```

### 5. 前端响应处理

**处理方**: React Native前端 (`ResponseLLMService.js`)

```javascript
handleWebSocketMessage(data) {
  if (data.type === 'llm_response' && data.requestId) {
    const request = this.pendingRequests.get(data.requestId)
    if (request) {
      clearTimeout(request.timeoutId)
      this.pendingRequests.delete(data.requestId)
      
      if (data.success) {
        request.resolve({
          success: true,
          message: data.message,
          timestamp: data.timestamp || Date.now(),
        })
      } else {
        request.reject(new Error(data.error || 'LLM processing failed'))
      }
    }
  }
}
```

## 🔧 错误处理机制

### 通用错误响应 (无requestId)

```json
{
  "type": "error",
  "error": "WebSocket connection failed",
  "timestamp": 1672531201000
}
```

### LLM特定错误响应 (有requestId)

```json
{
  "type": "llm_response",
  "requestId": 123,
  "success": false,
  "error": "Empty prompt provided",
  "timestamp": 1672531201000
}
```

### 前端错误处理

```javascript
} else if (data.type === 'error') {
  console.error('WebSocket通用错误:', data.error)
  if (data.requestId) {
    const request = this.pendingRequests.get(data.requestId)
    if (request) {
      clearTimeout(request.timeoutId)
      this.pendingRequests.delete(data.requestId)
      request.reject(new Error(data.error || 'Server error'))
    }
  }
}
```

## 💓 心跳检测机制

### Ping消息

```json
{
  "type": "ping",
  "timestamp": 1672531200000
}
```

### Pong响应

```json
{
  "type": "pong",
  "timestamp": 1672531200001
}
```

## 📊 数据结构定义

### LLMRequestData (Python)

```python
@dataclass
class LLMRequestData:
    prompt: str
    system_prompt: str = "你是一个友好的AI助手。"
    conversation_history: List[Dict[str, str]] = None
    max_tokens: int = 512
    temperature: float = 0.7
```

### LLMResponseData (Python)

```python
@dataclass
class LLMResponseData:
    success: bool
    message: str
    requestId: Union[str, int]  # 统一使用camelCase
    timestamp: float
    error: Optional[str] = None
    model_info: Optional[Dict[str, Any]] = None
    usage: Optional[Dict[str, Any]] = None
```

## 🎯 消息类型枚举

```python
class MessageType(Enum):
    LLM_REQUEST = "llm_request"
    LLM_RESPONSE = "llm_response"
    PING = "ping"
    PONG = "pong"
    ERROR = "error"
    STATUS = "status"
```

## 🚀 完整数字人对话流程

```
1. 用户语音输入 → STT转换
2. 前端发送 llm_request → 后端适配器
3. 后端提取字段 → 大模型处理
4. 大模型生成回复 → 后端封装响应
5. 后端发送 llm_response → 前端接收
6. 前端处理响应 → TTS语音播放
7. 数字人动画显示对话内容
```

## ✅ 验证清单

**字段命名一致性**:
- ✅ `requestId` (camelCase) - 所有组件统一
- ✅ `prompt` (snake_case) - 所有组件统一  
- ✅ `system_prompt` (snake_case) - 所有组件统一
- ✅ `conversation_history` (snake_case) - 所有组件统一
- ✅ `max_tokens` (snake_case) - 所有组件统一

**JSON格式一致性**:
- ✅ 请求格式: 前端发送 → 后端接收
- ✅ 响应格式: 后端发送 → 前端接收  
- ✅ 错误格式: 两种错误类型正确处理
- ✅ 时间戳格式: 统一JavaScript毫秒格式

**编码一致性**:
- ✅ Python端: `ensure_ascii=False`
- ✅ JavaScript端: 原生UTF-8支持
- ✅ 中文消息: 完整支持传输

## 📝 文件对应关系

**前端组件**:
- `src/services/ResponseLLMService.js` - LLM请求发送和响应处理
- `src/services/WebSocketService.js` - WebSocket连接管理
- `src/services/DigitalHumanService.js` - 数字人对话流程控制

**后端组件**:
- `response/websocket_llm_adapter.py` - WebSocket适配器和本地LLM
- `llm_response.py` - LLM响应接口（远程模型）
- `response/start_llm_server.py` - 服务器启动脚本

**配置文件**:
- `src/config/llmConfig.js` - 前端LLM配置
- `llm_config.yaml` - Python端LLM配置

---

**最后验证时间**: 2024-08-12  
**协议版本**: 1.0  
**兼容性**: 所有组件完全兼容统一格式 ✅