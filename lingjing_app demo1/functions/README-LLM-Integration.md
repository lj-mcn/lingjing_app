# LLM集成使用说明

## 概述
已成功集成真实的LLM API接口，支持WebSocket和HTTP两种连接方式。

## 配置方法

### 1. 环境变量配置
复制 `.env.example` 文件并重命名为 `.env`：
```bash
cp .env.example .env
```

### 2. 配置LLM接口
在 `.env` 文件中设置：

#### 使用WebSocket接口（推荐）
```bash
LLM_API_URL=ws://localhost:8765
LLM_API_KEY=your_api_key_here
LLM_MODEL=default
```

#### 使用HTTP API接口
```bash
LLM_API_URL=https://your-llm-api.com/v1/chat/completions
LLM_API_KEY=your_api_key_here
LLM_MODEL=gpt-3.5-turbo
```

### 3. 安装依赖
```bash
npm install
```

## 功能特性

### 1. 智能连接类型检测
- 自动检测URL类型（WebSocket vs HTTP）
- 根据连接类型选择合适的调用方式

### 2. WebSocket连接支持
- 支持 `ws://localhost:8765` 实时对话接口
- 自动处理连接、消息发送和接收
- 30秒超时保护

### 3. HTTP API支持
- 支持标准REST API接口
- 支持OpenAI、Claude等API格式
- 自动Bearer token认证

### 4. 错误处理和降级
- API调用失败时自动使用备用响应
- 详细的错误日志记录
- 用户友好的错误信息

## 使用方法

### 在代码中调用
```javascript
const llmService = require('./services/llmService')

// 生成回复
const response = await llmService.generateResponse("你好，请介绍一下自己")

// 带上下文的回复
const contextualResponse = await llmService.generateContextualResponse(
  "继续刚才的话题", 
  { conversationHistory: [...], userProfile: {...} }
)
```

### WebSocket消息格式
发送消息：
```json
{
  "type": "text",
  "data": "用户输入的文本",
  "model": "default"
}
```

期望的返回格式：
```json
{
  "status": "success",
  "llm_response": "AI生成的回复文本"
}
```

## 测试接口

### 1. 启动服务
```bash
npm run serve
```

### 2. 测试WebSocket连接
你可以使用浏览器控制台或Node.js脚本测试：
```javascript
const ws = new WebSocket('ws://localhost:8765');
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'text',
    data: '你好',
    model: 'default'
  }));
});
```

## 错误排查

### 1. 连接失败
- 检查 `LLM_API_URL` 是否正确
- 确认LLM服务是否已启动
- 检查防火墙设置

### 2. 认证失败
- 检查 `LLM_API_KEY` 是否有效
- 确认API密钥格式是否正确

### 3. 超时错误
- 检查网络连接
- 调整timeout设置（当前为30秒）

## 更新内容

### 已删除的文件
- `test-websocket-client.js`
- `test-websocket-with-audio.js`
- `test-websocket.js`
- `test-cosyvoice-integration.js`
- `websocket-client-example.html`
- `test-audio/` 目录

### 新增功能
- 真实LLM API集成
- 环境变量配置支持
- WebSocket和HTTP双重支持
- 智能降级机制

现在你的LLM服务已经可以连接到真实的AI接口了！