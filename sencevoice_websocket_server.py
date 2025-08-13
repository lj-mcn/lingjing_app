#!/usr/bin/env python3
"""
SenceVoice WebSocket 服务器
支持完整的语音交互功能，包括语音识别(ASR)、声纹识别、关键词唤醒和语音合成(TTS)

基于SenceVoice_websocket.md接口规范实现
"""

import asyncio
import websockets
import json
import time
import logging
import base64
import os
import uuid
from typing import Dict, Any, Optional, Set
from dataclasses import dataclass
import argparse
from pathlib import Path
import yaml

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('sencevoice_server.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class ServerConfig:
    """服务器配置"""
    host: str = "0.0.0.0"
    port: int = 8000
    
    # 模型路径配置
    sencevoice_model_path: str = "/path/to/SenseVoice"
    llm_model_path: str = "/path/to/Qwen2.5"
    sv_model_path: str = "/path/to/cam++"
    
    # 功能配置
    enable_kws: bool = True
    enable_sv: bool = True
    kws_keyword: str = "ni hao xiao qian"
    sv_threshold: float = 0.35
    
    # 路径配置
    sv_enroll_dir: str = "./SpeakerVerification_DIR/enroll_wav/"
    output_dir: str = "./output"
    
    # 音频配置
    sample_rate: int = 16000
    channels: int = 1
    bit_depth: int = 16

class SenceVoiceServer:
    """SenceVoice WebSocket服务器"""
    
    def __init__(self, config: ServerConfig):
        self.config = config
        self.connected_clients: Set[websockets.WebSocketServerProtocol] = set()
        self.client_states: Dict[str, Dict] = {}
        self.request_count = 0
        
        # 服务状态
        self.kws_activated = False
        self.sv_enrolled = False
        
        # 初始化目录
        self._init_directories()
        
        logger.info(f"初始化SenceVoice WebSocket服务器: {config.host}:{config.port}")
    
    def _init_directories(self):
        """初始化必要的目录"""
        os.makedirs(self.config.sv_enroll_dir, exist_ok=True)
        os.makedirs(self.config.output_dir, exist_ok=True)
        logger.info(f"初始化目录: {self.config.sv_enroll_dir}, {self.config.output_dir}")
    
    def _get_client_id(self, websocket) -> str:
        """获取客户端唯一标识"""
        return f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
    
    async def register_client(self, websocket):
        """注册新客户端"""
        self.connected_clients.add(websocket)
        client_id = self._get_client_id(websocket)
        
        # 初始化客户端状态
        self.client_states[client_id] = {
            "connected_at": time.time(),
            "request_count": 0,
            "last_activity": time.time()
        }
        
        logger.info(f"✅ 新客户端连接: {client_id} (总连接数: {len(self.connected_clients)})")
        
        # 发送欢迎消息
        welcome_msg = {
            "type": "status_response",
            "success": True,
            "timestamp": int(time.time() * 1000),
            "data": {
                "kws_enabled": self.config.enable_kws,
                "kws_activated": self.kws_activated,
                "sv_enabled": self.config.enable_sv,
                "sv_enrolled": self.sv_enrolled,
                "kws_keyword": self.config.kws_keyword,
                "sv_threshold": self.config.sv_threshold,
                "server_info": {
                    "name": "SenceVoice WebSocket服务器",
                    "version": "1.0.0",
                    "capabilities": ["voice_request", "sv_enroll_request", "status_request", "reset_kws", "ping"]
                }
            }
        }
        await websocket.send(json.dumps(welcome_msg, ensure_ascii=False))
    
    async def unregister_client(self, websocket):
        """注销客户端"""
        self.connected_clients.discard(websocket)
        client_id = self._get_client_id(websocket)
        self.client_states.pop(client_id, None)
        logger.info(f"❌ 客户端断开: {client_id} (剩余连接数: {len(self.connected_clients)})")
    
    async def handle_client(self, websocket, path):
        """处理客户端连接"""
        await self.register_client(websocket)
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.process_message(websocket, data)
                except json.JSONDecodeError as e:
                    logger.error(f"JSON解析错误: {e}")
                    await self.send_error(websocket, "Invalid JSON format", None)
                except Exception as e:
                    logger.error(f"处理消息错误: {e}")
                    await self.send_error(websocket, str(e), None)
        
        except websockets.exceptions.ConnectionClosed:
            logger.info("客户端正常断开连接")
        except Exception as e:
            logger.error(f"连接异常: {e}")
        finally:
            await self.unregister_client(websocket)
    
    async def process_message(self, websocket, data: Dict[str, Any]):
        """处理收到的消息"""
        message_type = data.get("type")
        request_id = data.get("requestId")
        client_id = self._get_client_id(websocket)
        
        # 更新客户端活动时间
        if client_id in self.client_states:
            self.client_states[client_id]["last_activity"] = time.time()
            self.client_states[client_id]["request_count"] += 1
        
        logger.info(f"📨 收到消息类型: {message_type}, ID: {request_id}, 客户端: {client_id}")
        
        if message_type == "voice_request":
            await self.handle_voice_request(websocket, data)
        elif message_type == "sv_enroll_request":
            await self.handle_sv_enroll_request(websocket, data)
        elif message_type == "status_request":
            await self.handle_status_request(websocket, data)
        elif message_type == "reset_kws":
            await self.handle_reset_kws(websocket, data)
        elif message_type == "ping":
            await self.handle_ping(websocket, data)
        else:
            logger.warning(f"未知消息类型: {message_type}")
            await self.send_error(websocket, f"Unknown message type: {message_type}", request_id)
    
    async def handle_voice_request(self, websocket, data: Dict[str, Any]):
        """处理语音识别和对话请求"""
        request_id = data.get("requestId")
        request_data = data.get("data", {})
        
        try:
            self.request_count += 1
            logger.info(f"🎤 处理语音请求 #{self.request_count}, ID: {request_id}")
            
            # 获取音频数据
            audio_data = request_data.get("audio_data")
            if not audio_data:
                raise ValueError("缺少音频数据")
            
            # 解码音频数据
            try:
                audio_bytes = base64.b64decode(audio_data)
                logger.info(f"音频数据大小: {len(audio_bytes)} bytes")
            except Exception as e:
                raise ValueError(f"音频数据解码失败: {e}")
            
            # 保存临时音频文件
            temp_audio_file = os.path.join(self.config.output_dir, f"temp_audio_{request_id}_{int(time.time())}.wav")
            with open(temp_audio_file, "wb") as f:
                f.write(audio_bytes)
            
            # 模拟语音处理流程
            asr_result = await self.perform_asr(temp_audio_file)
            
            # 检查关键词唤醒
            if self.config.enable_kws and not self.kws_activated:
                if not self.check_keyword_activation(asr_result):
                    response = {
                        "type": "voice_response",
                        "requestId": request_id,
                        "success": False,
                        "timestamp": int(time.time() * 1000),
                        "data": {
                            "success": False,
                            "error": "关键词未激活",
                            "error_code": "KWS_NOT_ACTIVATED",
                            "message": "很抱歉，唤醒词错误，请说出正确的唤醒词哦",
                            "audio_response": await self.generate_tts("很抱歉，唤醒词错误，请说出正确的唤醒词哦"),
                            "asr_result": asr_result
                        }
                    }
                    await websocket.send(json.dumps(response, ensure_ascii=False))
                    return
                else:
                    self.kws_activated = True
                    logger.info("✅ 关键词已激活")
            
            # 检查声纹验证
            if self.config.enable_sv and not self.sv_enrolled:
                response = {
                    "type": "voice_response",
                    "requestId": request_id,
                    "success": False,
                    "timestamp": int(time.time() * 1000),
                    "data": {
                        "success": False,
                        "error": "声纹未注册",
                        "error_code": "SV_NOT_ENROLLED",
                        "message": "请先进行声纹注册",
                        "audio_response": await self.generate_tts("请先进行声纹注册"),
                        "asr_result": asr_result
                    }
                }
                await websocket.send(json.dumps(response, ensure_ascii=False))
                return
            elif self.config.enable_sv and self.sv_enrolled:
                # 进行声纹验证
                sv_verified = await self.verify_speaker(temp_audio_file)
                if not sv_verified:
                    response = {
                        "type": "voice_response",
                        "requestId": request_id,
                        "success": False,
                        "timestamp": int(time.time() * 1000),
                        "data": {
                            "success": False,
                            "error": "声纹验证失败",
                            "error_code": "SV_VERIFICATION_FAILED",
                            "message": "声纹验证失败，请重新说话或重新注册声纹",
                            "audio_response": await self.generate_tts("声纹验证失败，请重新说话或重新注册声纹"),
                            "asr_result": asr_result
                        }
                    }
                    await websocket.send(json.dumps(response, ensure_ascii=False))
                    return
            
            # 调用大语言模型
            llm_response = await self.call_llm(asr_result)
            
            # 生成TTS音频
            tts_audio = await self.generate_tts(llm_response)
            
            # 构造成功响应
            response = {
                "type": "voice_response",
                "requestId": request_id,
                "success": True,
                "timestamp": int(time.time() * 1000),
                "data": {
                    "success": True,
                    "asr_result": asr_result,
                    "llm_response": llm_response,
                    "audio_response": tts_audio,
                    "response_type": "voice_chat_success"
                }
            }
            
            await websocket.send(json.dumps(response, ensure_ascii=False))
            logger.info(f"✅ 语音响应已发送, ID: {request_id}")
            
            # 清理临时文件
            try:
                os.remove(temp_audio_file)
            except:
                pass
            
        except Exception as e:
            logger.error(f"语音请求处理失败: {e}")
            await self.send_error(websocket, f"语音处理失败: {str(e)}", request_id, "VOICE_CHAT_FAILED")
    
    async def handle_sv_enroll_request(self, websocket, data: Dict[str, Any]):
        """处理声纹注册请求"""
        request_id = data.get("requestId")
        request_data = data.get("data", {})
        
        try:
            logger.info(f"🔐 处理声纹注册请求, ID: {request_id}")
            
            # 获取音频数据
            audio_data = request_data.get("audio_data")
            if not audio_data:
                raise ValueError("缺少音频数据")
            
            # 解码音频数据
            try:
                audio_bytes = base64.b64decode(audio_data)
                logger.info(f"声纹注册音频数据大小: {len(audio_bytes)} bytes")
            except Exception as e:
                raise ValueError(f"音频数据解码失败: {e}")
            
            # 检查音频时长（模拟，实际应该解析音频文件）
            if len(audio_bytes) < 48000:  # 假设16kHz, 16bit, 1channel, 至少3秒
                raise ValueError("音频时长不足，声纹注册需要至少3秒音频")
            
            # 保存声纹注册音频
            enroll_audio_file = os.path.join(self.config.sv_enroll_dir, f"enroll_{int(time.time())}.wav")
            with open(enroll_audio_file, "wb") as f:
                f.write(audio_bytes)
            
            # 模拟声纹注册过程
            await asyncio.sleep(1.0)  # 模拟处理时间
            
            # 标记声纹已注册
            self.sv_enrolled = True
            
            # 生成成功响应
            success_message = "声纹注册完成！现在只有你可以命令我啦！"
            tts_audio = await self.generate_tts(success_message)
            
            response = {
                "type": "sv_enroll_response",
                "requestId": request_id,
                "success": True,
                "timestamp": int(time.time() * 1000),
                "data": {
                    "success": True,
                    "message": success_message,
                    "audio_response": tts_audio,
                    "response_type": "sv_enrollment_success"
                }
            }
            
            await websocket.send(json.dumps(response, ensure_ascii=False))
            logger.info(f"✅ 声纹注册成功, ID: {request_id}")
            
        except Exception as e:
            logger.error(f"声纹注册失败: {e}")
            error_code = "AUDIO_TOO_SHORT" if "时长不足" in str(e) else "SV_ENROLLMENT_FAILED"
            await self.send_error(websocket, f"声纹注册失败: {str(e)}", request_id, error_code)
    
    async def handle_status_request(self, websocket, data: Dict[str, Any]):
        """处理状态查询请求"""
        request_id = data.get("requestId")
        
        response = {
            "type": "status_response",
            "requestId": request_id,
            "success": True,
            "timestamp": int(time.time() * 1000),
            "data": {
                "kws_enabled": self.config.enable_kws,
                "kws_activated": self.kws_activated,
                "sv_enabled": self.config.enable_sv,
                "sv_enrolled": self.sv_enrolled,
                "kws_keyword": self.config.kws_keyword,
                "sv_threshold": self.config.sv_threshold
            }
        }
        
        await websocket.send(json.dumps(response, ensure_ascii=False))
        logger.info(f"📊 状态查询响应已发送, ID: {request_id}")
    
    async def handle_reset_kws(self, websocket, data: Dict[str, Any]):
        """处理重置关键词状态请求"""
        request_id = data.get("requestId")
        
        self.kws_activated = False
        
        response = {
            "type": "reset_kws_response",
            "requestId": request_id,
            "success": True,
            "timestamp": int(time.time() * 1000),
            "message": "关键词状态已重置"
        }
        
        await websocket.send(json.dumps(response, ensure_ascii=False))
        logger.info(f"🔄 关键词状态已重置, ID: {request_id}")
    
    async def handle_ping(self, websocket, data: Dict[str, Any]):
        """处理PING消息"""
        pong_response = {
            "type": "pong",
            "timestamp": int(time.time() * 1000)
        }
        await websocket.send(json.dumps(pong_response))
        logger.debug("🏓 PONG响应已发送")
    
    async def send_error(self, websocket, error_message: str, request_id: Optional[str], error_code: str = "UNKNOWN_ERROR"):
        """发送错误响应"""
        error_response = {
            "type": "error",
            "requestId": request_id,
            "success": False,
            "error": error_message,
            "error_code": error_code,
            "timestamp": int(time.time() * 1000)
        }
        
        try:
            await websocket.send(json.dumps(error_response, ensure_ascii=False))
            logger.error(f"❌ 错误响应已发送: {error_message} ({error_code})")
        except Exception as e:
            logger.error(f"发送错误响应失败: {e}")
    
    async def perform_asr(self, audio_file: str) -> str:
        """执行语音识别 - 模拟实现"""
        await asyncio.sleep(0.2)  # 模拟ASR处理时间
        
        # 这里应该调用真实的SenseVoice模型
        # 目前返回模拟结果
        mock_results = [
            "你好小千",
            "今天天气怎么样",
            "播放音乐",
            "设置闹钟",
            "告诉我一个笑话"
        ]
        
        import random
        return random.choice(mock_results)
    
    def check_keyword_activation(self, asr_text: str) -> bool:
        """检查关键词激活"""
        if not asr_text:
            return False
        
        # 简单的关键词匹配
        keywords = self.config.kws_keyword.lower().split()
        asr_lower = asr_text.lower()
        
        # 检查是否包含关键词
        for keyword in keywords:
            if keyword in asr_lower or keyword.replace(" ", "") in asr_lower.replace(" ", ""):
                return True
        
        # 还可以检查相似度等更复杂的匹配
        return False
    
    async def verify_speaker(self, audio_file: str) -> bool:
        """声纹验证 - 模拟实现"""
        await asyncio.sleep(0.3)  # 模拟声纹验证时间
        
        # 这里应该调用真实的声纹验证模型
        # 目前模拟返回成功
        return True
    
    async def call_llm(self, user_input: str) -> str:
        """调用大语言模型"""
        await asyncio.sleep(0.5)  # 模拟LLM处理时间
        
        # 这里应该调用真实的大语言模型API
        # 目前返回模拟响应
        responses = {
            "你好小千": "你好！我是小千，很高兴见到你！有什么可以帮助你的吗？",
            "今天天气怎么样": "今天天气不错呢！阳光明媚，适合出门走走。",
            "播放音乐": "好的，正在为你播放音乐！",
            "设置闹钟": "请告诉我需要设置什么时间的闹钟。",
            "告诉我一个笑话": "为什么程序员喜欢黑色？因为光线太亮会看不清代码！哈哈！"
        }
        
        return responses.get(user_input, f"我收到了你的消息："{user_input}"。这是一个智能回复，我会尽力帮助你！")
    
    async def generate_tts(self, text: str) -> str:
        """生成TTS音频 - 模拟实现"""
        await asyncio.sleep(0.3)  # 模拟TTS处理时间
        
        # 这里应该调用真实的TTS引擎
        # 目前返回模拟的base64音频数据
        mock_audio = b"MOCK_TTS_AUDIO_DATA_" + text.encode('utf-8')
        return base64.b64encode(mock_audio).decode('utf-8')
    
    async def start_server(self):
        """启动服务器"""
        try:
            logger.info("="*60)
            logger.info("🚀 正在启动SenceVoice WebSocket服务器...")
            logger.info(f"📍 监听地址: {self.config.host}:{self.config.port}")
            logger.info(f"🌐 外部访问地址: ws://你的IP地址:{self.config.port}")
            logger.info(f"🎤 关键词唤醒: {'启用' if self.config.enable_kws else '禁用'}")
            logger.info(f"🔐 声纹识别: {'启用' if self.config.enable_sv else '禁用'}")
            logger.info(f"🔑 唤醒词: {self.config.kws_keyword}")
            logger.info("="*60)
            
            # 启动WebSocket服务器
            start_server = websockets.serve(
                self.handle_client, 
                self.config.host, 
                self.config.port,
                ping_interval=20,
                ping_timeout=10,
                max_size=10*1024*1024  # 10MB for audio data
            )
            
            await start_server
            logger.info("✅ 服务器启动成功！")
            logger.info("💡 提示：")
            logger.info("   1. 使用 Ctrl+C 停止服务器")
            logger.info("   2. 确保防火墙允许8000端口")
            logger.info("   3. 前端现在可以连接并进行声纹识别和语音对话了")
            logger.info("="*60)
            
            # 保持服务器运行
            await asyncio.Future()  # 永远等待
            
        except OSError as e:
            if "Address already in use" in str(e):
                logger.error("❌ 端口8000已被占用！")
                logger.error("💡 解决方案：")
                logger.error("   1. 检查是否已有服务器在运行: netstat -an | findstr :8000")
                logger.error("   2. 停止占用端口的程序")
                logger.error("   3. 或修改端口号重新启动")
            else:
                logger.error(f"❌ 服务器启动失败: {e}")
        except KeyboardInterrupt:
            logger.info("⏹️ 收到停止信号，正在关闭服务器...")
        except Exception as e:
            logger.error(f"❌ 服务器异常: {e}")
        finally:
            logger.info("🔚 服务器已停止")

def load_config(config_file: str = "sencevoice_server_config.yaml") -> ServerConfig:
    """加载配置文件"""
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config_data = yaml.safe_load(f)
            
            return ServerConfig(
                host=config_data.get('server', {}).get('host', '0.0.0.0'),
                port=config_data.get('server', {}).get('port', 8000),
                sencevoice_model_path=config_data.get('models', {}).get('sencevoice_model_path', '/path/to/SenseVoice'),
                llm_model_path=config_data.get('models', {}).get('llm_model_path', '/path/to/Qwen2.5'),
                sv_model_path=config_data.get('models', {}).get('sv_model_path', '/path/to/cam++'),
                enable_kws=config_data.get('features', {}).get('enable_kws', True),
                enable_sv=config_data.get('features', {}).get('enable_sv', True),
                kws_keyword=config_data.get('features', {}).get('kws_keyword', 'ni hao xiao qian'),
                sv_threshold=config_data.get('features', {}).get('sv_threshold', 0.35),
                sv_enroll_dir=config_data.get('paths', {}).get('sv_enroll_dir', './SpeakerVerification_DIR/enroll_wav/'),
                output_dir=config_data.get('paths', {}).get('output_dir', './output'),
                sample_rate=config_data.get('audio', {}).get('sample_rate', 16000),
                channels=config_data.get('audio', {}).get('channels', 1),
                bit_depth=config_data.get('audio', {}).get('bit_depth', 16)
            )
        except Exception as e:
            logger.warning(f"配置文件加载失败，使用默认配置: {e}")
    
    return ServerConfig()

def create_default_config(config_file: str = "sencevoice_server_config.yaml"):
    """创建默认配置文件"""
    default_config = {
        'server': {
            'host': '0.0.0.0',
            'port': 8000
        },
        'models': {
            'sencevoice_model_path': '/path/to/SenseVoice',
            'llm_model_path': '/path/to/Qwen2.5',
            'sv_model_path': '/path/to/cam++'
        },
        'features': {
            'enable_kws': True,
            'enable_sv': True,
            'kws_keyword': 'ni hao xiao qian',
            'sv_threshold': 0.35
        },
        'paths': {
            'sv_enroll_dir': './SpeakerVerification_DIR/enroll_wav/',
            'output_dir': './output'
        },
        'audio': {
            'sample_rate': 16000,
            'channels': 1,
            'bit_depth': 16
        }
    }
    
    with open(config_file, 'w', encoding='utf-8') as f:
        yaml.dump(default_config, f, default_flow_style=False, allow_unicode=True)
    
    logger.info(f"默认配置文件已创建: {config_file}")

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='SenceVoice WebSocket服务器')
    parser.add_argument('--host', default=None, help='监听主机地址')
    parser.add_argument('--port', type=int, default=None, help='监听端口')
    parser.add_argument('--config', default='sencevoice_server_config.yaml', help='配置文件路径')
    parser.add_argument('--create-config', action='store_true', help='创建默认配置文件')
    
    args = parser.parse_args()
    
    if args.create_config:
        create_default_config(args.config)
        return
    
    print("""
╔══════════════════════════════════════════════════════════════╗
║                  SenceVoice WebSocket 服务器                 ║
║                                                              ║
║  功能特性：                                                   ║
║  ✅ 语音识别 (ASR)                                           ║
║  ✅ 声纹识别和注册                                           ║
║  ✅ 关键词唤醒 (KWS)                                         ║
║  ✅ 大语言模型对话                                           ║
║  ✅ 语音合成 (TTS)                                           ║
║                                                              ║
║  支持完整的声纹识别语音交互功能                               ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    # 加载配置
    config = load_config(args.config)
    
    # 命令行参数覆盖配置文件
    if args.host:
        config.host = args.host
    if args.port:
        config.port = args.port
    
    server = SenceVoiceServer(config)
    
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        print("\n👋 再见！")

if __name__ == "__main__":
    main()