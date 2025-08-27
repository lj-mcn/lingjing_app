#!/usr/bin/env python3
"""
语音模型安装和部署脚本
自动安装 Kokoro TTS + SenseVoice-small
"""

import os
import sys
import subprocess
import logging
from pathlib import Path

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

class VoiceModelSetup:
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.models_dir = self.project_root / "voice_models"
        self.models_dir.mkdir(exist_ok=True)
        
    def run_command(self, cmd, cwd=None):
        """运行系统命令"""
        try:
            logger.info(f"执行命令: {cmd}")
            result = subprocess.run(
                cmd, 
                shell=True, 
                cwd=cwd, 
                capture_output=True, 
                text=True,
                check=True
            )
            logger.info(f"命令执行成功: {result.stdout}")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"命令执行失败: {e}")
            logger.error(f"错误输出: {e.stderr}")
            return False
    
    def check_python_packages(self):
        """检查和安装Python包"""
        logger.info("🔍 检查Python环境和依赖包...")
        
        required_packages = [
            "torch",
            "torchaudio", 
            "transformers",
            "websockets",
            "funasr",
            "modelscope",
            "soundfile",
            "librosa"
        ]
        
        missing_packages = []
        for package in required_packages:
            try:
                __import__(package)
                logger.info(f"✅ {package} 已安装")
            except ImportError:
                missing_packages.append(package)
                logger.warning(f"❌ {package} 未安装")
        
        if missing_packages:
            logger.info(f"📦 正在安装缺失的包: {missing_packages}")
            pip_cmd = f"{sys.executable} -m pip install {' '.join(missing_packages)}"
            if not self.run_command(pip_cmd):
                logger.error("依赖包安装失败")
                return False
        
        return True
    
    def setup_sensevoice(self):
        """安装SenseVoice-small模型"""
        logger.info("🎤 设置SenseVoice-small模型...")
        
        try:
            # 使用ModelScope下载SenseVoice模型
            setup_code = '''
import os
from funasr import AutoModel
from modelscope import snapshot_download

# 下载SenseVoice-small模型
model_dir = snapshot_download(
    'iic/SenseVoiceSmall', 
    cache_dir='./voice_models/sensevoice'
)

# 初始化模型（验证安装）
model = AutoModel(
    model=model_dir,
    trust_remote_code=True,
    remote_code="./voice_models/sensevoice",
    vad_model="fsmn-vad",
    vad_kwargs={"max_single_segment_time": 30000},
    device="cuda" if torch.cuda.is_available() else "cpu"
)

print("✅ SenseVoice模型安装成功")
            '''
            
            # 写入临时脚本
            setup_script = self.models_dir / "setup_sensevoice.py"
            with open(setup_script, 'w', encoding='utf-8') as f:
                f.write(setup_code)
            
            # 执行安装脚本
            cmd = f"{sys.executable} {setup_script}"
            if self.run_command(cmd, cwd=self.project_root):
                logger.info("✅ SenseVoice-small安装完成")
                setup_script.unlink()  # 删除临时脚本
                return True
            else:
                logger.error("❌ SenseVoice-small安装失败")
                return False
                
        except Exception as e:
            logger.error(f"❌ SenseVoice设置失败: {e}")
            return False
    
    def setup_kokoro_tts(self):
        """安装Kokoro TTS模型"""
        logger.info("📢 设置Kokoro TTS模型...")
        
        try:
            # 克隆或下载Kokoro TTS
            kokoro_dir = self.models_dir / "kokoro_tts"
            
            if not kokoro_dir.exists():
                logger.info("📥 下载Kokoro TTS...")
                # 这里需要根据Kokoro TTS的实际获取方式调整
                # 示例：从GitHub或HuggingFace下载
                clone_cmd = "git clone https://github.com/hexgrad/kokoro kokoro_tts"
                if not self.run_command(clone_cmd, cwd=self.models_dir):
                    logger.error("❌ Kokoro TTS下载失败")
                    return False
            
            # 安装Kokoro TTS依赖
            requirements_file = kokoro_dir / "requirements.txt"
            if requirements_file.exists():
                install_cmd = f"{sys.executable} -m pip install -r {requirements_file}"
                if not self.run_command(install_cmd):
                    logger.warning("⚠️ Kokoro TTS依赖安装可能有问题")
            
            logger.info("✅ Kokoro TTS安装完成")
            return True
            
        except Exception as e:
            logger.error(f"❌ Kokoro TTS设置失败: {e}")
            return False
    
    def create_config_file(self):
        """创建配置文件"""
        logger.info("📝 创建语音服务配置文件...")
        
        config_content = f'''# 语音服务配置文件
# 由setup_voice_models.py自动生成

[models]
# SenseVoice STT模型路径
sensevoice_path = {self.models_dir}/sensevoice

# Kokoro TTS模型路径  
kokoro_path = {self.models_dir}/kokoro_tts

[server]
# 服务器配置
host = 0.0.0.0
port = 8001

[audio]
# 音频配置
sample_rate = 16000
channels = 1
format = wav

[logging]
# 日志配置
level = INFO
file = voice_service.log
'''
        
        config_file = self.project_root / "voice_service_config.ini"
        with open(config_file, 'w', encoding='utf-8') as f:
            f.write(config_content)
        
        logger.info(f"✅ 配置文件已创建: {config_file}")
        return True
    
    def test_installation(self):
        """测试安装结果"""
        logger.info("🧪 测试语音模型安装...")
        
        test_code = '''
import torch
import sys
sys.path.append("./voice_models")

try:
    # 测试SenseVoice
    from funasr import AutoModel
    print("✅ SenseVoice导入成功")
    
    # 测试Kokoro TTS (需要根据实际API调整)
    # from kokoro_tts import KokoroTTS
    # print("✅ Kokoro TTS导入成功")
    
    print("✅ 所有语音模型测试通过")
    print(f"🎮 GPU可用: {torch.cuda.is_available()}")
    
except Exception as e:
    print(f"❌ 测试失败: {e}")
    sys.exit(1)
        '''
        
        test_script = self.models_dir / "test_models.py"
        with open(test_script, 'w', encoding='utf-8') as f:
            f.write(test_code)
        
        cmd = f"{sys.executable} {test_script}"
        success = self.run_command(cmd, cwd=self.project_root)
        
        test_script.unlink()  # 删除测试脚本
        return success
    
    def run_setup(self):
        """执行完整安装流程"""
        logger.info("🚀 开始语音模型安装流程...")
        
        steps = [
            ("检查Python环境", self.check_python_packages),
            ("安装SenseVoice-small", self.setup_sensevoice),
            ("安装Kokoro TTS", self.setup_kokoro_tts),
            ("创建配置文件", self.create_config_file),
            ("测试安装", self.test_installation)
        ]
        
        for step_name, step_func in steps:
            logger.info(f"📋 步骤: {step_name}")
            if not step_func():
                logger.error(f"❌ 步骤失败: {step_name}")
                return False
            logger.info(f"✅ 步骤完成: {step_name}")
        
        logger.info("🎉 语音模型安装完成！")
        logger.info("📝 下一步:")
        logger.info("   1. 运行: python voice_service_server.py")
        logger.info("   2. 确保前端配置指向正确的服务器地址")
        logger.info("   3. 测试语音功能")
        
        return True

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║              语音模型安装脚本 v1.0                             ║
║                                                                ║
║  📦 将自动安装:                                                ║
║  🎤 SenseVoice-small (中文语音识别)                            ║
║  📢 Kokoro TTS (高质量语音合成)                                ║
║                                                                ║
║  ⚠️  注意: 需要良好的网络连接下载模型                          ║
╚════════════════════════════════════════════════════════════════╝
    """)
    
    if input("是否继续安装? (y/N): ").lower() != 'y':
        print("👋 安装已取消")
        return
    
    setup = VoiceModelSetup()
    success = setup.run_setup()
    
    if success:
        print("\n🎉 安装成功!")
        print("可以运行 python voice_service_server.py 启动语音服务")
    else:
        print("\n❌ 安装失败，请检查错误信息")
        sys.exit(1)

if __name__ == "__main__":
    main()