import React, { useContext } from 'react'
import { Text, View, StyleSheet } from 'react-native'
import ScreenTemplate from '../../components/ScreenTemplate'
import { colors, fontSize } from '../../theme'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'

export default function Blank() {
  const { scheme } = useContext(ColorSchemeContext)
  const isDark = scheme === 'dark'
  const colorScheme = {
    content: isDark ? styles.darkContent : styles.lightContent,
    text: isDark ? colors.white : colors.primaryText,
  }

  return (
    <ScreenTemplate>
      <View style={colorScheme.content}>
        <Text style={[styles.title, { color: colorScheme.text }]}>空白页面</Text>
        <Text style={[styles.subtitle, { color: colorScheme.text }]}>
          这是一个新的空白页面
        </Text>
      </View>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  lightContent: {
    backgroundColor: colors.lightyellow,
    padding: 20,
    borderRadius: 5,
    margin: 30,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkContent: {
    backgroundColor: colors.gray,
    padding: 20,
    borderRadius: 5,
    margin: 30,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.xxxLarge,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: fontSize.middle,
    textAlign: 'center',
  },
})
