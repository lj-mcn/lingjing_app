#!/bin/bash
# 启动脚本 - 解决中文路径问题

echo "🚀 启动数字人应用..."

# 设置环境变量以避免中文路径问题
export EXPO_SKIP_PROJECT_ROOT_HEADER=true

# 启动应用
npx expo start --clear

echo "✅ 应用已启动"