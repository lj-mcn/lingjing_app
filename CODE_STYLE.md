# 代码规范文档 (Code Style Guide)

本文档规定了本项目的代码风格和开发规范，旨在确保代码的一致性、可读性和可维护性。

## 目录

1. [通用规范](#通用规范)
2. [JavaScript/React Native 规范](#javascriptreact-native-规范)
3. [组件规范](#组件规范)
4. [文件命名规范](#文件命名规范)
5. [目录结构规范](#目录结构规范)
6. [代码注释规范](#代码注释规范)
7. [错误处理规范](#错误处理规范)
8. [性能优化规范](#性能优化规范)

## 通用规范

### 1. 代码格式化
- 使用 Prettier 进行代码格式化
- 使用单引号而非双引号
- 不使用分号结尾
- 使用 2 个空格缩进
- 保持尾随逗号

```javascript
// ✅ 正确
const config = {
  name: 'lingjing_app',
  version: '1.0.0',
}

// ❌ 错误  
const config = {
  "name": "lingjing_app",
  "version": "1.0.0"
};
```

### 2. ESLint 配置
- 遵循 Airbnb 代码规范
- 允许使用 console.log 进行调试
- 禁用分号规则
- 允许 JSX 在 .js 文件中

## JavaScript/React Native 规范

### 1. 导入顺序
按以下顺序组织导入语句：
1. React 相关库
2. React Native 组件
3. 第三方库
4. 本地组件
5. 配置和工具类
6. 样式

```javascript
// ✅ 正确的导入顺序
import React, { useEffect, useState, useContext } from 'react'
import {
  Text, View, ScrollView, StyleSheet, TouchableOpacity, Image,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { doc, onSnapshot } from 'firebase/firestore'

import IconButton from '../../components/IconButton'
import ScreenTemplate from '../../components/ScreenTemplate'
import { firestore } from '../../firebase/config'
import { colors, fontSize } from '../../theme'
```

### 2. 解构赋值
- 优先使用解构赋值提取 props 和状态

```javascript
// ✅ 正确
export default function Button(props) {
  const { label, onPress, color, disable } = props
  // ...
}

// ❌ 避免
export default function Button(props) {
  return (
    <TouchableOpacity onPress={props.onPress}>
      <Text>{props.label}</Text>
    </TouchableOpacity>
  )
}
```

### 3. 函数声明
- 优先使用函数声明而非箭头函数（除非在组件内部）
- 组件内部的事件处理函数使用箭头函数

```javascript
// ✅ 组件声明 - 使用函数声明
export default function Home() {
  // ✅ 事件处理函数 - 使用箭头函数
  const handlePress = () => {
    // 处理逻辑
  }
  
  return <View />
}
```

## 组件规范

### 1. 组件结构顺序
按以下顺序组织组件内容：
1. Props 解构
2. Hooks（useState, useEffect 等）
3. 事件处理函数
4. 渲染逻辑
5. StyleSheet 定义

```javascript
export default function MyComponent(props) {
  // 1. Props 解构
  const { label, onPress, disabled } = props
  
  // 2. Hooks
  const [state, setState] = useState(false)
  const navigation = useNavigation()
  
  useEffect(() => {
    // 副作用逻辑
  }, [])
  
  // 3. 事件处理函数
  const handlePress = () => {
    // 处理逻辑
  }
  
  // 4. 渲染逻辑
  return (
    <View style={styles.container}>
      <Text>{label}</Text>
    </View>
  )
}

// 5. 样式定义
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
```

### 2. 条件渲染
- 优先使用三元运算符进行条件渲染
- 复杂条件使用 && 运算符

```javascript
// ✅ 简单条件
{disabled ? (
  <View style={[styles.button, { opacity: 0.3 }]}>
    <Text>{label}</Text>
  </View>
) : (
  <TouchableOpacity style={styles.button} onPress={onPress}>
    <Text>{label}</Text>
  </TouchableOpacity>
)}

// ✅ 存在性检查
{token && (
  <Text style={styles.title}>{token.value}</Text>
)}
```

## 文件命名规范

### 1. 组件文件
- 使用 PascalCase 命名组件文件
- 每个目录包含 `index.js` 作为入口文件

```
src/
  components/
    Button.js          ✅ PascalCase
    IconButton.js      ✅ PascalCase
    index.js          ✅ 入口文件
```

### 2. 工具类文件
- 使用 PascalCase 命名
- 明确表达文件功能

```
src/
  utils/
    SendNotification.js  ✅ 明确的功能命名
    ShowToast.js        ✅ 明确的功能命名
    Storage.js          ✅ 明确的功能命名
```

### 3. 服务类文件
- 使用 PascalCase 命名，以 Service 结尾

```
src/
  services/
    LLMService.js           ✅ 服务类命名
    WebSocketService.js     ✅ 服务类命名
    DigitalHumanService.js  ✅ 服务类命名
```

## 目录结构规范

### 1. 分层架构
```
src/
├── components/     # 通用组件
├── scenes/         # 页面组件
├── services/       # 业务服务
├── utils/          # 工具函数
├── context/        # Context 提供者
├── theme/          # 主题配置
├── routes/         # 路由配置
└── config/         # 配置文件
```

### 2. 组件目录结构
```
scenes/
  home/
    Home.js         # 主组件
    index.js        # 导出文件
```

## 代码注释规范

### 1. 组件注释
- 为复杂组件添加功能说明
- 使用中文注释说明业务逻辑

```javascript
// ✅ 业务逻辑注释
const handleBackToVillage = () => {
  // 直接导航到垃圾村漫游视频，不显示商店提示
  navigation.navigate('VillageVideo', { mode: 'returnToVillage' })
}
```

### 2. 复杂逻辑注释
```javascript
// ✅ 手势检测逻辑说明
const swipeGesture = Gesture.Pan()
  .onEnd((event) => {
    const { translationX, velocityX } = event
    
    // 检测左滑手势: 向左滑动超过100像素或速度足够快
    if (translationX < -100 || velocityX < -500) {
      navigation.navigate('Voice')
    }
    // 检测右滑手势: 向右滑动超过100像素或速度足够快
    if (translationX > 100 || velocityX > 500) {
      navigation.navigate('Text')
    }
  })
```

## 错误处理规范

### 1. 异步操作错误处理
- 使用 try-catch 处理异步操作
- 提供有意义的错误信息

```javascript
// ✅ 正确的错误处理
async sendMessage(userMessage, options = {}) {
  try {
    if (!this.apiKey) {
      throw new Error('API密钥未配置')
    }
    
    const response = await axios.post(url, data)
    return response.data
  } catch (error) {
    console.error('发送消息失败:', error.message)
    throw error
  }
}
```

### 2. Firebase 错误处理
```javascript
// ✅ Firebase 监听错误处理
useEffect(() => {
  const tokensRef = doc(firestore, 'tokens', userData.id)
  const unsubscribe = onSnapshot(
    tokensRef, 
    (querySnapshot) => {
      if (querySnapshot.exists) {
        setToken(querySnapshot.data())
      } else {
        console.log('No such document!')
      }
    },
    (error) => {
      console.error('监听文档失败:', error)
    }
  )
  return () => unsubscribe()
}, [])
```

## 性能优化规范

### 1. useEffect 依赖
- 明确指定 useEffect 依赖数组
- 避免不必要的重新渲染

```javascript
// ✅ 明确依赖
useEffect(() => {
  fetchData()
}, [userId]) // 明确指定依赖

// ❌ 缺少依赖可能导致问题
useEffect(() => {
  fetchData()
}, []) // 如果 fetchData 依赖外部变量，应该添加到依赖数组
```

### 2. 资源引用优化
- 使用相对路径引用本地资源
- 合理使用 require 引用图片

```javascript
// ✅ 本地图片引用
<Image
  source={require('../../../assets/images/logo.png')}
  style={styles.logo}
  resizeMode="contain"
/>
```

### 3. 样式优化
- 将样式定义在组件外部
- 使用 StyleSheet.create 创建样式

```javascript
// ✅ 样式优化
const styles = StyleSheet.create({
  button: {
    marginHorizontal: 30,
    marginTop: 20,
    height: 48,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
```

## 工具配置

### 1. 开发脚本
```json
{
  "scripts": {
    "lint": "node_modules/.bin/eslint src/ --fix src/ --fix",
    "test": "node_modules/.bin/jest --passWithNoTests"
  }
}
```

### 2. Git Hooks
- 使用 husky 和 lint-staged 确保代码质量
- 提交前自动运行代码检查

```json
{
  "lint-staged": {
    "*.{js,jsx}": [
      "pretty-quick --staged",
      "yarn lint",
      "yarn test"
    ]
  }
}
```

## 总结

遵循这些代码规范可以：
- 提高代码可读性和可维护性
- 确保团队协作的一致性
- 减少代码审查的时间
- 降低bug出现的概率
- 提升应用性能

请在开发过程中严格遵循这些规范，并在代码审查时检查是否符合规范要求。