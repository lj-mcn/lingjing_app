#!/usr/bin/env node
/**
 * 服务器配置验证脚本
 * 验证所有配置文件中的服务器地址是否已正确更新为 10.91.225.137
 */

const fs = require('fs')
const path = require('path')

console.log('🔍 验证服务器配置...\n')

// 检查 .env 文件
console.log('📄 检查 .env 文件:')
try {
  const envContent = fs.readFileSync('.env', 'utf8')
  const llmServerUrl = envContent.match(/LLM_SERVER_URL=(.+)/)?.[1]
  
  if (llmServerUrl === 'ws://10.91.225.137:8000') {
    console.log('  ✅ LLM_SERVER_URL 已正确设置为: ws://10.91.225.137:8000')
  } else {
    console.log(`  ❌ LLM_SERVER_URL 当前值: ${llmServerUrl}`)
  }
} catch (error) {
  console.log('  ❌ 无法读取 .env 文件')
}

// 检查 llmConfig.js 文件
console.log('\n📄 检查 src/config/llmConfig.js:')
try {
  const configContent = fs.readFileSync('src/config/llmConfig.js', 'utf8')
  
  if (configContent.includes("'ws://10.91.225.137:8000'")) {
    console.log('  ✅ 默认服务器地址已更新为: ws://10.91.225.137:8000')
  } else {
    console.log('  ❌ 默认服务器地址未更新')
  }
  
  if (configContent.includes('192.168.18.138')) {
    console.log('  ✅ 备用服务器地址保留了 192.168.18.138')
  }
} catch (error) {
  console.log('  ❌ 无法读取 llmConfig.js 文件')
}

// 检查 senceVoiceConfig.js 文件
console.log('\n📄 检查 src/config/senceVoiceConfig.js:')
try {
  const senceVoiceContent = fs.readFileSync('src/config/senceVoiceConfig.js', 'utf8')
  
  if (senceVoiceContent.includes("'ws://10.91.225.137:8000'")) {
    console.log('  ✅ SenceVoice 主服务器地址已更新为: ws://10.91.225.137:8000')
  } else {
    console.log('  ❌ SenceVoice 主服务器地址未更新')
  }
} catch (error) {
  console.log('  ❌ 无法读取 senceVoiceConfig.js 文件')
}

// 检查 YAML 配置文件
console.log('\n📄 检查 llm_config 2.yaml:')
try {
  const yamlContent = fs.readFileSync('llm_config 2.yaml', 'utf8')
  
  if (yamlContent.includes('ws://10.91.225.137:8000')) {
    console.log('  ✅ YAML 配置中主服务器地址已更新')
  } else {
    console.log('  ❌ YAML 配置中主服务器地址未更新')
  }
} catch (error) {
  console.log('  ❌ 无法读取 llm_config 2.yaml 文件')
}

// 检查文档文件
console.log('\n📄 检查 EXPO_DIGITAL_HUMAN_GUIDE.md:')
try {
  const docContent = fs.readFileSync('EXPO_DIGITAL_HUMAN_GUIDE.md', 'utf8')
  
  if (docContent.includes('10.91.225.137:8000')) {
    console.log('  ✅ 文档中服务器地址已更新')
  } else {
    console.log('  ❌ 文档中服务器地址未更新')
  }
} catch (error) {
  console.log('  ❌ 无法读取 EXPO_DIGITAL_HUMAN_GUIDE.md 文件')
}

console.log('\n🔧 配置优先级说明:')
console.log('1. 主服务器: 10.91.225.137:8000')
console.log('2. 备用服务器1: 192.168.18.138:8000 (之前的IP)')
console.log('3. 备用服务器2: localhost:8000 (本地开发)')
console.log('4. 备用服务器3: 127.0.0.1:8000 (本地环回)')

console.log('\n🚀 使用建议:')
console.log('- 确保 10.91.225.137 服务器上运行了 LLM 服务')
console.log('- 检查网络连通性: ping 10.91.225.137')
console.log('- 测试 WebSocket 连接: telnet 10.91.225.137 8000')
console.log('- 如果主服务器不可用，系统会自动尝试备用服务器')

console.log('\n✅ 配置验证完成!')