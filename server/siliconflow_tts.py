#!/usr/bin/env python3
"""
SiliconFlow CosyVoice2-0.5B API 集成
云端语音合成服务
"""

import aiohttp
import base64
import logging
import asyncio
from typing import Dict, Any, Optional
import os

logger = logging.getLogger(__name__)

class SiliconFlowTTS:
    """SiliconFlow CosyVoice2 TTS API 客户端"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('SILICONFLOW_API_KEY')
        self.base_url = "https://api.siliconflow.cn/v1"
        self.model = "CosyVoice2-0.5B"
        
        # 支持的语音标签（通过文本标签控制）
        self.available_voices = {
            "中文女": "[S1]",
            "中文男": "[S2]", 
            "英文女": "[S3]",
            "英文男": "[S4]",
            "日语女": "[S5]",
            "韩语女": "[S6]",
            "粤语女": "[S7]",
            "四川话女": "[S8]"
        }
        
        self.voice_names = list(self.available_voices.keys())
        
        if not self.api_key:
            logger.warning("⚠️ 未找到SiliconFlow API密钥")
    
    async def text_to_speech(self, text: str, voice: str = "中文女", **kwargs) -> Dict[str, Any]:
        """
        文本转语音
        
        Args:
            text: 要合成的文本
            voice: 语音选择
            **kwargs: 其他参数(speed, volume等)
        """
        try:
            if not self.api_key:
                raise Exception("缺少SiliconFlow API密钥")
            
            # 直接使用原始文本，通过voice参数控制语音风格
            clean_text = text.strip()
            
            # 根据语音风格选择对应的voice参数  
            voice_mapping = {
                "中文女": "FunAudioLLM/CosyVoice2-0.5B:alex",
                "中文男": "FunAudioLLM/CosyVoice2-0.5B:alex",
                "英文女": "FunAudioLLM/CosyVoice2-0.5B:alex",
                "英文男": "FunAudioLLM/CosyVoice2-0.5B:alex",
            }
            
            voice_id = voice_mapping.get(voice, "FunAudioLLM/CosyVoice2-0.5B:alex")
            
            request_data = {
                "model": self.model,
                "input": clean_text,  # 使用清理后的文本，不包含语音标签
                "voice": voice_id,    # 通过voice参数控制语音风格
                "response_format": "wav",  # 确保返回WAV格式
                "speed": 1.0,
                "volume": 0.8  # 降低音量避免爆音
            }
            
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            logger.info(f"🔊 SiliconFlow TTS请求: {text[:50]}... 语音: {voice}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/audio/speech",
                    json=request_data,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    
                    if response.status == 200:
                        # 获取二进制音频数据
                        audio_data = await response.read()
                        
                        # 转换为base64
                        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                        
                        logger.info(f"✅ SiliconFlow TTS成功，音频大小: {len(audio_data)} bytes")
                        
                        return {
                            "success": True,
                            "audio_data": audio_base64,
                            "format": "wav",
                            "model": self.model,
                            "voice_style": voice,
                            "voice_id": voice_id,
                            "text_length": len(text),
                            "audio_size": len(audio_data),
                            "sample_rate": 22050,  # CosyVoice2 默认采样率
                            "provider": "SiliconFlow"
                        }
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ SiliconFlow API错误 {response.status}: {error_text}")
                        
                        return {
                            "success": False,
                            "error": f"SiliconFlow API错误 {response.status}: {error_text}"
                        }
                        
        except asyncio.TimeoutError:
            logger.error("❌ SiliconFlow API请求超时")
            return {
                "success": False,
                "error": "请求超时，请稍后重试"
            }
        except Exception as e:
            logger.error(f"❌ SiliconFlow TTS失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_voices(self) -> Dict[str, Any]:
        """获取可用语音列表"""
        return {
            "success": True,
            "voices": self.voice_names,
            "voice_tags": self.available_voices,
            "default_voice": "中文女",
            "model": self.model,
            "provider": "SiliconFlow"
        }
    
    def validate_api_key(self) -> bool:
        """验证API密钥是否存在"""
        return bool(self.api_key)
    
    async def test_connection(self) -> bool:
        """测试API连接"""
        try:
            result = await self.text_to_speech("测试", "中文女")
            return result["success"]
        except Exception as e:
            logger.error(f"SiliconFlow连接测试失败: {e}")
            return False

# 全局实例
siliconflow_tts = None

def get_siliconflow_tts(api_key: str = None) -> SiliconFlowTTS:
    """获取SiliconFlow TTS实例"""
    global siliconflow_tts
    if siliconflow_tts is None:
        siliconflow_tts = SiliconFlowTTS(api_key)
    return siliconflow_tts

# 异步测试函数
async def test_siliconflow_tts():
    """测试SiliconFlow TTS"""
    print("🧪 测试SiliconFlow TTS API...")
    
    api_key = os.getenv('SILICONFLOW_API_KEY')
    if not api_key:
        print("❌ 请设置SILICONFLOW_API_KEY环境变量")
        return False
    
    tts = SiliconFlowTTS(api_key)
    
    # 测试文本转语音
    result = await tts.text_to_speech("你好，我是SiliconFlow的CosyVoice2", "中文女")
    
    if result["success"]:
        print("✅ TTS测试成功!")
        print(f"模型: {result['model']}")
        print(f"音频大小: {result['audio_size']} bytes")
        print(f"提供商: {result['provider']}")
        return True
    else:
        print(f"❌ TTS测试失败: {result['error']}")
        return False

if __name__ == "__main__":
    # 运行测试
    asyncio.run(test_siliconflow_tts())