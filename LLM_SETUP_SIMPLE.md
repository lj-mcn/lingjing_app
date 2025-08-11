# 大模型配置简易指南

## 🎯 目标
使用你们自己的大模型，不使用OpenAI API。

## 📋 你需要做的事

### 1. 获取同学电脑的IP地址
在同学的电脑上运行：
```bash
# Windows
ipconfig

# macOS/Linux  
ifconfig
```

### 2. 更新配置文件
编辑 `.env` 文件，设置同学电脑的IP：
```env
LLM_SERVER_URL=ws://10.91.225.137:8000
```

### 3. 让同学启动LLM服务器
在同学的电脑上：
```bash
cd response/
python start_llm_server.py 0.0.0.0 8000
```

### 4. 测试连接
在你的电脑上：
```bash
ping 10.91.225.137
```

## ✅ 完成！

现在你的应用会：
- ✅ 使用你们自己的大模型进行对话
- ✅ 语音功能使用内置模拟（不需要外部API）
- ❌ 不需要OpenAI API Key
- ❌ 不需要付费服务

## 🔧 如果出现问题

1. **连接失败**：检查IP地址和网络连接
2. **服务器无响应**：确保同学的电脑启动了LLM服务
3. **防火墙阻止**：让同学开放8000端口

## 📁 项目结构
```
你的项目/
├── .env                     # 配置文件（包含同学电脑IP）
├── src/services/
│   ├── ResponseLLMService.js # 连接自己的LLM
│   └── STTTTSService.js     # 语音功能（模拟模式）
└── response/
    ├── websocket_llm_adapter.py # LLM服务器代码
    └── start_llm_server.py      # 启动脚本
```

完全不依赖OpenAI，使用你们自己的技术栈！