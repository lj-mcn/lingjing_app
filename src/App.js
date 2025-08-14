// 必须在最早导入弹窗拦截器
import './utils/DisableAlerts'
// 使用更安全的错误拦截器
import './utils/SimpleErrorInterceptor'
// 临时禁用运行时拦截器以修复应用崩溃问题
// import './utils/RuntimeAlertBlocker'
// import './utils/FinalSafetyNet'

import React, { useState, useEffect } from 'react'
import { View } from 'react-native'
import 'utils/ignore'
import { imageAssets } from 'theme/images'
import { fontAssets } from 'theme/fonts'
import { ColorSchemeContextProvider } from './context/ColorSchemeContext'
import { UserDataContextProvider } from './context/UserDataContext'
import { AppContextProvider } from './context/AppContext'
import { AppFlowProvider } from './context/AppFlowContext'

// assets
import Router from './routes'

const isHermes = () => !!global.HermesInternal

const App = () => {
  // state
  const [didLoad, setDidLoad] = useState(false)
  console.log('isHermes', isHermes())

  // handler
  const handleLoadAssets = async () => {
    // assets preloading
    await Promise.all([...imageAssets, ...fontAssets])
    setDidLoad(true)
  }

  // lifecycle
  useEffect(() => {
    handleLoadAssets()
  }, [])

  // rendering
  if (!didLoad) return <View />
  return (
    <AppContextProvider>
      <ColorSchemeContextProvider>
        <UserDataContextProvider>
          <AppFlowProvider>
            <Router />
          </AppFlowProvider>
        </UserDataContextProvider>
      </ColorSchemeContextProvider>
    </AppContextProvider>
  )
}

export default App
