import React, { useEffect, useContext } from 'react'
import { Text, View, StyleSheet } from 'react-native'
import ScreenTemplate from '../../components/ScreenTemplate'
import Button from '../../components/Button'
import DigitalAvatar from '../../components/DigitalAvatar'
import { colors, fontSize } from 'theme'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'
import { UserDataContext } from '../../context/UserDataContext'
import { useNavigation } from '@react-navigation/native'

export default function Follow() {
  const navigation = useNavigation()
  const { userData } = useContext(UserDataContext)
  const { scheme } = useContext(ColorSchemeContext)
  const isDark = scheme === 'dark'
  const colorScheme = {
    text: isDark? colors.white : colors.primaryText
  }

  useEffect(() => {
    console.log('Follow screen')
  }, [])

  return (
    <ScreenTemplate>
      <View style={[styles.container]}>
        <View style={styles.avatarContainer}>
          <DigitalAvatar 
            style={styles.avatar}
            videoStyle={styles.avatarVideo}
          />
          <Text style={[styles.welcomeText, {color: colorScheme.text}]}>
            欢迎来到连接页面！
          </Text>
          <Text style={[styles.avatarName, {color: colorScheme.text}]}>
            嘎巴龙数字人
          </Text>
        </View>
        
        <View style={styles.buttonContainer}>
          <Button
            label='互动对话'
            color={colors.tertiary}
            onPress={() => {
              navigation.navigate('ModalStacks', {
                screen: 'Post',
                params: {
                  data: userData,
                  from: 'Follow screen'
                }
              })
            }}
          />
        </View>
      </View>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    width:'100%',
    paddingVertical: 40,
  },
  avatarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  avatar: {
    marginBottom: 20,
  },
  avatarVideo: {
    width: 250,
    height: 350,
    borderRadius: 20,
  },
  welcomeText: {
    fontSize: fontSize.large,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600',
  },
  avatarName: {
    fontSize: fontSize.middle,
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.8,
  },
  buttonContainer: {
    width: '80%',
    marginBottom: 20,
  },
})