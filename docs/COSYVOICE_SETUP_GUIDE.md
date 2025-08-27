# CosyVoice TTS模型配置指南

## 概述

本项目已从Kokoro TTS切换到CosyVoice TTS模型，提供更好的多语言语音合成能力。

## CosyVoice特性

- 🌍 **多语言支持**: 中文、英文、日文、韩文及中文方言
- 🎯 **零样本语音克隆**: 无需训练即可克隆任意声音
- ⚡ **超低延迟**: 延迟低至150ms
- 🎭 **情感语音合成**: 支持多种情感表达
- 🔄 **跨语言合成**: 支持不同语言间的声音转换

## 快速安装

### 1. 运行安装脚本

```bash
# 安装CosyVoice及其依赖
python install_cosyvoice.py

# 或指定自定义安装目录
python install_cosyvoice.py --install-dir ./my_cosyvoice --env-name my_env
```

### 2. 下载预训练模型

安装脚本会提示下载以下模型：

- **CosyVoice2-0.5B**: 主要的TTS模型
- 访问 https://huggingface.co/FunAudioLLM/CosyVoice2-0.5B
- 将模型文件下载到 `cosyvoice_models/CosyVoice/pretrained_models/CosyVoice2-0.5B/`

### 3. 测试安装

```bash
python test_cosyvoice.py
```

### 4. 启动语音服务

```bash
./start_cosyvoice_server.sh
```

## 手动安装步骤

如果自动安装脚本失败，可以手动执行以下步骤：

### 1. 克隆CosyVoice仓库

```bash
git clone https://github.com/FunAudioLLM/CosyVoice.git
cd CosyVoice
```

### 2. 创建Conda环境

```bash
conda create -n cosyvoice python=3.10
conda activate cosyvoice
```

### 3. 安装依赖

```bash
pip install -r requirements.txt
pip install torch torchvision torchaudio
pip install scipy soundfile
```

### 4. 下载模型

从Hugging Face下载预训练模型到 `pretrained_models/` 目录。

## API使用示例

### 基础语音合成

```python
from cosyvoice.cli.cosyvoice import CosyVoice2

# 初始化模型
cosyvoice = CosyVoice2('pretrained_models/CosyVoice2-0.5B')

# 预训练语音合成
for output in cosyvoice.inference_sft('你好，我是CosyVoice', '中文女'):
    audio = output["tts_speech"]
    break
```

### 零样本语音克隆

```python
# 零样本语音克隆
prompt_speech = torch.load('reference_audio.pt')
for output in cosyvoice.inference_zero_shot('Hello, this is cloned voice', 'Reference text', prompt_speech):
    audio = output["tts_speech"]
    break
```

### 跨语言合成

```python
# 跨语言语音合成
for output in cosyvoice.inference_cross_lingual('Hello world', prompt_speech):
    audio = output["tts_speech"]
    break
```

## 配置参数

### AppConfig.js配置更新

```javascript
tts: {
  model: 'CosyVoice2-0.5B',
  voice_style: '中文女',
  format: 'wav',
  sample_rate: 22050,
  available_speakers: ['中文女', '中文男', '英文女', '英文男', '日语女', '韩语女', '粤语女', '四川话女'],
  supports_zero_shot: true,
  supports_cross_lingual: true,
}
```

### 可用的预训练语音

- `中文女` - 标准中文女声
- `中文男` - 标准中文男声  
- `英文女` - 英文女声
- `英文男` - 英文男声
- `日语女` - 日语女声
- `韩语女` - 韩语女声
- `粤语女` - 粤语女声
- `四川话女` - 四川话女声

## WebSocket API

### TTS请求格式

```json
{
  "type": "tts_request",
  "requestId": "unique_id",
  "data": {
    "text": "要合成的文本",
    "voice_style": "中文女",
    "speaker_name": "中文女"
  }
}
```

### 响应格式

```json
{
  "type": "tts_response",
  "requestId": "unique_id",
  "success": true,
  "timestamp": 1635724800000,
  "audio_data": "base64_encoded_audio",
  "format": "wav",
  "model": "CosyVoice2-0.5B",
  "voice_style": "中文女",
  "sample_rate": 22050
}
```

## 服务器启动

### 使用启动脚本

```bash
./start_cosyvoice_server.sh
```

### 手动启动

```bash
conda activate cosyvoice
export PYTHONPATH="./cosyvoice_models/CosyVoice:$PYTHONPATH"
python VoiceServer.py --cosyvoice-path ./cosyvoice_models/CosyVoice/pretrained_models/CosyVoice2-0.5B
```

### 启动参数

- `--host`: 服务器地址 (默认: 0.0.0.0)
- `--port`: 服务器端口 (默认: 8001)
- `--cosyvoice-path`: CosyVoice模型路径

## 故障排除

### 常见问题

1. **模型加载失败**
   ```
   解决方案：检查模型文件是否下载完整，路径是否正确
   ```

2. **依赖安装失败**
   ```bash
   # 更新pip
   pip install --upgrade pip
   # 清理缓存后重新安装
   pip cache purge
   pip install -r requirements.txt
   ```

3. **内存不足**
   ```
   解决方案：使用更小的模型或增加系统内存
   ```

4. **CUDA相关错误**
   ```bash
   # 安装正确的PyTorch版本
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
   ```

### 日志调试

启动服务时会生成日志文件：
- `voice_service.log` - 语音服务日志
- `sencevoice_server.log` - SenceVoice服务日志

### 性能优化

1. **GPU加速**: 确保CUDA可用以提高合成速度
2. **内存管理**: 定期清理音频缓存
3. **并发控制**: 限制同时处理的请求数量

## 从Kokoro TTS迁移

### 主要变化

1. **模型名称**: `kokoro-v0_19` → `CosyVoice2-0.5B`
2. **采样率**: `16000Hz` → `22050Hz`
3. **语音选项**: `default` → `中文女`等具体语音名称
4. **新增功能**: 零样本克隆、跨语言合成

### 代码更新

原有的Kokoro TTS调用需要更新：

```python
# 旧代码
result = kokoro_tts.generate(text, voice='default')

# 新代码  
for output in cosyvoice.inference_sft(text, '中文女'):
    result = output["tts_speech"]
    break
```

## 支持和文档

- **官方文档**: https://github.com/FunAudioLLM/CosyVoice
- **模型下载**: https://huggingface.co/FunAudioLLM/CosyVoice2-0.5B
- **问题反馈**: 请在项目仓库创建Issue

## 更新日志

### v2.0 (CosyVoice集成)
- ✅ 替换Kokoro TTS为CosyVoice2-0.5B
- ✅ 添加多语言支持
- ✅ 支持零样本语音克隆
- ✅ 增加跨语言合成功能
- ✅ 更新配置和启动脚本
- ✅ 添加自动安装脚本