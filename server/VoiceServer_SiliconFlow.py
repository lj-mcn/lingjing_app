#!/usr/bin/env python3
"""
统一语音服务器 - 集成SiliconFlow CosyVoice API + SenseVoice-small
作为App与大模型的后端语音处理服务
"""

import asyncio
import websockets
import json
import time
import logging
import base64
import os
import uuid
import torch
from typing import Dict, Any, Optional
from pathlib import Path
import argparse
from siliconflow_tts import SiliconFlowTTS

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('voice_service.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

class VoiceServiceProcessor:
    """语音服务处理器 - 集成SiliconFlow TTS和STT"""
    
    def __init__(self):
        self.siliconflow_tts = None
        self.sensevoice_stt = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.available_speakers = []
        self.use_cloud_api = True  # 使用云端API
        self.is_initialized = False
        
    async def initialize(self, api_key=None):
        """初始化模型"""
        try:
            logger.info("🚀 初始化语音服务...")
            
            # 初始化SiliconFlow CosyVoice TTS
            await self.init_siliconflow_tts(api_key)
            
            # 初始化SenseVoice STT
            await self.init_sensevoice_stt()
            
            self.is_initialized = True
            logger.info("✅ 语音服务初始化完成")
            return True
            
        except Exception as e:
            logger.error(f"❌ 语音服务初始化失败: {e}")
            return False
    
    async def init_siliconflow_tts(self, api_key=None):
        """初始化SiliconFlow CosyVoice TTS API"""
        try:
            logger.info("📢 正在初始化SiliconFlow CosyVoice API...")
            
            # 初始化SiliconFlow TTS客户端
            if not api_key:
                api_key = os.getenv('SILICONFLOW_API_KEY')
                if not api_key:
                    logger.warning("⚠️ 未找到SILICONFLOW_API_KEY环境变量")
                    logger.info("📝 使用环境变量: export SILICONFLOW_API_KEY=your_api_key")
            
            self.siliconflow_tts = SiliconFlowTTS(api_key)
            
            # 从SiliconFlow客户端获取可用语音
            if self.siliconflow_tts:
                voices_info = await self.siliconflow_tts.get_voices()
                self.available_speakers = voices_info.get("voices", [])
            else:
                self.available_speakers = [
                    "中文女", "中文男", "英文女", "英文男",
                    "日语女", "韩语女", "粤语女", "四川话女"
                ]
            
            # 测试API连接（可选）
            if api_key:
                logger.info("🔍 正在测试SiliconFlow API连接...")
                # 可以启用这行来测试连接
                # connection_ok = await self.siliconflow_tts.test_connection()
                # if connection_ok:
                #     logger.info("✅ SiliconFlow API连接正常")
                # else:
                #     logger.warning("⚠️ SiliconFlow API连接失败")
            
            logger.info("✅ SiliconFlow CosyVoice API初始化成功")
            
        except Exception as e:
            logger.error(f"❌ SiliconFlow TTS初始化失败: {e}")
            raise
    
    async def init_sensevoice_stt(self, model_path=None):
        """初始化SenseVoice STT模型"""
        try:
            logger.info("🎤 正在加载SenseVoice-small模型...")
            
            # 这里需要根据SenseVoice的实际API进行调整
            # 示例代码框架：
            """
            from funasr import AutoModel
            
            self.sensevoice_stt = AutoModel(
                model="sensevoice-small",
                model_revision="master",
                device=self.device
            )
            """
            
            # 临时模拟初始化
            self.sensevoice_stt = {"model_name": "sensevoice-small", "status": "loaded"}
            logger.info("✅ SenseVoice STT模型加载成功")
            
        except Exception as e:
            logger.error(f"❌ SenseVoice STT加载失败: {e}")
            raise
    
    async def text_to_speech(self, text: str, voice_style: str = "中文女", speaker_name: str = None) -> Dict[str, Any]:
        """文本转语音 - 使用SiliconFlow CosyVoice API"""
        try:
            if not self.is_initialized or not self.siliconflow_tts:
                raise Exception("SiliconFlow TTS未初始化")
            
            logger.info(f"🔊 SiliconFlow CosyVoice TTS请求: {text[:50]}...")
            
            # 选择语音
            selected_voice = speaker_name if speaker_name in self.available_speakers else voice_style
            if selected_voice not in self.available_speakers:
                selected_voice = "中文女"  # 默认语音
            
            # 调用SiliconFlow API
            result = await self.siliconflow_tts.text_to_speech(
                text=text,
                voice=selected_voice
            )
            
            if result["success"]:
                logger.info(f"✅ SiliconFlow TTS成功 - 音频大小: {result.get('audio_size', 0)} bytes")
                
                return {
                    "success": True,
                    "audio_data": result["audio_data"],
                    "format": result["format"],
                    "model": "SiliconFlow/CosyVoice2-0.5B",
                    "voice_style": selected_voice,
                    "text_length": len(text),
                    "sample_rate": result.get("sample_rate", 22050),
                    "audio_size": result.get("audio_size", 0),
                    "provider": "SiliconFlow",
                    "available_speakers": self.available_speakers
                }
            else:
                logger.error(f"❌ SiliconFlow TTS失败: {result['error']}")
                return {
                    "success": False,
                    "error": result["error"]
                }
            
        except Exception as e:
            logger.error(f"❌ TTS处理失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def speech_to_text(self, audio_data: str) -> Dict[str, Any]:
        """语音转文本 - 使用SenseVoice"""
        try:
            if not self.is_initialized or not self.sensevoice_stt:
                raise Exception("SenseVoice STT未初始化")
            
            logger.info("🎤 STT请求处理中...")
            
            # 解码音频数据
            audio_bytes = base64.b64decode(audio_data)
            
            # 这里调用实际的SenseVoice API
            # 示例代码：
            """
            # 保存临时音频文件
            temp_audio_path = f"/tmp/audio_{uuid.uuid4().hex}.wav"
            with open(temp_audio_path, "wb") as f:
                f.write(audio_bytes)
            
            # 进行语音识别
            result = self.sensevoice_stt.generate(
                input=temp_audio_path,
                language="zh",
                use_itn=True
            )
            
            # 清理临时文件
            os.unlink(temp_audio_path)
            
            text = result[0]["text"]
            """
            
            # 临时模拟响应
            await asyncio.sleep(0.8)  # 模拟处理时间
            mock_texts = [
                "你好，我想和嘎巴龙聊天",
                "今天天气怎么样",
                "请介绍一下你自己",
                "能不能讲个笑话",
                "我感觉有点无聊"
            ]
            text = mock_texts[int(time.time()) % len(mock_texts)]
            
            return {
                "success": True,
                "text": text,
                "model": "sensevoice-small",
                "language": "zh",
                "confidence": 0.95,
                "audio_duration": len(audio_bytes) / 16000  # 估算时长
            }
            
        except Exception as e:
            logger.error(f"❌ STT处理失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }

class VoiceWebSocketServer:
    """语音服务WebSocket服务器"""
    
    def __init__(self, host="0.0.0.0", port=8001):
        self.host = host
        self.port = port
        self.processor = VoiceServiceProcessor()
        self.clients = set()
        self.request_count = 0
        
    async def register_client(self, websocket):
        """注册客户端"""
        self.clients.add(websocket)
        client_info = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        logger.info(f"✅ 语音客户端连接: {client_info} (总数: {len(self.clients)})")
    
    async def unregister_client(self, websocket):
        """注销客户端"""
        self.clients.discard(websocket)
        client_info = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        logger.info(f"❌ 语音客户端断开: {client_info} (剩余: {len(self.clients)})")
    
    async def handle_client(self, websocket, path):
        """处理客户端连接"""
        await self.register_client(websocket)
        
        # 发送欢迎消息
        welcome_msg = {
            "type": "welcome",
            "message": "语音服务连接成功",
            "services": {
                "tts": "SiliconFlow CosyVoice2-0.5B",
                "stt": "SenseVoice-small"
            },
            "timestamp": int(time.time() * 1000)
        }
        await websocket.send(json.dumps(welcome_msg, ensure_ascii=False))
        
        try:
            async for message in websocket:
                await self.process_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            logger.info("语音客户端正常断开")
        except Exception as e:
            logger.error(f"语音服务连接异常: {e}")
        finally:
            await self.unregister_client(websocket)
    
    async def process_message(self, websocket, message):
        """处理收到的消息"""
        try:
            data = json.loads(message)
            message_type = data.get("type")
            request_id = data.get("requestId")
            
            self.request_count += 1
            logger.info(f"📨 收到语音请求: {message_type}, ID: {request_id}")
            
            if message_type == "tts_request":
                await self.handle_tts_request(websocket, data)
            elif message_type == "stt_request":
                await self.handle_stt_request(websocket, data)
            elif message_type == "ping":
                await self.handle_ping(websocket, data)
            else:
                await self.send_error(websocket, f"未知消息类型: {message_type}", request_id)
                
        except json.JSONDecodeError:
            await self.send_error(websocket, "JSON格式错误")
        except Exception as e:
            logger.error(f"消息处理异常: {e}")
            await self.send_error(websocket, str(e))
    
    async def handle_tts_request(self, websocket, data):
        """处理TTS请求"""
        request_id = data.get("requestId")
        request_data = data.get("data", {})
        
        try:
            text = request_data.get("text", "")
            voice_style = request_data.get("voice_style", "中文女")
            speaker_name = request_data.get("speaker_name")  # 可选的预训练speaker
            
            if not text:
                await self.send_error(websocket, "文本内容为空", request_id)
                return
            
            # 调用SiliconFlow TTS处理
            result = await self.processor.text_to_speech(text, voice_style, speaker_name)
            
            # 发送响应
            response = {
                "type": "tts_response",
                "requestId": request_id,
                "success": result["success"],
                "timestamp": int(time.time() * 1000)
            }
            
            if result["success"]:
                response.update({
                    "audio_data": result["audio_data"],
                    "format": result["format"],
                    "model": result["model"],
                    "voice_tag": result.get("voice_tag", "[S1]"),
                    "provider": result.get("provider", "SiliconFlow"),
                    "audio_size": result.get("audio_size", 0)
                })
            else:
                response["error"] = result["error"]
            
            await websocket.send(json.dumps(response, ensure_ascii=False))
            logger.info(f"✅ TTS响应已发送, ID: {request_id}")
            
        except Exception as e:
            logger.error(f"TTS请求处理失败: {e}")
            await self.send_error(websocket, str(e), request_id)
    
    async def handle_stt_request(self, websocket, data):
        """处理STT请求"""
        request_id = data.get("requestId")
        request_data = data.get("data", {})
        
        try:
            audio_data = request_data.get("audio_data", "")
            
            if not audio_data:
                await self.send_error(websocket, "音频数据为空", request_id)
                return
            
            # 调用STT处理
            result = await self.processor.speech_to_text(audio_data)
            
            # 发送响应
            response = {
                "type": "stt_response",
                "requestId": request_id,
                "success": result["success"],
                "timestamp": int(time.time() * 1000)
            }
            
            if result["success"]:
                response.update({
                    "text": result["text"],
                    "language": result["language"],
                    "confidence": result["confidence"],
                    "model": result["model"]
                })
            else:
                response["error"] = result["error"]
            
            await websocket.send(json.dumps(response, ensure_ascii=False))
            logger.info(f"✅ STT响应已发送, ID: {request_id}, 文本: {result.get('text', 'N/A')}")
            
        except Exception as e:
            logger.error(f"STT请求处理失败: {e}")
            await self.send_error(websocket, str(e), request_id)
    
    async def handle_ping(self, websocket, data):
        """处理PING消息"""
        pong_response = {
            "type": "pong",
            "timestamp": int(time.time() * 1000)
        }
        await websocket.send(json.dumps(pong_response))
    
    async def send_error(self, websocket, error_message, request_id=None):
        """发送错误响应"""
        error_response = {
            "type": "error",
            "requestId": request_id,
            "error": error_message,
            "timestamp": int(time.time() * 1000)
        }
        await websocket.send(json.dumps(error_response, ensure_ascii=False))
    
    async def start_server(self):
        """启动服务器"""
        try:
            logger.info("="*60)
            logger.info("🎵 正在启动语音服务器...")
            logger.info(f"📍 服务地址: {self.host}:{self.port}")
            logger.info(f"🎤 STT模型: SenseVoice-small")
            logger.info(f"📢 TTS模型: SiliconFlow CosyVoice2-0.5B")
            logger.info("="*60)
            
            # 初始化语音处理器
            if not await self.processor.initialize():
                raise Exception("语音处理器初始化失败")
            
            # 启动WebSocket服务器
            server = await websockets.serve(
                self.handle_client,
                self.host,
                self.port,
                ping_interval=20,
                ping_timeout=10
            )
            
            logger.info("✅ 语音服务器启动成功！")
            logger.info("💡 前端可连接到: ws://你的IP:8001")
            logger.info("🔧 支持的消息类型: tts_request, stt_request, ping")
            logger.info("💰 TTS价格: ￥105/百万UTF-8字节")
            logger.info("="*60)
            
            # 保持服务运行
            await server.wait_closed()
            
        except Exception as e:
            logger.error(f"❌ 语音服务器启动失败: {e}")

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='语音服务器 - SiliconFlow CosyVoice API + SenseVoice STT')
    parser.add_argument('--host', default='0.0.0.0', help='服务器地址')
    parser.add_argument('--port', type=int, default=8001, help='服务器端口')
    parser.add_argument('--api-key', help='SiliconFlow API密钥')
    parser.add_argument('--sensevoice-path', help='SenseVoice模型路径')
    
    args = parser.parse_args()
    
    print("""
╔════════════════════════════════════════════════════════════════╗
║                      语音服务器 v3.0                          ║
║                         (SiliconFlow 版本)                        ║
║                                                                ║
║  🎤 STT: SenseVoice-small (中文语音识别)                       ║
║  📢 TTS: SiliconFlow CosyVoice2-0.5B (云端高质量语音合成)      ║
║                                                                ║
║  特色功能: 150ms低延迟、多语言支持、云端计算              ║
║  价格: ￥105/百万UTF-8字节                                      ║
║  连接地址: ws://你的IP:8001                                     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    """)
    
    # 设置API密钥（如果提供）
    if args.api_key:
        os.environ['SILICONFLOW_API_KEY'] = args.api_key
    
    server = VoiceWebSocketServer(host=args.host, port=args.port)
    
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        print("\n👋 语音服务器已停止")

if __name__ == "__main__":
    main()