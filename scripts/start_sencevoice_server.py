#!/usr/bin/env python3
"""
启动SenceVoice WebSocket服务器的便捷脚本
"""

import subprocess
import sys
import os
import yaml

def check_dependencies():
    """检查Python依赖"""
    required_packages = ['websockets', 'pyyaml']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print("❌ 缺少以下Python包:")
        for package in missing_packages:
            print(f"   - {package}")
        print(f"\n安装命令: pip install {' '.join(missing_packages)}")
        return False
    
    return True

def main():
    print("🚀 启动SenceVoice WebSocket服务器")
    print("="*50)
    
    # 检查依赖
    if not check_dependencies():
        sys.exit(1)
    
    # 检查配置文件
    config_file = "sencevoice_server_config.yaml"
    if not os.path.exists(config_file):
        print(f"⚠️ 配置文件 {config_file} 不存在，创建默认配置...")
        subprocess.run([sys.executable, "sencevoice_websocket_server.py", "--create-config"])
        print(f"✅ 默认配置文件已创建: {config_file}")
        print("💡 请编辑配置文件，设置正确的模型路径后重新启动")
        return
    
    # 显示配置信息
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        server_config = config.get('server', {})
        features_config = config.get('features', {})
        
        print(f"📍 服务器地址: {server_config.get('host', '0.0.0.0')}:{server_config.get('port', 8000)}")
        print(f"🎤 关键词唤醒: {'启用' if features_config.get('enable_kws', True) else '禁用'}")
        print(f"🔐 声纹识别: {'启用' if features_config.get('enable_sv', True) else '禁用'}")
        print(f"🔑 唤醒词: {features_config.get('kws_keyword', 'ni hao xiao qian')}")
        print("="*50)
    except Exception as e:
        print(f"⚠️ 读取配置文件失败: {e}")
    
    # 启动服务器
    try:
        subprocess.run([sys.executable, "sencevoice_websocket_server.py"], check=True)
    except KeyboardInterrupt:
        print("\n👋 服务器已停止")
    except subprocess.CalledProcessError as e:
        print(f"\n❌ 服务器启动失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()