import React, { useState, useContext } from 'react'
import { View, Text, StyleSheet, Alert } from 'react-native'
import { supabase } from '../../lib/supabase'
import Button from './Button'
import TextInputBox from './TextInputBox'
import { colors, fontSize } from '../theme'
import { ColorSchemeContext } from '../context/ColorSchemeContext'

export default function EmailVerification({ email, isRegistration = false, registrationData = null, onVerificationComplete }) {
  const [verificationCode, setVerificationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const { scheme } = useContext(ColorSchemeContext)
  const isDark = scheme === 'dark'
  const colorScheme = {
    text: isDark ? colors.white : colors.primaryText,
  }

  const verifyEmail = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('请输入验证码')
      return
    }

    try {
      setLoading(true)
      console.log('Verifying OTP:', { email, token: verificationCode, isRegistration })
      
      // Verify OTP - for signInWithOtp, always use 'email' type
      const { data, error } = await supabase.auth.verifyOtp({
        email: email,
        token: verificationCode,
        type: 'email'
      })

      if (error) {
        console.error('OTP verification error:', error)
        Alert.alert('验证失败', error.message)
        return
      }

      console.log('OTP verification successful:', data)

      // If this is registration, create user profile
      if (isRegistration && registrationData && data.user) {
        const profileData = {
          id: data.user.id,
          email: data.user.email,
          full_name: registrationData.fullName,
          avatar_url: registrationData.defaultAvatar,
          created_at: new Date().toISOString(),
        }

        console.log('Creating user profile:', profileData)
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([profileData])

        if (profileError) {
          console.error('Error creating profile:', profileError)
          // Continue anyway as the user was created successfully
        }

        // Set password if provided
        if (registrationData.password) {
          const { error: passwordError } = await supabase.auth.updateUser({
            password: registrationData.password
          })
          
          if (passwordError) {
            console.error('Error setting password:', passwordError)
          }
        }
      }

      Alert.alert('验证成功', isRegistration ? '注册成功！' : '登录成功！')
      onVerificationComplete()
    } catch (error) {
      Alert.alert('验证失败', error.message)
    } finally {
      setLoading(false)
    }
  }

  const resendVerification = async () => {
    try {
      setResendLoading(true)
      
      if (isRegistration) {
        // For registration, resend with registration data
        const { error } = await supabase.auth.signInWithOtp({
          email: email,
          options: registrationData ? {
            data: {
              full_name: registrationData.fullName,
              avatar_url: registrationData.defaultAvatar,
              password: registrationData.password,
            }
          } : undefined
        })

        if (error) {
          Alert.alert('发送失败', error.message)
          return
        }
      } else {
        // For login, just resend OTP
        const { error } = await supabase.auth.signInWithOtp({
          email: email,
        })

        if (error) {
          Alert.alert('发送失败', error.message)
          return
        }
      }

      Alert.alert('验证码已重新发送', '请检查您的邮箱')
    } catch (error) {
      Alert.alert('发送失败', error.message)
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colorScheme.text }]}>验证您的邮箱</Text>
      <Text style={[styles.description, { color: colorScheme.text }]}>
        我们已向 {email} 发送了6位数字验证码，请检查您的邮箱并输入验证码。
      </Text>
      
      <TextInputBox
        placeholder="请输入6位验证码"
        value={verificationCode}
        onChangeText={setVerificationCode}
        keyboardType="numeric"
        autoCapitalize="none"
        maxLength={6}
      />
      
      <Button
        label={loading ? "验证中..." : "验证"}
        color={colors.primary}
        onPress={verifyEmail}
        disable={loading || !verificationCode.trim()}
      />
      
      <Button
        label={resendLoading ? "发送中..." : "重新发送验证码"}
        color={colors.blueLight}
        onPress={resendVerification}
        disable={resendLoading}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.xLarge,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: fontSize.middle,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
})