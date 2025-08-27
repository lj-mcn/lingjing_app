#!/bin/bash
# SiliconFlow 语音服务器启动脚本

echo "🚀 启动SiliconFlow语音服务器..."
echo "📍 服务类型: 云端TTS + 本地STT"
echo "💰 TTS价格: ￥105/百万UTF-8字节"

# 检查.env文件是否存在
if [ ! -f ".env" ]; then
    echo "❌ 未找到.env文件"
    echo "💡 请复制.env.example为.env并配置API密钥:"
    echo "   cp .env.example .env"
    echo "   编辑.env文件，设置SILICONFLOW_API_KEY"
    exit 1
fi

# 加载环境变量
set -a
source .env
set +a

# 检查API密钥
if [ -z "$SILICONFLOW_API_KEY" ] || [ "$SILICONFLOW_API_KEY" = "your_siliconflow_api_key_here" ]; then
    echo "❌ SiliconFlow API密钥未配置"
    echo "💡 请在.env文件中设置SILICONFLOW_API_KEY"
    echo "   获取API密钥: https://cloud.siliconflow.cn"
    exit 1
fi

# 检查Python依赖
echo "🔍 检查依赖..."
python3 -c "import aiohttp, websockets" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ 缺少必要的Python依赖"
    echo "💡 安装依赖:"
    echo "   pip3 install aiohttp websockets torch"
    exit 1
fi

# 检查SiliconFlow TTS模块
python3 -c "from siliconflow_tts import SiliconFlowTTS" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ 无法导入siliconflow_tts模块"
    echo "💡 请确保siliconflow_tts.py文件存在"
    exit 1
fi

echo "✅ 依赖检查通过"
echo ""

# 启动服务器
echo "🎵 启动SiliconFlow语音服务器..."
python3 VoiceServer_SiliconFlow.py --host 0.0.0.0 --port 8001 "$@"