import React, { useContext } from 'react'
import { StyleSheet, SafeAreaView, ImageBackground } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { colors } from '../theme'
import { ColorSchemeContext } from '../context/ColorSchemeContext'
import LoadingScreen from './LoadingScreen'
import ErrorScreen from './ErrorScreen'

export default function ScreenTemplate(props) {
  const { isLoading, isError } = props
  const { scheme } = useContext(ColorSchemeContext)
  const isDark = scheme === 'dark'
  const container = isDark ? styles.darkContainer : styles.container

  if (isLoading) {
    return <LoadingScreen />
  }

  if (isError) {
    return <ErrorScreen />
  }

  return (
    <SafeAreaView style={container}>
      <StatusBar style="light" />
      <ImageBackground
        source={require('../../assets/images/background.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {props.children}
      </ImageBackground>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  darkContainer: {
    flex: 1,
    backgroundColor: colors.black,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
})
