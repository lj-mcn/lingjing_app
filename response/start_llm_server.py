#!/usr/bin/env python3
"""
启动LLM WebSocket服务器的便捷脚本
"""

import sys
import os
from pathlib import Path

# 添加当前目录到路径
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

from websocket_llm_adapter import WebSocketLLMServer
import asyncio
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """主函数"""
    # 默认配置
    host = "localhost"
    port = 8000
    model_path = "Qwen/Qwen2.5-1.5B-Instruct"  # 使用较小的模型以提高响应速度
    
    # 如果有命令行参数，使用它们
    if len(sys.argv) > 1:
        host = sys.argv[1]
    if len(sys.argv) > 2:
        port = int(sys.argv[2])
    if len(sys.argv) > 3:
        model_path = sys.argv[3]
    
    logger.info(f"Starting LLM WebSocket server...")
    logger.info(f"Host: {host}")
    logger.info(f"Port: {port}")
    logger.info(f"Model: {model_path}")
    
    # 创建服务器
    server = WebSocketLLMServer(host, port)
    server.llm_processor.model_path = model_path
    
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()