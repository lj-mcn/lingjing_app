#!/usr/bin/env python3
"""
WebSocket LLM Adapter
从原始ASR-LLM-TTS项目中提取核心LLM功能，提供WebSocket接口
"""

import asyncio
import json
import os
import time
import torch
import websockets
import logging
from transformers import AutoModelForCausalLM, AutoTokenizer
from pathlib import Path

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LLMProcessor:
    def __init__(self, model_path=None):
        self.model = None
        self.tokenizer = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model_path = model_path or "Qwen/Qwen2.5-1.5B-Instruct"
        self.max_tokens = 512
        
    async def initialize(self):
        """初始化模型"""
        try:
            logger.info(f"Loading model from {self.model_path}")
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_path,
                torch_dtype="auto",
                device_map="auto",
                trust_remote_code=True
            )
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_path,
                trust_remote_code=True
            )
            logger.info("Model loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False
    
    async def generate_response(self, prompt, system_prompt=None, conversation_history=None):
        """生成响应"""
        try:
            # 构建消息
            messages = []
            
            # 添加系统提示
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            else:
                messages.append({"role": "system", "content": "你叫千问，是一个18岁的女大学生，性格活泼开朗，说话俏皮"})
            
            # 添加历史对话
            if conversation_history:
                messages.extend(conversation_history)
            
            # 添加当前提示，并要求简短回答
            user_prompt = prompt + "，回答简短一些，保持50字以内！"
            messages.append({"role": "user", "content": user_prompt})
            
            # 应用聊天模板
            text = self.tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True
            )
            
            # 编码输入
            model_inputs = self.tokenizer([text], return_tensors="pt").to(self.model.device)
            
            # 生成响应
            with torch.no_grad():
                generated_ids = self.model.generate(
                    **model_inputs,
                    max_new_tokens=self.max_tokens,
                    do_sample=True,
                    temperature=0.7,
                    top_p=0.9,
                    pad_token_id=self.tokenizer.eos_token_id
                )
            
            # 解码响应
            generated_ids = [
                output_ids[len(input_ids):] 
                for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
            ]
            
            response = self.tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
            
            return {
                "success": True,
                "message": response.strip(),
                "model": self.model_path
            }
            
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

class WebSocketLLMServer:
    def __init__(self, host="localhost", port=8000):
        self.host = host
        self.port = port
        self.llm_processor = LLMProcessor()
        self.clients = set()
        
    async def register_client(self, websocket):
        """注册客户端"""
        self.clients.add(websocket)
        logger.info(f"Client {websocket.remote_address} connected")
        
    async def unregister_client(self, websocket):
        """注销客户端"""
        self.clients.discard(websocket)
        logger.info(f"Client {websocket.remote_address} disconnected")
    
    async def handle_client(self, websocket, path=None):
        """处理客户端连接"""
        # 兼容不同版本的websockets库
        if path:
            logger.info(f"Client connected to path: {path}")
        await self.register_client(websocket)
        try:
            async for message in websocket:
                await self.process_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            logger.info("Client disconnected")
        except Exception as e:
            logger.error(f"Error in handle_client: {e}")
        finally:
            await self.unregister_client(websocket)
    
    def create_handler(self):
        """创建兼容的处理器函数"""
        async def handler(websocket, path=None):
            return await self.handle_client(websocket, path)
        return handler
    
    async def process_message(self, websocket, message):
        """处理接收到的消息"""
        try:
            data = json.loads(message)
            
            if data.get("type") == "llm_request":
                await self.handle_llm_request(websocket, data)
            elif data.get("type") == "ping":
                await self.handle_ping(websocket, data)
            else:
                await self.send_error(websocket, "Unknown message type", data.get("requestId"))
                
        except json.JSONDecodeError:
            await self.send_error(websocket, "Invalid JSON format")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            await self.send_error(websocket, str(e))
    
    async def handle_llm_request(self, websocket, data):
        """处理LLM请求"""
        try:
            request_id = data.get("requestId")
            request_data = data.get("data", {})
            
            prompt = request_data.get("prompt", "")
            system_prompt = request_data.get("system_prompt")
            conversation_history = request_data.get("conversation_history", [])
            
            if not prompt:
                await self.send_error(websocket, "Empty prompt", request_id)
                return
            
            # 生成响应
            result = await self.llm_processor.generate_response(
                prompt, system_prompt, conversation_history
            )
            
            # 发送响应
            response = {
                "type": "llm_response",
                "requestId": request_id,
                "success": result["success"],
                "timestamp": int(time.time() * 1000)  # 统一使用JavaScript格式的时间戳(毫秒)
            }
            
            if result["success"]:
                response["message"] = result["message"]
            else:
                response["error"] = result["error"]
            
            await websocket.send(json.dumps(response, ensure_ascii=False))
            
        except Exception as e:
            logger.error(f"Error handling LLM request: {e}")
            await self.send_error(websocket, str(e), data.get("requestId"))
    
    async def handle_ping(self, websocket, data):
        """处理ping消息"""
        try:
            pong_response = {
                "type": "pong",
                "timestamp": int(time.time() * 1000)  # 统一使用JavaScript格式的时间戳(毫秒)
            }
            await websocket.send(json.dumps(pong_response, ensure_ascii=False))
            logger.debug("Sent pong response")
        except Exception as e:
            logger.error(f"Error handling ping: {e}")
    
    async def send_error(self, websocket, error_message, request_id=None):
        """发送错误响应"""
        if request_id:
            # 如果有请求ID，发送LLM响应格式的错误
            response = {
                "type": "llm_response",
                "requestId": request_id,
                "success": False,
                "error": error_message,
                "timestamp": int(time.time() * 1000)
            }
        else:
            # 如果没有请求ID，发送通用错误格式
            response = {
                "type": "error",
                "error": error_message,
                "timestamp": int(time.time() * 1000)
            }
            
        await websocket.send(json.dumps(response, ensure_ascii=False))
    
    async def start_server(self):
        """启动WebSocket服务器"""
        # 首先初始化LLM处理器
        logger.info("Initializing LLM processor...")
        if not await self.llm_processor.initialize():
            logger.error("Failed to initialize LLM processor")
            return
        
        # 启动WebSocket服务器
        logger.info(f"Starting WebSocket LLM server on {self.host}:{self.port}")
        try:
            # 使用包装函数确保兼容性
            handler = self.create_handler()
            server = await websockets.serve(
                handler,
                host=self.host,
                port=self.port,
                ping_interval=20,
                ping_timeout=10
            )
            logger.info("Server started successfully")
        except Exception as e:
            logger.error(f"Failed to start server: {e}")
            raise
        
        # 保持服务器运行
        await server.wait_closed()

def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="WebSocket LLM Server")
    parser.add_argument("--host", default="localhost", help="Server host")
    parser.add_argument("--port", type=int, default=8000, help="Server port")
    parser.add_argument("--model", help="Model path or name")
    
    args = parser.parse_args()
    
    # 创建服务器实例
    server = WebSocketLLMServer(args.host, args.port)
    if args.model:
        server.llm_processor.model_path = args.model
    
    # 运行服务器
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")

if __name__ == "__main__":
    main()