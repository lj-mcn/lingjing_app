#!/usr/bin/env python3
"""
WebSocket LLM 服务器端
解决问题：之前只有客户端接口(llm_response.py)，缺少服务器端监听8000端口

错误原因分析：
1. llm_response.py 只是WebSocket客户端接口，不是服务器
2. 客户端尝试连接 ws://10.91.225.137:8000，但该地址没有服务器在监听
3. netstat -an | findstr :8000 没有输出，说明8000端口没有程序监听
4. 需要这个服务器文件在同学电脑上运行，监听0.0.0.0:8000端口

使用方法：
1. 安装依赖：pip install websockets
2. 启动服务器：python websocket_llm_server.py
3. 验证启动：netstat -an | findstr :8000 应该显示 LISTENING 状态
"""

import asyncio
import websockets
import json
import time
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass
import argparse

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('websocket_llm_server.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class LLMRequest:
    """LLM请求数据结构 - 与前端保持一致"""
    prompt: str
    system_prompt: str = "你是一个友好的AI助手。"
    conversation_history: list = None
    max_tokens: int = 512
    temperature: float = 0.7
    
    def __post_init__(self):
        if self.conversation_history is None:
            self.conversation_history = []

class LLMWebSocketServer:
    """
    LLM WebSocket服务器
    
    解决的问题：
    - 提供8000端口监听服务
    - 接收来自前端的llm_request消息
    - 返回符合格式的llm_response消息
    - 支持连接管理和错误处理
    """
    
    def __init__(self, host="0.0.0.0", port=8000):
        self.host = host
        self.port = port
        self.connected_clients = set()
        self.request_count = 0
        
        logger.info(f"初始化LLM WebSocket服务器: {host}:{port}")
    
    async def register_client(self, websocket):
        """注册新客户端"""
        self.connected_clients.add(websocket)
        client_info = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        logger.info(f"✅ 新客户端连接: {client_info} (总连接数: {len(self.connected_clients)})")
        
        # 发送欢迎消息
        welcome_msg = {
            "type": "status",
            "message": "WebSocket连接已建立",
            "server_info": {
                "name": "LLM WebSocket服务器",
                "version": "1.0.0",
                "capabilities": ["llm_request", "ping", "status"]
            },
            "timestamp": int(time.time() * 1000)
        }
        await websocket.send(json.dumps(welcome_msg, ensure_ascii=False))
    
    async def unregister_client(self, websocket):
        """注销客户端"""
        self.connected_clients.discard(websocket)
        client_info = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        logger.info(f"❌ 客户端断开: {client_info} (剩余连接数: {len(self.connected_clients)})")
    
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
        
        logger.info(f"📨 收到消息类型: {message_type}, ID: {request_id}")
        
        if message_type == "llm_request":
            await self.handle_llm_request(websocket, data)
        elif message_type == "ping":
            await self.handle_ping(websocket, data)
        else:
            logger.warning(f"未知消息类型: {message_type}")
            await self.send_error(websocket, f"Unknown message type: {message_type}", request_id)
    
    async def handle_llm_request(self, websocket, data: Dict[str, Any]):
        """处理LLM请求"""
        request_id = data.get("requestId")
        request_data = data.get("data", {})
        
        try:
            self.request_count += 1
            logger.info(f"🤖 处理LLM请求 #{self.request_count}, ID: {request_id}")
            
            # 解析请求数据
            llm_request = LLMRequest(
                prompt=request_data.get("prompt", ""),
                system_prompt=request_data.get("system_prompt", "你是一个友好的AI助手。"),
                conversation_history=request_data.get("conversation_history", []),
                max_tokens=request_data.get("max_tokens", 512),
                temperature=request_data.get("temperature", 0.7)
            )
            
            # 调用LLM处理
            response_text = await self.call_llm_api(llm_request)
            
            # 构造响应
            response = {
                "type": "llm_response",
                "requestId": request_id,
                "success": True,
                "message": response_text,
                "timestamp": int(time.time() * 1000),
                "model_info": {
                    "model": "模拟LLM",
                    "version": "1.0.0"
                },
                "usage": {
                    "prompt_tokens": len(llm_request.prompt),
                    "completion_tokens": len(response_text),
                    "total_tokens": len(llm_request.prompt) + len(response_text)
                }
            }
            
            await websocket.send(json.dumps(response, ensure_ascii=False))
            logger.info(f"✅ LLM响应已发送, ID: {request_id}")
            
        except Exception as e:
            logger.error(f"LLM请求处理失败: {e}")
            await self.send_error(websocket, f"LLM processing failed: {str(e)}", request_id)
    
    async def handle_ping(self, websocket, data: Dict[str, Any]):
        """处理PING消息"""
        pong_response = {
            "type": "pong",
            "timestamp": int(time.time() * 1000)
        }
        await websocket.send(json.dumps(pong_response))
        logger.debug("🏓 PONG响应已发送")
    
    async def send_error(self, websocket, error_message: str, request_id: Optional[str]):
        """发送错误响应"""
        error_response = {
            "type": "error",
            "requestId": request_id,
            "success": False,
            "error": error_message,
            "timestamp": int(time.time() * 1000)
        }
        
        try:
            await websocket.send(json.dumps(error_response, ensure_ascii=False))
            logger.error(f"❌ 错误响应已发送: {error_message}")
        except Exception as e:
            logger.error(f"发送错误响应失败: {e}")
    
    async def call_llm_api(self, request: LLMRequest) -> str:
        """
        调用大模型API
        
        TODO: 在这里集成真正的大模型
        - 可以集成 OpenAI API
        - 可以集成本地部署的模型(如 Qwen2.5-1.5B-Instruct)
        - 可以集成其他大模型服务
        """
        
        # 模拟处理时间
        await asyncio.sleep(0.5)
        
        # 构建对话上下文
        context = ""
        if request.conversation_history:
            for msg in request.conversation_history[-5:]:  # 只取最近5轮对话
                role = msg.get("role", "")
                content = msg.get("content", "")
                context += f"{role}: {content}\n"
        
        # 生成响应（这里是模拟，需要替换为真实的LLM调用）
        prompt_analysis = self.analyze_prompt(request.prompt)
        
        response_text = f"""你好！我收到了你的消息："{request.prompt}"

这是一个模拟的LLM响应。在实际部署中，这里会调用真正的大模型API。

消息分析：{prompt_analysis}

系统提示：{request.system_prompt}
历史对话数：{len(request.conversation_history)}
最大Token数：{request.max_tokens}
温度参数：{request.temperature}

⚠️ 注意：这是模拟响应，请在call_llm_api方法中集成真正的大模型！"""

        return response_text
    
    def analyze_prompt(self, prompt: str) -> str:
        """简单的提示词分析"""
        if not prompt:
            return "空提示"
        elif len(prompt) < 10:
            return "简短询问"
        elif "?" in prompt or "？" in prompt:
            return "疑问句"
        elif "你好" in prompt or "hello" in prompt.lower():
            return "问候语"
        else:
            return "一般对话"
    
    def get_server_status(self) -> Dict[str, Any]:
        """获取服务器状态"""
        return {
            "server_name": "LLM WebSocket服务器",
            "host": self.host,
            "port": self.port,
            "connected_clients": len(self.connected_clients),
            "total_requests": self.request_count,
            "uptime": time.time(),
            "status": "running"
        }
    
    async def start_server(self):
        """启动服务器"""
        try:
            logger.info("="*50)
            logger.info("🚀 正在启动LLM WebSocket服务器...")
            logger.info(f"📍 监听地址: {self.host}:{self.port}")
            logger.info(f"🌐 外部访问地址: ws://你的IP地址:{self.port}")
            logger.info("="*50)
            
            # 启动WebSocket服务器
            start_server = websockets.serve(
                self.handle_client, 
                self.host, 
                self.port,
                ping_interval=20,
                ping_timeout=10
            )
            
            await start_server
            logger.info("✅ 服务器启动成功！")
            logger.info("💡 提示：")
            logger.info("   1. 使用 Ctrl+C 停止服务器")
            logger.info("   2. 确保防火墙允许8000端口")
            logger.info("   3. 前端现在可以连接到这个服务器了")
            logger.info("="*50)
            
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

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='LLM WebSocket服务器')
    parser.add_argument('--host', default='0.0.0.0', help='监听主机地址 (默认: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=8000, help='监听端口 (默认: 8000)')
    
    args = parser.parse_args()
    
    print("""
╔══════════════════════════════════════════════════════════════╗
║                    LLM WebSocket 服务器                      ║
║                                                              ║
║  错误解决说明：                                               ║
║  之前的 llm_response.py 只是客户端接口，不是服务器            ║
║  这个文件提供真正的WebSocket服务器，监听8000端口              ║
║                                                              ║
║  启动后，前端就可以连接 ws://你的IP:8000 了                   ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    server = LLMWebSocketServer(host=args.host, port=args.port)
    
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        print("\n👋 再见！")

if __name__ == "__main__":
    main()