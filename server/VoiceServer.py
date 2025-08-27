#!/usr/bin/env python3
"""
统一语音服务器 - 集成Kokoro TTS + SenseVoice-small
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
    """语音服务处理器 - 集成TTS和STT"""
    
    def __init__(self):
        self.kokoro_tts = None
        self.sensevoice_stt = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.is_initialized = False
        
    async def initialize(self, kokoro_path=None, sensevoice_path=None):
        """初始化模型"""
        try:
            logger.info("🚀 初始化语音服务...")
            
            # 初始化Kokoro TTS
            await self.init_kokoro_tts(kokoro_path)
            
            # 初始化SenseVoice STT
            await self.init_sensevoice_stt(sensevoice_path)
            
            self.is_initialized = True
            logger.info("✅ 语音服务初始化完成")
            return True
            
        except Exception as e:
            logger.error(f"❌ 语音服务初始化失败: {e}")
            return False
    
    async def init_kokoro_tts(self, model_path=None):
        """初始化Kokoro TTS模型"""
        try:
            logger.info("📢 正在加载Kokoro TTS模型...")
            
            # 这里需要根据Kokoro TTS的实际API进行调整
            # 示例代码框架：
            """
            from kokoro_tts import KokoroTTS
            
            self.kokoro_tts = KokoroTTS(
                model_path=model_path or "kokoro-v0_19",
                device=self.device
            )
            await self.kokoro_tts.load()
            """
            
            # 临时模拟初始化
            self.kokoro_tts = {"model_name": "kokoro-v0_19", "status": "loaded"}
            logger.info("✅ Kokoro TTS模型加载成功")
            
        except Exception as e:
            logger.error(f"❌ Kokoro TTS加载失败: {e}")
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
    
    async def text_to_speech(self, text: str, voice_style: str = "default") -> Dict[str, Any]:
        """文本转语音 - 使用Kokoro TTS"""
        try:
            if not self.is_initialized or not self.kokoro_tts:
                raise Exception("Kokoro TTS未初始化")
            
            logger.info(f"🔊 TTS请求: {text[:50]}...")
            
            # 这里调用实际的Kokoro TTS API
            # 示例代码：
            """
            audio_data = await self.kokoro_tts.generate(
                text=text,
                voice=voice_style,
                speed=1.0,
                format="wav"
            )
            
            # 转换为base64
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            """
            
            # 临时模拟响应
            await asyncio.sleep(0.5)  # 模拟处理时间
            audio_base64 = "mock_audio_data_base64_" + str(int(time.time()))
            
            return {
                "success": True,
                "audio_data": audio_base64,
                "format": "wav",
                "model": "kokoro-v0_19",
                "voice_style": voice_style,
                "text_length": len(text)
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
                "tts": "Kokoro TTS",
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
            voice_style = request_data.get("voice_style", "default")
            
            if not text:
                await self.send_error(websocket, "文本内容为空", request_id)
                return
            
            # 调用TTS处理
            result = await self.processor.text_to_speech(text, voice_style)
            
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
                    "model": result["model"]
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
            logger.info(f"📢 TTS模型: Kokoro TTS")
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
            logger.info("="*60)
            
            # 保持服务运行
            await server.wait_closed()
            
        except Exception as e:
            logger.error(f"❌ 语音服务器启动失败: {e}")

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='语音服务器 - Kokoro TTS + SenseVoice STT')
    parser.add_argument('--host', default='0.0.0.0', help='服务器地址')
    parser.add_argument('--port', type=int, default=8001, help='服务器端口')
    parser.add_argument('--kokoro-path', help='Kokoro TTS模型路径')
    parser.add_argument('--sensevoice-path', help='SenseVoice模型路径')
    
    args = parser.parse_args()
    
    print("""
╔════════════════════════════════════════════════════════════════╗
║                      语音服务器 v1.0                          ║
║                                                                ║
║  🎤 STT: SenseVoice-small (中文语音识别)                       ║
║  📢 TTS: Kokoro TTS (高质量语音合成)                           ║
║                                                                ║
║  连接地址: ws://你的IP:8001                                     ║
║  用途: App与大模型间的语音处理服务                              ║
╚════════════════════════════════════════════════════════════════╝
    """)
    
    # 传递模型路径参数
    server = VoiceWebSocketServer(host=args.host, port=args.port)
    
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        print("\n👋 语音服务器已停止")

if __name__ == "__main__":
    main()