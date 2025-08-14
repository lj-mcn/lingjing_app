import React, { useState, useContext, useEffect } from 'react'
import {
  Text, View, StyleSheet, LogBox,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { doc, getDoc } from 'firebase/firestore'
import Spinner from 'react-native-loading-spinner-overlay'
import { useNavigation } from '@react-navigation/native'
import { signInWithEmailAndPassword } from 'firebase/auth'
import ScreenTemplate from '../../components/ScreenTemplate'
import Button from '../../components/Button'
import TextInputBox from '../../components/TextInputBox'
import Logo from '../../components/Logo'
import { firestore, auth } from '../../firebase/config'
import { colors, fontSize } from '../../theme'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'

// To ignore a useless warning in terminal.
// https://stackoverflow.com/questions/44603362/setting-a-timer-for-a-long-period-of-time-i-e-multiple-minutes
LogBox.ignoreLogs(['Setting a timer'])

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [spinner, setSpinner] = useState(false)
  const navigation = useNavigation()
  const { scheme } = useContext(ColorSchemeContext)
  const isDark = scheme === 'dark'
  const colorScheme = {
    text: isDark ? colors.white : colors.primaryText,
  }

  const onFooterLinkPress = () => {
    navigation.navigate('Registration')
  }

  useEffect(() => {
    console.log('Login screen, ログイン画面')
  }, [])

  const onLoginPress = async () => {
    if (!email.trim() || !password.trim()) {
      alert('Please enter both email and password.')
      return
    }

    try {
      setSpinner(true)
      console.log('Attempting to sign in user:', email)
      const response = await signInWithEmailAndPassword(auth, email, password)
      const { uid } = response.user
      console.log('Sign in successful, UID:', uid)

      const usersRef = doc(firestore, 'users', uid)
      const firestoreDocument = await getDoc(usersRef)

      if (!firestoreDocument.exists()) {
        console.error('User document does not exist in Firestore')
        setSpinner(false)
        alert('User does not exist anymore.')
        return
      }

      console.log('Login successful, user data:', firestoreDocument.data())
      setSpinner(false)
      // 登录成功后，Navigation.js会自动切换到RootStack，RootStack会首先显示视频
    } catch (error) {
      console.error('Login error:', error.code, error.message)
      setSpinner(false)

      let errorMessage = 'Login failed. Please try again.'
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No user found with this email address.'
          break
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please try again.'
          break
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format.'
          break
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed login attempts. Please try again later.'
          break
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.'
          break
        default:
          errorMessage = error.message
      }

      alert(errorMessage)
    }
  }

  return (
    <ScreenTemplate>
      <KeyboardAwareScrollView
        style={styles.main}
        keyboardShouldPersistTaps="always"
      >
        <Logo />
        <TextInputBox
          placeholder="E-mail"
          onChangeText={(text) => setEmail(text)}
          autoCapitalize="none"
          value={email}
          keyboardType="email-address"
        />
        <TextInputBox
          secureTextEntry
          placeholder="Password"
          onChangeText={(text) => setPassword(text)}
          value={password}
          autoCapitalize="none"
        />
        <Button
          label="Log in"
          color={colors.primary}
          onPress={() => onLoginPress()}
        />
        <View style={styles.footerView}>
          <Text style={[styles.footerText, { color: colorScheme.text }]}>Don't have an account? <Text onPress={onFooterLinkPress} style={styles.footerLink}>Sign up</Text></Text>
        </View>
      </KeyboardAwareScrollView>
      <Spinner
        visible={spinner}
        textStyle={{ color: colors.white }}
        overlayColor="rgba(0,0,0,0.5)"
      />
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    width: '100%',
  },
  footerView: {
    flex: 1,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  footerText: {
    fontSize: fontSize.large,
  },
  footerLink: {
    color: colors.blueLight,
    fontWeight: 'bold',
    fontSize: fontSize.large,
  },
})
