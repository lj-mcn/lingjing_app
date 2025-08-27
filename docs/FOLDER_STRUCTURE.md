# 项目文件夹结构说明

## 📁 整理后的项目结构

```
lingjing_app/
├── 📂 docs/                          # 项目文档
│   ├── AEC_INTEGRATION_GUIDE.md      # AEC集成指南
│   ├── AEC_TEST_GUIDE.md             # AEC测试指南
│   ├── ANDROID_AEC_TROUBLESHOOTING.md # Android AEC故障排除
│   ├── API_CORRECTIONS.md            # API修正说明
│   ├── COSYVOICE_SETUP_GUIDE.md      # CosyVoice设置指南
│   ├── DEBUG_CHECKLIST.md            # 调试检查清单
│   ├── MODEL_OPTIMIZATION_GUIDE.md   # 模型优化指南
│   ├── PORT_CONFIG.md                # 端口配置
│   ├── PROJECT_SUMMARY.md            # 项目总结
│   ├── README.md                     # 项目说明
│   ├── REMOTE_LLM_SETUP.md           # 远程LLM设置
│   ├── STREAMING_STT_USAGE.md        # 流式STT使用指南
│   ├── VOICE_MODELS_SETUP_GUIDE.md   # 语音模型设置指南
│   ├── WEBSOCKET_INTERFACE_UNIFIED.md # WebSocket接口文档
│   └── FOLDER_STRUCTURE.md           # 本文件结构说明
│
├── 📂 server/                         # 服务器文件
│   ├── VoiceServer.py                # 主要语音服务器
│   ├── VoiceServer_SiliconFlow.py    # SiliconFlow语音服务器
│   ├── sencevoice_websocket_server.py # SenceVoice WebSocket服务器
│   ├── websocket_llm_server.py       # WebSocket LLM服务器
│   └── siliconflow_tts.py            # SiliconFlow TTS服务
│
├── 📂 scripts/                        # 安装和启动脚本
│   ├── InstallVoiceModels.py         # 语音模型安装脚本
│   ├── install_cosyvoice.py          # CosyVoice安装脚本
│   ├── start_sencevoice_server.py    # SenceVoice服务器启动脚本
│   └── start_siliconflow_voice_server.sh # SiliconFlow服务器启动脚本
│
├── 📂 src/                            # React Native源代码
│   ├── 📂 components/                 # UI组件
│   ├── 📂 config/                     # 配置文件
│   │   ├── AppConfig.js              # 应用配置
│   │   ├── llmConfig.js              # LLM配置
│   │   ├── llm_config.yaml           # LLM YAML配置
│   │   ├── senceVoiceConfig.js       # SenceVoice配置
│   │   └── sencevoice_server_config.yaml # SenceVoice服务器配置
│   ├── 📂 context/                    # React Context
│   ├── 📂 routes/                     # 路由配置
│   ├── 📂 scenes/                     # 页面场景
│   ├── 📂 services/                   # 业务服务
│   │   ├── 📂 assistant/              # 数字助手服务
│   │   ├── 📂 chat/                   # 聊天服务
│   │   ├── 📂 connection/             # 连接管理
│   │   └── 📂 voice/                  # 语音服务
│   ├── 📂 theme/                      # 主题样式
│   └── 📂 utils/                      # 工具函数
│
├── 📂 assets/                         # 静态资源
│   ├── 📂 fonts/                      # 字体文件
│   ├── 📂 images/                     # 图片资源
│   ├── 📂 lottie/                     # Lottie动画
│   ├── 📂 music/                      # 音频文件
│   └── 📂 videos/                     # 视频文件
│
├── 📂 functions/                      # 云函数
├── 📂 response/                       # LLM响应处理
├── 📂 lib/                           # 库文件
├── 📂 __tests__/                     # 测试文件
│
├── App.js                            # 应用入口
├── package.json                      # NPM依赖配置
├── babel.config.js                   # Babel配置
├── metro.config.js                   # Metro打包配置
├── tsconfig.json                     # TypeScript配置
├── eas.json                         # Expo Application Services配置
├── app.json                         # Expo应用配置
└── LICENSE                          # 许可证
```

## 📋 文件夹分类说明

### 📂 docs/ - 文档文件夹
存放所有项目相关文档，包括：
- **设置指南**: 各种服务的安装和配置说明
- **API文档**: 接口和功能说明
- **故障排除**: 常见问题解决方案
- **项目说明**: 架构和设计文档

### 📂 server/ - 服务器文件夹
存放所有Python服务器文件，包括：
- **语音服务器**: 处理STT/TTS功能
- **LLM服务器**: 大语言模型服务
- **WebSocket服务**: 实时通信服务

### 📂 scripts/ - 脚本文件夹
存放安装和启动脚本，包括：
- **安装脚本**: 自动安装语音模型和依赖
- **启动脚本**: 快速启动各种服务

### 📂 src/config/ - 配置文件夹（增强）
现在包含所有配置文件：
- **JavaScript配置**: React Native应用配置
- **YAML配置**: 服务器和模型配置

## 🎯 整理的好处

1. **清晰分类**: 文件按功能分组，便于查找
2. **文档集中**: 所有说明文档在docs文件夹中
3. **服务独立**: 服务器文件单独管理
4. **脚本统一**: 工具脚本集中存放
5. **配置整合**: 相关配置文件集中管理

## 💡 使用建议

- 📖 **查看文档**: 从 `docs/README.md` 开始
- 🖥️ **启动服务**: 使用 `scripts/` 中的脚本
- ⚙️ **修改配置**: 查看 `src/config/` 文件夹
- 🔧 **服务器**: 直接运行 `server/` 中的Python文件

这样的结构让项目更加整洁和专业！