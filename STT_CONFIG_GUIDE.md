# 🎙️ 语音识别配置指南

## 当前状态
✅ **语音录制功能正常** - 应用可以录制真实的用户语音  
❌ **语音识别待配置** - 需要配置语音识别服务来理解录音内容

## 快速配置方案

### 方案1：OpenAI Whisper API（推荐）

**优点：** 准确率极高，支持中文，响应快
**费用：** $0.006/分钟（约0.04元/分钟）

#### 配置步骤：

1. **获取API密钥**
   - 访问：https://platform.openai.com/account/api-keys
   - 注册并创建API密钥

2. **配置方式A：环境变量**
   ```bash
   # 编辑 .env 文件
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

3. **配置方式B：直接填写**
   ```javascript
   // 编辑 src/config/llmConfig.js
   openai: {
     apiKey: 'sk-your-actual-api-key-here',
     // ... 其他配置保持不变
   }
   ```

### 方案2：Azure语音服务

**优点：** 免费额度较大，微软服务稳定
**费用：** 每月5小时免费

#### 配置步骤：

1. **获取密钥**
   - 访问：https://portal.azure.com/
   - 创建"语音服务"资源

2. **配置**
   ```javascript
   // 编辑 src/config/llmConfig.js
   azure: {
     subscriptionKey: 'your-azure-key-here',
     region: 'eastus', // 你的服务区域
     language: 'zh-CN',
     enabled: true
   }
   ```

## 配置验证

配置完成后，重启应用，查看日志：
- ✅ `"OpenAI API密钥已配置，启用Whisper语音识别"`
- ✅ `"使用openai进行语音识别"`（而不是"使用简化版本"）

## 测试功能

1. **录音测试**：点击开始录音，说话后停止
2. **识别验证**：查看是否正确识别了语音内容
3. **对话测试**：完整测试语音对话功能

## 费用参考

- **OpenAI Whisper**：约每分钟0.04元
- **Azure语音**：每月5小时免费，超出后约每分钟0.03元

## 故障排除

如果仍然显示"使用简化版本"：
1. 检查API密钥是否正确填写
2. 检查网络连接
3. 查看控制台错误信息
4. 确认API账户有足够余额

## 技术说明

当前系统优先级：
1. OpenAI Whisper（最准确）
2. Azure语音服务（免费额度大）
3. Expo Speech Recognition（本地，但不可用）
4. Web Speech API（仅Web平台）
5. 简化版本（当前状态，仅用于测试）

配置任一服务后，系统会自动选择最佳可用服务进行语音识别。