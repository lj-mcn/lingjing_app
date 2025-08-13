import React from 'react'
<<<<<<< HEAD
import { Image, StyleSheet } from 'react-native'
=======
import { Image, StyleSheet, Dimensions } from 'react-native'

const { width: screenWidth } = Dimensions.get('window')
>>>>>>> 813-llm

export default function Logo() {
  return (
    <Image
      style={styles.logo}
<<<<<<< HEAD
      source={require('../../assets/images/icon.png')}
=======
      source={require('../../assets/images/欢迎来2 1.png')}
      resizeMode="contain"
>>>>>>> 813-llm
    />
  )
}

const styles = StyleSheet.create({
  logo: {
<<<<<<< HEAD
    flex: 1,
    height: 180,
    width: 180,
    alignSelf: 'center',
    margin: 30,
    borderRadius: 20,
=======
    width: screenWidth,
    height: 200,
    alignSelf: 'center',
    marginVertical: 30,
>>>>>>> 813-llm
  },
})
