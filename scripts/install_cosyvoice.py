#!/usr/bin/env python3
"""
CosyVoice TTS模型安装和配置脚本
自动安装CosyVoice模型及其依赖项
"""

import os
import sys
import subprocess
import argparse
import logging
from pathlib import Path

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CosyVoiceInstaller:
    """CosyVoice安装器"""
    
    def __init__(self, install_dir="./cosyvoice_models"):
        self.install_dir = Path(install_dir)
        self.repo_url = "https://github.com/FunAudioLLM/CosyVoice.git"
        self.model_dir = self.install_dir / "CosyVoice"
        self.pretrained_models_dir = self.model_dir / "pretrained_models"
        
    def check_system_requirements(self):
        """检查系统要求"""
        logger.info("🔍 检查系统要求...")
        
        # 检查Python版本
        if sys.version_info < (3, 8):
            logger.error("❌ Python版本需要3.8+，当前版本: " + sys.version)
            return False
        
        # 检查conda是否安装
        try:
            subprocess.run(["conda", "--version"], check=True, capture_output=True)
            logger.info("✅ Conda已安装")
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.error("❌ 未找到Conda，请先安装Anaconda或Miniconda")
            return False
        
        # 检查git是否安装
        try:
            subprocess.run(["git", "--version"], check=True, capture_output=True)
            logger.info("✅ Git已安装")
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.error("❌ 未找到Git，请先安装Git")
            return False
        
        logger.info("✅ 系统要求检查通过")
        return True
    
    def clone_repository(self):
        """克隆CosyVoice仓库"""
        logger.info("📥 克隆CosyVoice仓库...")
        
        if self.model_dir.exists():
            logger.info("📁 CosyVoice目录已存在，跳过克隆")
            return True
        
        try:
            self.install_dir.mkdir(parents=True, exist_ok=True)
            subprocess.run([
                "git", "clone", self.repo_url, str(self.model_dir)
            ], check=True)
            logger.info("✅ 仓库克隆完成")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ 克隆失败: {e}")
            return False
    
    def create_conda_environment(self, env_name="cosyvoice"):
        """创建Conda环境"""
        logger.info(f"🐍 创建Conda环境: {env_name}")
        
        try:
            # 检查环境是否已存在
            result = subprocess.run([
                "conda", "env", "list", "--json"
            ], capture_output=True, text=True)
            
            if env_name in result.stdout:
                logger.info(f"📦 环境 {env_name} 已存在")
                return True
            
            # 创建新环境
            subprocess.run([
                "conda", "create", "-n", env_name, "python=3.10", "-y"
            ], check=True)
            logger.info(f"✅ Conda环境 {env_name} 创建成功")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Conda环境创建失败: {e}")
            return False
    
    def install_dependencies(self, env_name="cosyvoice"):
        """安装依赖"""
        logger.info("📦 安装依赖...")
        
        try:
            # 进入项目目录并安装依赖
            commands = [
                f"cd {self.model_dir}",
                f"conda activate {env_name}",
                "pip install -r requirements.txt",
                "pip install torch torchvision torchaudio",  # 确保PyTorch已安装
                "pip install scipy",  # 用于音频处理
                "pip install soundfile",  # 音频文件读写
            ]
            
            # 在bash中执行命令
            full_command = " && ".join(commands)
            subprocess.run([
                "bash", "-c", full_command
            ], check=True)
            
            logger.info("✅ 依赖安装完成")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ 依赖安装失败: {e}")
            logger.error("💡 请手动执行以下命令:")
            logger.error(f"   cd {self.model_dir}")
            logger.error(f"   conda activate {env_name}")
            logger.error("   pip install -r requirements.txt")
            return False
    
    def download_pretrained_models(self):
        """下载预训练模型"""
        logger.info("⬇️ 下载预训练模型...")
        
        # CosyVoice模型下载链接（这些需要根据实际情况调整）
        models_to_download = [
            {
                "name": "CosyVoice2-0.5B",
                "url": "https://huggingface.co/FunAudioLLM/CosyVoice2-0.5B",
                "description": "CosyVoice2 0.5B参数模型"
            }
        ]
        
        self.pretrained_models_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info("📋 需要下载的模型列表:")
        for model in models_to_download:
            logger.info(f"   - {model['name']}: {model['description']}")
        
        logger.info("⚠️ 注意：模型文件较大，需要手动从以下地址下载:")
        for model in models_to_download:
            logger.info(f"   {model['name']}: {model['url']}")
        
        logger.info(f"📁 请将下载的模型文件放置在: {self.pretrained_models_dir}")
        
        return True
    
    def create_config_file(self):
        """创建配置文件"""
        logger.info("⚙️ 创建配置文件...")
        
        config_content = f"""# CosyVoice TTS 配置文件
# 
# 安装路径: {self.model_dir}
# 模型路径: {self.pretrained_models_dir}

[paths]
cosyvoice_repo = "{self.model_dir}"
pretrained_models = "{self.pretrained_models_dir}"
default_model = "{self.pretrained_models_dir}/CosyVoice2-0.5B"

[model_settings]
default_speaker = "中文女"
sample_rate = 22050
format = "wav"

[server_settings]
host = "0.0.0.0"
port = 8001
"""
        
        config_file = self.install_dir / "cosyvoice_config.ini"
        with open(config_file, 'w', encoding='utf-8') as f:
            f.write(config_content)
        
        logger.info(f"✅ 配置文件已创建: {config_file}")
        return True
    
    def create_startup_script(self, env_name="cosyvoice"):
        """创建启动脚本"""
        logger.info("🚀 创建启动脚本...")
        
        startup_script = f"""#!/bin/bash
# CosyVoice TTS服务启动脚本

echo "🚀 启动CosyVoice TTS服务..."
echo "📍 模型路径: {self.model_dir}"
echo "🔧 Conda环境: {env_name}"

# 激活conda环境
source $(conda info --base)/etc/profile.d/conda.sh
conda activate {env_name}

# 检查模型是否存在
if [ ! -d "{self.pretrained_models_dir}/CosyVoice2-0.5B" ]; then
    echo "❌ 未找到预训练模型，请先下载模型文件"
    echo "📁 模型应放置在: {self.pretrained_models_dir}/CosyVoice2-0.5B"
    exit 1
fi

# 设置Python路径
export PYTHONPATH="{self.model_dir}:$PYTHONPATH"

# 启动语音服务器
cd "$(dirname "$0")"
python VoiceServer.py --cosyvoice-path "{self.pretrained_models_dir}/CosyVoice2-0.5B" "$@"
"""
        
        script_file = self.install_dir.parent / "start_cosyvoice_server.sh"
        with open(script_file, 'w', encoding='utf-8') as f:
            f.write(startup_script)
        
        # 添加执行权限
        os.chmod(script_file, 0o755)
        
        logger.info(f"✅ 启动脚本已创建: {script_file}")
        logger.info("💡 使用方法: ./start_cosyvoice_server.sh")
        
        return True
    
    def create_test_script(self, env_name="cosyvoice"):
        """创建测试脚本"""
        logger.info("🧪 创建测试脚本...")
        
        test_content = f'''#!/usr/bin/env python3
"""
CosyVoice TTS测试脚本
"""

import sys
import os
sys.path.append("{self.model_dir}")

def test_cosyvoice_import():
    """测试CosyVoice导入"""
    try:
        from cosyvoice.cli.cosyvoice import CosyVoice2
        print("✅ CosyVoice导入成功")
        return True
    except ImportError as e:
        print(f"❌ CosyVoice导入失败: {{e}}")
        return False
    except Exception as e:
        print(f"⚠️ CosyVoice导入异常: {{e}}")
        return False

def test_model_loading():
    """测试模型加载"""
    try:
        model_path = "{self.pretrained_models_dir}/CosyVoice2-0.5B"
        if not os.path.exists(model_path):
            print(f"❌ 模型文件不存在: {{model_path}}")
            return False
        
        from cosyvoice.cli.cosyvoice import CosyVoice2
        cosyvoice = CosyVoice2(model_path)
        print("✅ 模型加载成功")
        return True
    except Exception as e:
        print(f"❌ 模型加载失败: {{e}}")
        return False

def main():
    print("🧪 CosyVoice TTS测试")
    print("=" * 40)
    
    # 测试导入
    if not test_cosyvoice_import():
        print("💡 请检查CosyVoice安装和环境配置")
        return
    
    # 测试模型加载
    if not test_model_loading():
        print("💡 请检查模型文件是否已下载到正确位置")
        return
    
    print("✅ 所有测试通过!")
    print("🎉 CosyVoice TTS已准备就绪")

if __name__ == "__main__":
    main()
'''
        
        test_file = self.install_dir.parent / "test_cosyvoice.py"
        with open(test_file, 'w', encoding='utf-8') as f:
            f.write(test_content)
        
        os.chmod(test_file, 0o755)
        
        logger.info(f"✅ 测试脚本已创建: {test_file}")
        logger.info("💡 使用方法: python test_cosyvoice.py")
        
        return True
    
    def install(self, env_name="cosyvoice"):
        """执行完整安装流程"""
        logger.info("🚀 开始CosyVoice安装流程...")
        
        steps = [
            ("检查系统要求", self.check_system_requirements),
            ("克隆仓库", self.clone_repository),
            ("创建Conda环境", lambda: self.create_conda_environment(env_name)),
            ("安装依赖", lambda: self.install_dependencies(env_name)),
            ("准备模型下载", self.download_pretrained_models),
            ("创建配置文件", self.create_config_file),
            ("创建启动脚本", lambda: self.create_startup_script(env_name)),
            ("创建测试脚本", lambda: self.create_test_script(env_name)),
        ]
        
        for step_name, step_func in steps:
            logger.info(f"📋 执行步骤: {step_name}")
            if not step_func():
                logger.error(f"❌ 步骤失败: {step_name}")
                return False
            logger.info(f"✅ 步骤完成: {step_name}")
        
        logger.info("🎉 CosyVoice安装完成!")
        self._print_next_steps()
        return True
    
    def _print_next_steps(self):
        """打印后续步骤说明"""
        print("""
╔══════════════════════════════════════════════════════════════════════╗
║                        🎉 CosyVoice安装完成!                        ║
╠══════════════════════════════════════════════════════════════════════╣
║  后续步骤:                                                           ║
║                                                                      ║
║  1. 下载预训练模型:                                                   ║
║     - 访问 https://huggingface.co/FunAudioLLM/CosyVoice2-0.5B       ║
║     - 下载模型文件到指定目录                                          ║
║                                                                      ║
║  2. 测试安装:                                                        ║
║     python test_cosyvoice.py                                        ║
║                                                                      ║
║  3. 启动服务:                                                        ║
║     ./start_cosyvoice_server.sh                                      ║
║                                                                      ║
║  4. 检查配置文件:                                                     ║
║     cosyvoice_models/cosyvoice_config.ini                           ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
        """)

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='CosyVoice TTS模型安装器')
    parser.add_argument('--install-dir', default='./cosyvoice_models', 
                       help='安装目录 (默认: ./cosyvoice_models)')
    parser.add_argument('--env-name', default='cosyvoice',
                       help='Conda环境名称 (默认: cosyvoice)')
    parser.add_argument('--check-only', action='store_true',
                       help='仅检查系统要求')
    
    args = parser.parse_args()
    
    installer = CosyVoiceInstaller(args.install_dir)
    
    if args.check_only:
        installer.check_system_requirements()
        return
    
    # 执行完整安装
    success = installer.install(args.env_name)
    
    if success:
        print("🎊 安装完成! 请按照上述步骤继续配置。")
    else:
        print("❌ 安装失败! 请检查错误信息并重试。")
        sys.exit(1)

if __name__ == "__main__":
    main()