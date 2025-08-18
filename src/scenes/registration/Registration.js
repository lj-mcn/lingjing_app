import React, { useState, useContext, useEffect } from 'react'
import {
  Text, StyleSheet, View, Linking,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import Spinner from 'react-native-loading-spinner-overlay'
import { useNavigation } from '@react-navigation/native'
import ScreenTemplate from '../../components/ScreenTemplate'
import TextInputBox from '../../components/TextInputBox'
import Button from '../../components/Button'
import Logo from '../../components/Logo'
import EmailVerification from '../../components/EmailVerification'
import { supabase } from '../../../lib/supabase'
import { colors, fontSize } from '../../theme'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'
import { defaultAvatar, eulaLink } from '../../config'

export default function Registration() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [spinner, setSpinner] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [userRegistrationData, setUserRegistrationData] = useState(null)
  const navigation = useNavigation()
  const { scheme } = useContext(ColorSchemeContext)
  const isDark = scheme === 'dark'
  const colorScheme = {
    text: isDark ? colors.white : colors.primaryText,
  }

  useEffect(() => {
    console.log('Registration screen')
  }, [])

  const onFooterLinkPress = () => {
    navigation.navigate('Login')
  }

  const onRegisterPress = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      console.error('Registration validation failed: Missing required fields')
      // alert('Please fill in all fields.')
      return
    }

    if (password !== confirmPassword) {
      console.error('Registration validation failed: Passwords do not match')
      // alert("Passwords don't match.")
      return
    }

    if (password.length < 6) {
      console.error('Registration validation failed: Password too short')
      // alert('Password should be at least 6 characters long.')
      return
    }

    try {
      setSpinner(true)
      console.log('Sending OTP to email:', email)
      
      // Send OTP for registration
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          data: {
            full_name: fullName,
            avatar_url: defaultAvatar,
            password: password, // Store password temporarily for verification
          }
        }
      })

      if (error) {
        throw error
      }

      console.log('OTP sent successfully')
      console.log('Please check your email for verification code')
      
      // Store registration data for verification
      const registrationData = {
        email,
        fullName,
        password,
        defaultAvatar
      }
      
      // Show verification screen
      setRegisteredEmail(email)
      setUserRegistrationData(registrationData)
      setShowVerification(true)
      setSpinner(false)
    } catch (error) {
      console.error('Registration error:', error.message)
      setSpinner(false)

      let errorMessage = 'Registration failed. Please try again.'
      switch (error.message) {
        case 'User already registered':
          errorMessage = 'This email address is already in use.'
          break
        case 'Invalid email':
          errorMessage = 'Invalid email address format.'
          break
        case 'Password should be at least 6 characters':
          errorMessage = 'Password should be at least 6 characters long.'
          break
        case 'Unable to validate email address: invalid format':
          errorMessage = 'Invalid email address format.'
          break
        default:
          errorMessage = error.message || 'An unexpected error occurred.'
      }

      console.error('Registration error message:', errorMessage)
      // alert(errorMessage)
    }
  }

  const onVerificationComplete = () => {
    setShowVerification(false)
    navigation.navigate('Login')
  }

  if (showVerification) {
    return (
      <ScreenTemplate>
        <EmailVerification 
          email={registeredEmail}
          isRegistration={true}
          registrationData={userRegistrationData}
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
          placeholder="Your Name"
          onChangeText={(text) => setFullName(text)}
          value={fullName}
          autoCapitalize="none"
        />
        <TextInputBox
          placeholder="E-mail"
          onChangeText={(text) => setEmail(text)}
          value={email}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInputBox
          secureTextEntry
          placeholder="Password"
          onChangeText={(text) => setPassword(text)}
          value={password}
          autoCapitalize="none"
        />
        <TextInputBox
          secureTextEntry
          placeholder="Confirm Password"
          onChangeText={(text) => setConfirmPassword(text)}
          value={confirmPassword}
          autoCapitalize="none"
        />
        <Button
          label="Agree and Create account"
          color={colors.primary}
          onPress={() => onRegisterPress()}
        />
        <View style={styles.footerView}>
          <Text style={[styles.footerText, { color: colorScheme.text }]}>Already got an account? <Text onPress={onFooterLinkPress} style={styles.footerLink}>Log in</Text></Text>
        </View>
        <Text style={[styles.link, { color: colorScheme.text }]} onPress={() => { Linking.openURL(eulaLink) }}>Require agree <Text style={styles.eulaLink}>EULA</Text></Text>
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
  link: {
    textAlign: 'center',
  },
  eulaLink: {
    color: colors.blueLight,
    fontSize: fontSize.middle,
  },
})
