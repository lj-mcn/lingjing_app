import React, { useEffect, useContext } from 'react'
import { Text, View, StyleSheet } from 'react-native'
import { decode, encode } from 'base-64'
import { UserDataContext } from '../../context/UserDataContext'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'
import { AppContext } from '../../context/AppContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import { supabase } from '../../../lib/supabase'
import { colors, fontSize } from '../../theme'

if (!global.btoa) { global.btoa = encode }
if (!global.atob) { global.atob = decode }

export default function Initial() {
  const { setUserData } = useContext(UserDataContext)
  const { scheme } = useContext(ColorSchemeContext)
  const { setChecked, setLoggedIn } = useContext(AppContext)
  const isDark = scheme === 'dark'
  const colorScheme = {
    container: isDark ? colors.dark : colors.white,
    text: isDark ? colors.white : colors.primaryText,
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session ? 'User logged in' : 'User logged out')
      
      if (session?.user) {
        console.log('User UID:', session.user.id)
        
        // Get user profile from profiles table
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching user profile:', error)
          // Still allow login even if profile fetch fails
        }
        
        // Use profile data if available, otherwise use auth user data
        const userData = profileData || {
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.full_name || '',
          avatar_url: session.user.user_metadata?.avatar_url || '',
        }
        
        console.log('User data loaded:', userData)
        setUserData(userData)
        setLoggedIn(true)
        setChecked(true)
      } else {
        console.log('No user authenticated')
        setLoggedIn(false)
        setChecked(true)
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  return (
    <ScreenTemplate>
      <View style={[styles.container, { backgroundColor: colorScheme.container }]}>
        <Text style={[styles.title, { color: colorScheme.text }]}>loading...</Text>
      </View>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.xxxLarge,
    marginBottom: 20,
    textAlign: 'center',
  },
})
