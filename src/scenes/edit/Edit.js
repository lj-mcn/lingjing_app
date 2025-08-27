import React, { useState, useEffect, useContext } from 'react'
import {
  Text, View, StyleSheet, Platform,
} from 'react-native'
import { Avatar } from '@rneui/themed'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { useNavigation } from '@react-navigation/native'
import Spinner from 'react-native-loading-spinner-overlay'
import ScreenTemplate from '../../components/ScreenTemplate'
import Button from '../../components/Button'
import TextInputBox from '../../components/TextInputBox'
import { supabase } from '../../../lib/supabase'
import { colors, fontSize } from '../../theme'
import { UserDataContext } from '../../context/UserDataContext'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'
import { showToast } from '../../utils/ShowToast'

export default function Edit() {
  const { userData } = useContext(UserDataContext)
  const { scheme } = useContext(ColorSchemeContext)
  const navigation = useNavigation()
  const [fullName, setFullName] = useState(userData.full_name || userData.fullName)
  const [progress, setProgress] = useState('')
  const [avatar, setAvatar] = useState(userData.avatar_url || userData.avatar)
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [spinner, setSpinner] = useState(false)
  const isDark = scheme === 'dark'
  const colorScheme = {
    text: isDark ? colors.white : colors.primaryText,
    progress: isDark ? styles.darkprogress : styles.progress,
  }

  useEffect(() => {
    console.log('Edit screen')
  }, [])

  const ImageChoiceAndUpload = async () => {
    try {
      if (Platform.OS === 'ios') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (status !== 'granted') {
          console.error('Permission is required for use.')
          // alert('Permission is required for use.')
          return
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
      })
      if (!result.canceled) {
        const actions = []
        actions.push({ resize: { width: 300 } })
        const manipulatorResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          actions,
          {
            compress: 0.4,
          },
        )

        // Convert image to blob for upload
        const response = await fetch(manipulatorResult.uri)
        const blob = await response.blob()
        const arrayBuffer = await blob.arrayBuffer()

        const filename = `${userData.id}/${new Date().getTime()}.jpg`

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(filename, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          })

        if (error) {
          console.error('Upload failed:', error)
          // alert('Upload failed.')
          return
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filename)

        setProgress('')
        setAvatar(publicUrl)
      }
    } catch (e) {
      console.log('error', e.message)
      console.error('The size may be too much.')
      // alert('The size may be too much.')
    }
  }

  const profileUpdate = async () => {
    try {
      const data = {
        full_name: fullName,
        avatar_url: avatar,
      }

      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', userData.id)

      if (error) {
        throw error
      }

      navigation.goBack()
    } catch (e) {
      console.error('Profile update error:', e)
      // alert(e)
    }
  }

  const onUpdatePassword = async () => {
    if (password !== confirmPassword) {
      console.error("Passwords don't match.")
      // alert("Passwords don't match.")
      return
    }
    try {
      setSpinner(true)

      // Supabase requires re-authentication for password change
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: currentPassword,
      })

      if (signInError) {
        throw new Error('Current password is incorrect')
      }

      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        throw error
      }

      showToast({
        title: 'Password changed',
        body: 'Your password has changed.',
        isDark,
      })
      setCurrentPassword('')
      setPassword('')
      setConfirmPassword('')
    } catch (e) {
      console.log(e)
      console.error('Password update error:', e)
      // alert(e)
    } finally {
      setSpinner(false)
    }
  }

  return (
    <ScreenTemplate>
      <KeyboardAwareScrollView
        style={styles.main}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.avatar}>
          <Avatar
            size="xlarge"
            rounded
            onPress={ImageChoiceAndUpload}
            source={{ uri: avatar }}
          />
        </View>
        <Text style={colorScheme.progress}>{progress}</Text>
        <Text style={[styles.field, { color: colorScheme.text }]}>Name:</Text>
        <TextInputBox
          placeholder={fullName}
          onChangeText={(text) => setFullName(text)}
          value={fullName}
          autoCapitalize="none"
        />
        <Text style={[styles.field, { color: colorScheme.text }]}>Mail:</Text>
        <Text style={[styles.title, { color: colorScheme.text }]}>{userData.email}</Text>
        <Button
          label="Update"
          color={colors.primary}
          onPress={profileUpdate}
          disable={!fullName}
        />
        <View style={styles.changePasswordContainer}>
          <Text style={[styles.field, { color: colorScheme.text }]}>Change Password:</Text>
          <TextInputBox
            secureTextEntry
            placeholder="Current Password"
            onChangeText={(text) => setCurrentPassword(text)}
            value={currentPassword}
            autoCapitalize="none"
          />
          <TextInputBox
            secureTextEntry
            placeholder="New Password"
            onChangeText={(text) => setPassword(text)}
            value={password}
            autoCapitalize="none"
          />
          <TextInputBox
            secureTextEntry
            placeholder="Confirm New Password"
            onChangeText={(text) => setConfirmPassword(text)}
            value={confirmPassword}
            autoCapitalize="none"
          />
          <Button
            label="Change Password"
            color={colors.pink}
            onPress={onUpdatePassword}
            disable={!currentPassword || !password || !confirmPassword}
          />
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
  progress: {
    alignSelf: 'center',
  },
  darkprogress: {
    alignSelf: 'center',
    color: colors.white,
  },
  main: {
    flex: 1,
    width: '100%',
  },
  title: {
    fontSize: fontSize.xxxLarge,
    marginBottom: 20,
    textAlign: 'center',
  },
  field: {
    fontSize: fontSize.middle,
    textAlign: 'center',
  },
  avatar: {
    margin: 30,
    alignSelf: 'center',
  },
  changePasswordContainer: {
    paddingVertical: 30,
  },
})
