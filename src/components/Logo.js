import React from 'react'
import { Image, StyleSheet, Dimensions } from 'react-native'

const { width: screenWidth } = Dimensions.get('window')

export default function Logo() {
  return (
    <Image
      style={styles.logo}
      source={require('../../assets/images/欢迎来2 1.png')}
      resizeMode="contain"
    />
  )
}

const styles = StyleSheet.create({
  logo: {
    width: screenWidth,
    height: 200,
    alignSelf: 'center',
    marginVertical: 30,
  },
})
