import React from 'react'
import { ImageBackground } from 'react-native'

const HeaderStyle = () => (
  <ImageBackground
    source={require('../../../../../assets/images/background.png')}
    style={{ flex: 1 }}
    resizeMode="cover"
  />
)

export default HeaderStyle
