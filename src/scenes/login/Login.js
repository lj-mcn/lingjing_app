import React, { useState, useContext, useEffect } from 'react'
import {
  Text, View, StyleSheet, LogBox, Alert,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import Spinner from 'react-native-loading-spinner-overlay'
import { useNavigation } from '@react-navigation/native'
import ScreenTemplate from '../../components/ScreenTemplate'
import Button from '../../components/Button'
import TextInputBox from '../../components/TextInputBox'
import Logo from '../../components/Logo'
import EmailVerification from '../../components/EmailVerification'
import { supabase } from '../../../lib/supabase'
import { colors, fontSize } from '../../theme'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'
import { UserDataContext } from '../../context/UserDataContext'
import { AppContext } from '../../context/AppContext'

// To ignore a useless warning in terminal.
// https://stackoverflow.com/questions/44603362/setting-a-timer-for-a-long-period-of-time-i-e-multiple-minutes
LogBox.ignoreLogs(['Setting a timer'])

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [spinner, setSpinner] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [useOtpLogin, setUseOtpLogin] = useState(false)
  const navigation = useNavigation()
  const { scheme } = useContext(ColorSchemeContext)
  const { setUserData } = useContext(UserDataContext)
  const { setLoggedIn, setChecked } = useContext(AppContext)
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

  const onOtpLoginPress = async () => {
    if (!email.trim()) {
      console.error('OTP login validation failed: Missing email')
      Alert.alert('错误', '请输入邮箱地址')
      return
    }

    try {
      setSpinner(true)
      console.log('Sending OTP to email:', email)

      const { error } = await supabase.auth.signInWithOtp({
        email,
      })

      if (error) {
        throw error
      }

      console.log('OTP sent successfully')
      setUnverifiedEmail(email)
      setShowVerification(true)
      setSpinner(false)
    } catch (error) {
      console.error('OTP login error:', error.message)
      setSpinner(false)
      Alert.alert('发送失败', error.message)
    }
  }

  const onLoginPress = async () => {
    if (useOtpLogin) {
      await onOtpLoginPress()
      return
    }

    if (!email.trim() || !password.trim()) {
      console.error('Login validation failed: Missing email or password')
      Alert.alert('错误', '请输入邮箱和密码')
      return
    }

    try {
      setSpinner(true)
      console.log('Attempting to sign in user:', email)

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      console.log('Sign in successful, UID:', data.user.id)

      // Get user profile from profiles table or auth.users
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching user profile:', profileError)
      }

      // Manually update context to trigger navigation
      const userData = userProfile || {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || '',
        avatar_url: data.user.user_metadata?.avatar_url || '',
      }

      console.log('Login successful, user data:', userData)
      setUserData(userData)
      setLoggedIn(true)
      setChecked(true)
      setSpinner(false)
    } catch (error) {
      console.error('Login error:', error.message)
      setSpinner(false)

      let errorMessage = 'Login failed. Please try again.'
      switch (error.message) {
        case 'Invalid login credentials':
          errorMessage = 'Invalid email or password. Please try again.'
          break
        case 'Email not confirmed':
          // Show verification screen for unconfirmed email
          setUnverifiedEmail(email)
          setShowVerification(true)
          return
        case 'Too many requests':
          errorMessage = 'Too many failed login attempts. Please try again later.'
          break
        default:
          errorMessage = error.message || 'An unexpected error occurred.'
      }

      console.error('Login error message:', errorMessage)
      Alert.alert('登录失败', errorMessage)
    }
  }

  const onVerificationComplete = () => {
    setShowVerification(false)
    setUnverifiedEmail('')
    // The auth state change will handle navigation automatically
  }

  if (showVerification) {
    return (
      <ScreenTemplate>
        <EmailVerification
          email={unverifiedEmail}
          onVerificationComplete={onVerificationComplete}
        />
        <Spinner
          visible={spinner}
          textStyle={{ color: colors.white }}
          overlayColor="rgba(0,0,0,0.5)"
        />
      </ScreenTemplate>
    )
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
        {!useOtpLogin && (
          <TextInputBox
            secureTextEntry
            placeholder="Password"
            onChangeText={(text) => setPassword(text)}
            value={password}
            autoCapitalize="none"
          />
        )}
        <Button
          label={useOtpLogin ? '发送验证码' : '登录'}
          color={colors.primary}
          onPress={() => onLoginPress()}
        />
        <Button
          label={useOtpLogin ? '使用密码登录' : '使用验证码登录'}
          color={colors.blueLight}
          onPress={() => setUseOtpLogin(!useOtpLogin)}
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
