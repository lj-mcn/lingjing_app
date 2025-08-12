#!/usr/bin/env python3
"""
LLM Response WebSocket Interface
大模型WebSocket通信接口，用于与后端服务器的实时双向通信
基于config.md和WebSocket_Interface_README.md规范实现
"""

import asyncio
import websockets
import json
import logging
import time
import uuid
from typing import Dict, Any, Optional, Callable, List, Union
from dataclasses import dataclass, asdict
from enum import Enum
import yaml
import os


class ConnectionState(Enum):
    """连接状态枚举"""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    RECONNECTING = "reconnecting"
    ERROR = "error"


class MessageType(Enum):
    """消息类型枚举"""
    LLM_REQUEST = "llm_request"
    LLM_RESPONSE = "llm_response"
    PING = "ping"
    PONG = "pong"
    ERROR = "error"
    STATUS = "status"


@dataclass
class ServerConfig:
    """服务器配置"""
    url: str
    name: str = ""
    priority: int = 1
    timeout: int = 60
    enabled: bool = True
    description: str = ""


@dataclass
class LLMRequestData:
    """LLM请求数据结构"""
    prompt: str
    system_prompt: str = "你是一个友好的AI助手。"
    conversation_history: List[Dict[str, str]] = None
    max_tokens: int = 512
    temperature: float = 0.7
    
    def __post_init__(self):
        if self.conversation_history is None:
            self.conversation_history = []


@dataclass
class LLMResponseData:
    """LLM响应数据结构"""
    success: bool
    message: str
    request_id: Union[str, int]
    timestamp: float
    error: Optional[str] = None
    model_info: Optional[Dict[str, Any]] = None
    usage: Optional[Dict[str, Any]] = None


@dataclass
class WebSocketConfig:
    """WebSocket配置"""
    timeout: int = 60
    ping_interval: int = 20
    ping_timeout: int = 10
    max_message_size: int = 1048576
    compression: bool = False


@dataclass
class RetryConfig:
    """重试配置"""
    max_retries: int = 10
    retry_interval: int = 3
    max_retry_interval: int = 60
    exponential_backoff: bool = True
    jitter: bool = True


class LLMResponseInterface:
    """LLM WebSocket响应接口类"""
    
    def __init__(self, config_file: str = "llm_config.yaml"):
        """
        初始化LLM响应接口
        
        Args:
            config_file: 配置文件路径
        """
        self.config_file = config_file
        self.config = self._load_config()
        
        # 连接状态
        self.websocket = None
        self.state = ConnectionState.DISCONNECTED
        self.current_server = None
        self.current_server_index = 0
        
        # 请求管理
        self.request_counter = 0
        self.pending_requests: Dict[Union[str, int], asyncio.Future] = {}
        
        # 统计信息
        self.connection_stats = {
            "total_connections": 0,
            "successful_connections": 0,
            "failed_connections": 0,
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "connection_time": None,
            "last_error": None
        }
        
        # 回调函数
        self.on_connected: Optional[Callable] = None
        self.on_disconnected: Optional[Callable] = None
        self.on_message_received: Optional[Callable[[Dict[str, Any]], None]] = None
        self.on_error: Optional[Callable[[Exception], None]] = None
        self.on_request_sent: Optional[Callable[[Dict[str, Any]], None]] = None
        self.on_response_received: Optional[Callable[[LLMResponseData], None]] = None
        
        # 设置日志
        self.logger = self._setup_logger()
        
        # 健康检查任务
        self._health_check_task = None
        self._reconnect_task = None
    
    def _setup_logger(self) -> logging.Logger:
        """设置日志记录器"""
        logger = logging.getLogger("LLMResponseInterface")
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
        return logger
    
    def _load_config(self) -> Dict[str, Any]:
        """加载配置文件"""
        if os.path.exists(self.config_file):
            with open(self.config_file, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        else:
            # 创建默认配置
            default_config = self._create_default_config()
            self._save_config(default_config)
            return default_config
    
    def _create_default_config(self) -> Dict[str, Any]:
        """创建默认配置"""
        return {
            "servers": [
                {
                    "url": "ws://10.91.225.137:8000",
                    "name": "主服务器",
                    "priority": 1,
                    "enabled": True,
                    "description": "主要的LLM服务器"
                },
                {
                    "url": "ws://10.91.225.138:8000",
                    "name": "备用服务器1",
                    "priority": 2,
                    "enabled": True,
                    "description": "第一个备用服务器"
                },
                {
                    "url": "ws://10.91.225.139:8000",
                    "name": "备用服务器2",
                    "priority": 3,
                    "enabled": True,
                    "description": "第二个备用服务器"
                },
                {
                    "url": "ws://localhost:8000",
                    "name": "本地服务器",
                    "priority": 4,
                    "enabled": True,
                    "description": "本地开发服务器"
                }
            ],
            "websocket": {
                "timeout": 60,
                "ping_interval": 20,
                "ping_timeout": 10,
                "max_message_size": 1048576,
                "compression": False
            },
            "retry": {
                "max_retries": 10,
                "retry_interval": 3,
                "max_retry_interval": 60,
                "exponential_backoff": True,
                "jitter": True
            },
            "request": {
                "max_tokens": 512,
                "default_system_prompt": "你是一个友好的AI助手。",
                "request_timeout": 30.0,
                "temperature": 0.7
            },
            "health_check": {
                "enabled": True,
                "interval": 30,
                "timeout": 5,
                "max_failures": 5
            }
        }
    
    def _save_config(self, config: Dict[str, Any]):
        """保存配置文件"""
        with open(self.config_file, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
    
    def _get_available_servers(self) -> List[ServerConfig]:
        """获取可用服务器列表"""
        servers = []
        for server_data in self.config.get("servers", []):
            if server_data.get("enabled", True):
                servers.append(ServerConfig(**server_data))
        
        # 按优先级排序
        servers.sort(key=lambda x: x.priority)
        return servers
    
    async def connect(self) -> bool:
        """连接到WebSocket服务器"""
        if self.state == ConnectionState.CONNECTED:
            return True
        
        self.state = ConnectionState.CONNECTING
        servers = self._get_available_servers()
        
        if not servers:
            self.logger.error("没有可用的服务器")
            self.state = ConnectionState.ERROR
            return False
        
        self.connection_stats["total_connections"] += 1
        
        for i, server in enumerate(servers):
            try:
                self.logger.info(f"尝试连接到 {server.name} ({server.url})")
                
                websocket_config = self.config.get("websocket", {})
                self.websocket = await websockets.connect(
                    server.url,
                    timeout=websocket_config.get("timeout", 60),
                    ping_interval=websocket_config.get("ping_interval", 20),
                    ping_timeout=websocket_config.get("ping_timeout", 10),
                    max_size=websocket_config.get("max_message_size", 1048576),
                    compression=websocket_config.get("compression", None)
                )
                
                self.current_server = server
                self.current_server_index = i
                self.state = ConnectionState.CONNECTED
                self.connection_stats["successful_connections"] += 1
                self.connection_stats["connection_time"] = time.time()
                
                self.logger.info(f"成功连接到 {server.name} ({server.url})")
                
                # 触发连接回调
                if self.on_connected:
                    try:
                        self.on_connected()
                    except Exception as e:
                        self.logger.error(f"连接回调错误: {e}")
                
                # 启动消息监听和健康检查
                asyncio.create_task(self._listen_messages())
                
                if self.config.get("health_check", {}).get("enabled", True):
                    self._start_health_check()
                
                return True
                
            except Exception as e:
                self.logger.warning(f"连接 {server.name} ({server.url}) 失败: {e}")
                self.connection_stats["failed_connections"] += 1
                self.connection_stats["last_error"] = str(e)
                continue
        
        self.state = ConnectionState.DISCONNECTED
        self.logger.error("所有服务器连接失败")
        return False
    
    async def disconnect(self):
        """断开WebSocket连接"""
        if self._health_check_task:
            self._health_check_task.cancel()
            self._health_check_task = None
        
        if self._reconnect_task:
            self._reconnect_task.cancel()
            self._reconnect_task = None
        
        if self.websocket and not self.websocket.closed:
            await self.websocket.close()
        
        self.state = ConnectionState.DISCONNECTED
        self.websocket = None
        self.current_server = None
        
        # 取消所有挂起的请求
        for request_id, future in self.pending_requests.items():
            if not future.done():
                future.cancel()
        self.pending_requests.clear()
        
        # 触发断开连接回调
        if self.on_disconnected:
            try:
                self.on_disconnected()
            except Exception as e:
                self.logger.error(f"断开连接回调错误: {e}")
        
        self.logger.info("WebSocket连接已断开")
    
    async def _reconnect(self):
        """重连逻辑"""
        if self.state == ConnectionState.RECONNECTING or self._reconnect_task:
            return
        
        self.state = ConnectionState.RECONNECTING
        retry_config = self.config.get("retry", {})
        max_retries = retry_config.get("max_retries", 10)
        retry_interval = retry_config.get("retry_interval", 3)
        
        retry_count = 0
        
        while retry_count < max_retries and self.state == ConnectionState.RECONNECTING:
            self.logger.info(f"第 {retry_count + 1}/{max_retries} 次重连尝试")
            
            if await self.connect():
                self.logger.info("重连成功")
                return
            
            retry_count += 1
            if retry_count < max_retries:
                # 计算重试间隔
                wait_time = retry_interval
                if retry_config.get("exponential_backoff", True):
                    wait_time = min(retry_interval * (2 ** retry_count), 
                                  retry_config.get("max_retry_interval", 60))
                
                if retry_config.get("jitter", True):
                    import random
                    wait_time *= (0.5 + random.random() * 0.5)
                
                await asyncio.sleep(wait_time)
        
        self.logger.error("重连失败，达到最大重试次数")
        self.state = ConnectionState.ERROR
    
    async def _listen_messages(self):
        """监听WebSocket消息"""
        try:
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    await self._handle_message(data)
                except json.JSONDecodeError as e:
                    self.logger.error(f"JSON解析错误: {e}")
                    if self.on_error:
                        self.on_error(e)
                except Exception as e:
                    self.logger.error(f"消息处理错误: {e}")
                    if self.on_error:
                        self.on_error(e)
        
        except websockets.exceptions.ConnectionClosed:
            self.logger.warning("WebSocket连接被关闭")
            if self.state == ConnectionState.CONNECTED:
                self._reconnect_task = asyncio.create_task(self._reconnect())
        except Exception as e:
            self.logger.error(f"消息监听错误: {e}")
            if self.on_error:
                self.on_error(e)
            if self.state == ConnectionState.CONNECTED:
                self._reconnect_task = asyncio.create_task(self._reconnect())
    
    async def _handle_message(self, data: Dict[str, Any]):
        """处理收到的消息"""
        message_type = data.get("type")
        request_id = data.get("requestId")
        
        # 触发消息接收回调
        if self.on_message_received:
            try:
                self.on_message_received(data)
            except Exception as e:
                self.logger.error(f"消息接收回调错误: {e}")
        
        if message_type == MessageType.LLM_RESPONSE.value and request_id is not None:
            # 处理LLM响应
            if request_id in self.pending_requests:
                future = self.pending_requests.pop(request_id)
                if not future.done():
                    response_data = LLMResponseData(
                        success=data.get("success", False),
                        message=data.get("message", ""),
                        request_id=request_id,
                        timestamp=data.get("timestamp", time.time()),
                        error=data.get("error"),
                        model_info=data.get("modelInfo"),
                        usage=data.get("usage")
                    )
                    
                    if response_data.success:
                        self.connection_stats["successful_requests"] += 1
                    else:
                        self.connection_stats["failed_requests"] += 1
                    
                    # 触发响应接收回调
                    if self.on_response_received:
                        try:
                            self.on_response_received(response_data)
                        except Exception as e:
                            self.logger.error(f"响应接收回调错误: {e}")
                    
                    future.set_result(response_data)
        
        elif message_type == MessageType.PONG.value:
            # 处理PONG消息
            self.logger.debug("收到PONG消息")
        
        elif message_type == MessageType.ERROR.value:
            # 处理错误消息
            error_msg = data.get("message", "未知错误")
            self.logger.error(f"服务器错误: {error_msg}")
            
            if request_id and request_id in self.pending_requests:
                future = self.pending_requests.pop(request_id)
                if not future.done():
                    self.connection_stats["failed_requests"] += 1
                    future.set_exception(Exception(error_msg))
    
    async def send_llm_request(self, 
                             prompt: str,
                             system_prompt: Optional[str] = None,
                             conversation_history: Optional[List[Dict[str, str]]] = None,
                             max_tokens: Optional[int] = None,
                             temperature: Optional[float] = None,
                             timeout: Optional[float] = None) -> LLMResponseData:
        """
        发送LLM请求
        
        Args:
            prompt: 用户输入内容
            system_prompt: 系统提示词
            conversation_history: 对话历史
            max_tokens: 最大token数
            temperature: 温度参数
            timeout: 请求超时时间
            
        Returns:
            LLM响应数据
        """
        if self.state != ConnectionState.CONNECTED:
            raise ConnectionError("WebSocket未连接")
        
        # 使用配置中的默认值
        request_config = self.config.get("request", {})
        if system_prompt is None:
            system_prompt = request_config.get("default_system_prompt", "你是一个友好的AI助手。")
        if max_tokens is None:
            max_tokens = request_config.get("max_tokens", 512)
        if temperature is None:
            temperature = request_config.get("temperature", 0.7)
        if timeout is None:
            timeout = request_config.get("request_timeout", 30.0)
        if conversation_history is None:
            conversation_history = []
        
        # 生成请求ID
        self.request_counter += 1
        request_id = f"req_{self.request_counter}_{int(time.time() * 1000)}"
        
        # 构造请求消息
        request_data = LLMRequestData(
            prompt=prompt,
            system_prompt=system_prompt,
            conversation_history=conversation_history,
            max_tokens=max_tokens,
            temperature=temperature
        )
        
        message = {
            "type": MessageType.LLM_REQUEST.value,
            "requestId": request_id,
            "data": asdict(request_data),
            "timestamp": int(time.time() * 1000)
        }
        
        # 创建响应Future
        response_future = asyncio.Future()
        self.pending_requests[request_id] = response_future
        
        try:
            # 发送消息
            await self.websocket.send(json.dumps(message, ensure_ascii=False))
            self.connection_stats["total_requests"] += 1
            self.logger.info(f"发送LLM请求 ID: {request_id}")
            
            # 触发请求发送回调
            if self.on_request_sent:
                try:
                    self.on_request_sent(message)
                except Exception as e:
                    self.logger.error(f"请求发送回调错误: {e}")
            
            # 等待响应
            response = await asyncio.wait_for(response_future, timeout=timeout)
            return response
            
        except asyncio.TimeoutError:
            # 清理超时的请求
            self.pending_requests.pop(request_id, None)
            self.connection_stats["failed_requests"] += 1
            raise TimeoutError(f"请求 {request_id} 超时")
        except Exception as e:
            # 清理失败的请求
            self.pending_requests.pop(request_id, None)
            self.connection_stats["failed_requests"] += 1
            raise e
    
    async def send_raw_message(self, message: Dict[str, Any]):
        """发送原始消息"""
        if self.state != ConnectionState.CONNECTED:
            raise ConnectionError("WebSocket未连接")
        
        await self.websocket.send(json.dumps(message, ensure_ascii=False))
    
    async def ping(self) -> bool:
        """发送PING消息"""
        if self.state != ConnectionState.CONNECTED:
            return False
        
        try:
            ping_message = {
                "type": MessageType.PING.value,
                "timestamp": int(time.time() * 1000)
            }
            await self.websocket.send(json.dumps(ping_message))
            return True
        except Exception as e:
            self.logger.error(f"PING发送失败: {e}")
            return False
    
    def _start_health_check(self):
        """启动健康检查"""
        if self._health_check_task:
            return
        
        async def health_check_loop():
            health_config = self.config.get("health_check", {})
            interval = health_config.get("interval", 30)
            max_failures = health_config.get("max_failures", 5)
            failure_count = 0
            
            while self.state == ConnectionState.CONNECTED:
                try:
                    await asyncio.sleep(interval)
                    if self.state != ConnectionState.CONNECTED:
                        break
                    
                    if await self.ping():
                        failure_count = 0
                    else:
                        failure_count += 1
                        self.logger.warning(f"健康检查失败 {failure_count}/{max_failures}")
                        
                        if failure_count >= max_failures:
                            self.logger.error("健康检查连续失败，触发重连")
                            self._reconnect_task = asyncio.create_task(self._reconnect())
                            break
                
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    self.logger.error(f"健康检查错误: {e}")
                    failure_count += 1
        
        self._health_check_task = asyncio.create_task(health_check_loop())
    
    def is_connected(self) -> bool:
        """检查连接状态"""
        return self.state == ConnectionState.CONNECTED
    
    def get_current_server(self) -> Optional[ServerConfig]:
        """获取当前连接的服务器"""
        return self.current_server
    
    def get_state(self) -> ConnectionState:
        """获取当前连接状态"""
        return self.state
    
    def get_connection_status(self) -> Dict[str, Any]:
        """获取连接状态信息"""
        return {
            "connected": self.is_connected(),
            "current_server": self.current_server.url if self.current_server else None,
            "current_server_name": self.current_server.name if self.current_server else None,
            "state": self.state.value,
            "stats": self.connection_stats.copy(),
            "pending_requests": len(self.pending_requests)
        }
    
    def export_logs(self, filename: str = "llm_response_logs.json") -> bool:
        """导出日志和统计信息"""
        try:
            log_data = {
                "timestamp": time.time(),
                "connection_status": self.get_connection_status(),
                "config": self.config,
                "pending_requests": list(self.pending_requests.keys())
            }
            
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(log_data, f, indent=2, ensure_ascii=False, default=str)
            
            self.logger.info(f"日志已导出到 {filename}")
            return True
        except Exception as e:
            self.logger.error(f"导出日志失败: {e}")
            return False


# 使用示例和测试函数
async def example_usage():
    """使用示例"""
    # 创建接口实例
    llm_interface = LLMResponseInterface()
    
    # 设置回调函数
    def on_connected():
        print("🟢 已连接到LLM后端")
    
    def on_disconnected():
        print("🔴 与LLM后端断开连接")
    
    def on_message_received(message):
        print(f"📨 收到消息: {message.get('type')}")
    
    def on_error(error):
        print(f"❌ 发生错误: {error}")
    
    def on_response_received(response):
        print(f"✅ 收到响应: {response.message[:50]}...")
    
    # 注册回调
    llm_interface.on_connected = on_connected
    llm_interface.on_disconnected = on_disconnected
    llm_interface.on_message_received = on_message_received
    llm_interface.on_error = on_error
    llm_interface.on_response_received = on_response_received
    
    try:
        # 连接到后端
        if await llm_interface.connect():
            print("连接成功!")
            
            # 发送LLM请求
            response = await llm_interface.send_llm_request(
                prompt="你好，请介绍一下自己",
                system_prompt="你是一个友好的AI助手",
                max_tokens=256
            )
            
            print(f"LLM回复: {response.message}")
            print(f"请求成功: {response.success}")
            
            # 获取连接状态
            status = llm_interface.get_connection_status()
            print(f"连接状态: {status}")
            
            # 导出日志
            llm_interface.export_logs("example_logs.json")
        
    except Exception as e:
        print(f"发生错误: {e}")
    finally:
        await llm_interface.disconnect()


if __name__ == "__main__":
    # 运行示例
    asyncio.run(example_usage())