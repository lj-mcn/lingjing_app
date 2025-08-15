/**
 * Expo Metro 服务器中文路径修复脚本
 * 解决项目路径包含中文字符导致的HTTP头信息错误
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 正在修复 Metro 服务器中文路径问题...');

// 查找 Metro 中间件文件
const metroMiddlewarePath = path.join(
  __dirname,
  'node_modules/@expo/cli/src/start/server/metro/dev-server/createMetroMiddleware.js'
);

const metroMiddlewarePathTs = path.join(
  __dirname,
  'node_modules/@expo/cli/src/start/server/metro/dev-server/createMetroMiddleware.ts'
);

// 检查文件是否存在
let targetFile = null;
if (fs.existsSync(metroMiddlewarePathTs)) {
  targetFile = metroMiddlewarePathTs;
  console.log('📁 找到 TypeScript 文件:', targetFile);
} else if (fs.existsSync(metroMiddlewarePath)) {
  targetFile = metroMiddlewarePath;
  console.log('📁 找到 JavaScript 文件:', targetFile);
} else {
  console.log('❌ 未找到 Metro 中间件文件，尝试手动解决方案...');
  
  // 创建一个环境变量解决方案
  const packageJsonPath = path.join(__dirname, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // 添加脚本命令来设置环境变量
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    packageJson.scripts['start-fixed'] = 'NODE_OPTIONS="--max-http-header-size=32768" expo start';
    packageJson.scripts['start-web-fixed'] = 'NODE_OPTIONS="--max-http-header-size=32768" expo start --web';
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✅ 已添加修复脚本到 package.json');
    console.log('💡 请使用以下命令启动应用:');
    console.log('   npm run start-fixed');
    console.log('   或');
    console.log('   yarn start-fixed');
  }
  
  return;
}

try {
  // 读取文件内容
  let content = fs.readFileSync(targetFile, 'utf8');
  
  // 检查是否已经修复过
  if (content.includes('// CHINESE_PATH_FIX')) {
    console.log('✅ 文件已经修复过，无需重复修复');
    return;
  }
  
  // 查找设置头信息的代码行
  const headerRegex = /res\.setHeader\(['"]X-React-Native-Project-Root['"],\s*projectRoot\)/g;
  
  if (headerRegex.test(content)) {
    // 替换为安全的头信息设置
    content = content.replace(
      headerRegex,
      `// CHINESE_PATH_FIX: 修复中文路径问题
      try {
        // 只有在路径不包含非ASCII字符时才设置头信息
        if (/^[\x00-\x7F]*$/.test(projectRoot)) {
          res.setHeader('X-React-Native-Project-Root', projectRoot);
        } else {
          console.log('⚠️ 项目路径包含非ASCII字符，跳过设置 X-React-Native-Project-Root 头信息');
        }
      } catch (error) {
        console.log('⚠️ 设置项目根路径头信息失败:', error.message);
      }`
    );
    
    // 写回文件
    fs.writeFileSync(targetFile, content);
    console.log('✅ Metro 中间件文件已修复');
    console.log('🎯 现在可以正常启动应用了: npx expo start');
  } else {
    console.log('⚠️ 未找到目标代码行，可能 Expo 版本已更新');
    console.log('💡 请尝试将项目文件夹重命名为英文名称');
  }
  
} catch (error) {
  console.error('❌ 修复过程中出错:', error.message);
  console.log('💡 建议解决方案:');
  console.log('1. 将项目文件夹重命名为英文名称');
  console.log('2. 或使用以下命令启动:');
  console.log('   NODE_OPTIONS="--max-http-header-size=32768" npx expo start');
}

console.log('\n🚀 修复完成！');