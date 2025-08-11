# Expo Go 语音聊天测试指南

## 🎯 功能概述

这个 Expo 应用集成了 CosyVoice TTS 模型，提供完整的语音对话功能：

- 🎤 语音录制
- 🔊 语音识别（STT）
- 🤖 AI 对话（LLM）  
- 🎵 语音合成（CosyVoice TTS）
- 📱 实时 WebSocket 通信

## 📱 在 Expo Go 中测试

### 1. 准备工作

#### 安装 Expo Go
- iOS: [App Store 下载](https://apps.apple.com/app/expo-go/id982107779)
- Android: [Google Play 下载](https://play.google.com/store/apps/details?id=host.exp.exponent)

#### 启动后端服务

**方式1：本地测试**
```bash
# 1. 启动 CosyVoice TTS 服务
cd /path/to/cosyvoice
python runtime/python/fastapi/server.py --port 50000 --model_dir iic/CosyVoice-300M

# 2. 启动 WebSocket 服务器
cd "C:\Users\liu\lingjing_app demo1\functions"
node test-websocket.js
```

**方式2：Firebase Functions**
```bash
cd functions
firebase deploy --only functions
```

### 2. 启动 Expo 项目

```bash
cd "C:\Users\liu\lingjing_app demo1"
npm start
# 或
npx expo start
```

### 3. 配置网络

#### 重要：确保设备在同一网络
- 手机和开发机必须在同一个 WiFi 网络
- 关闭防火墙或允许端口 8080
- 查看开发机的 IP 地址：
  ```bash
  # Windows
  ipconfig
  # Mac/Linux  
  ifconfig
  ```

#### 更新 WebSocket URL
在 app 的语音聊天页面中，修改服务器地址：
- 本地测试：`ws://192.168.1.x:8080` (替换 x 为您的 IP)
- Firebase：`wss://your-project.cloudfunctions.net/websocketService`

### 4. 使用步骤

1. **打开 Expo Go**
   - 扫描终端显示的二维码
   - 或输入 expo:// URL

2. **进入语音聊天**
   - 点击首页的 "🎤 CosyVoice 语音聊天" 按钮

3. **配置连接**
   - 修改 WebSocket 服务器地址
   - 点击 "连接服务器"

4. **选择 TTS 设置**
   - TTS 模式：SFT（基础）或指令（高级）
   - 说话人：中文女/中文男

5. **开始对话**
   - 点击 🎤 录音按钮开始录音
   - 再次点击停止录音并发送
   - 等待处理：STT → LLM → TTS
   - 自动播放 AI 回复的语音

## 🔧 故障排除

### 常见问题

#### 1. WebSocket 连接失败
```
❌ WebSocket 连接错误
```
**解决方案：**
- 检查服务器地址是否正确
- 确认后端服务正在运行
- 验证网络连接（手机和电脑在同一 WiFi）
- 关闭防火墙或允许端口 8080

#### 2. 录音权限问题
```
❌ 无法获取音频权限
```
**解决方案：**
- iOS：设置 > 隐私 > 麦克风 > Expo Go > 开启
- Android：设置 > 应用权限 > Expo Go > 麦克风 > 允许

#### 3. 音频播放失败
```
❌ 音频播放失败
```
**解决方案：**
- 检查音频 URL 是否有效
- 确认网络连接稳定
- 重启应用重试

#### 4. CosyVoice 服务错误
```
❌ TTS generation failed
```
**解决方案：**
- 确认 CosyVoice 服务运行在端口 50000
- 检查环境变量 `COSYVOICE_API_URL`
- 查看 CosyVoice 服务日志

### 调试技巧

#### 1. 查看控制台日志
```bash
# Expo 开发工具
npx expo start
# 然后在浏览器中查看 Logs 标签页
```

#### 2. 网络连接测试
```bash
# 测试 WebSocket 服务
curl http://192.168.1.x:8080/health

# 测试 CosyVoice 服务  
curl http://localhost:50000/
```

#### 3. 手机端调试
- 摇晃设备打开 Expo 开发菜单
- 选择 "Toggle Performance Monitor"
- 查看实时性能和错误信息

## 📊 性能优化

### 音频设置
- 录音格式：WAV (22050Hz, 单声道)
- 录音时长：建议 10-30 秒
- 文件大小：限制在 5MB 以内

### 网络优化
- 使用稳定的 WiFi 连接
- 避免在高延迟网络下测试
- 考虑使用本地网络进行初步测试

## 🎛️ 高级功能

### TTS 模式详解

#### SFT 模式（推荐）
- 最稳定的基础语音合成
- 支持多种预训练说话人
- 延迟最低，质量稳定

#### 指令模式
- 可以通过指令控制语音风格
- 例如："温柔地朗读"、"激动地说话"
- 需要额外的指令文本输入

#### Zero-shot 模式（需要扩展）
- 声音克隆功能
- 需要提供示例音频
- 适合个性化语音合成

### 自定义配置

#### 修改默认说话人
编辑 `functions/config/cosyvoice.js`:
```javascript
defaults: {
  spkId: "中文男", // 改为中文男
  mode: "instruct", // 改为指令模式
}
```

#### 添加新的说话人
```javascript
availableSpkIds: [
  "中文女",
  "中文男", 
  "英文女",
  "英文男",
  "日文女",
  // 添加更多说话人...
]
```

## 🚀 部署到生产环境

### Firebase 部署
```bash
# 部署 Functions
cd functions
firebase deploy --only functions

# 获取 Functions URL
firebase functions:list
```

### 域名配置
- 申请 SSL 证书
- 配置 HTTPS/WSS 端点
- 更新客户端 WebSocket URL

## 📞 技术支持

如果遇到问题，请检查：
1. 后端服务状态
2. 网络连接情况  
3. 设备权限设置
4. Expo Go 版本兼容性

---

🎉 **现在您可以用 Expo Go 体验 CosyVoice 语音聊天了！**