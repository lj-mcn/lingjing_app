import React, { useEffect, useContext } from 'react'
import { Text, View, StyleSheet } from 'react-native'
import { doc, onSnapshot } from 'firebase/firestore'
import { decode, encode } from 'base-64'
import { onAuthStateChanged } from 'firebase/auth'
import { UserDataContext } from '../../context/UserDataContext'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'
import { AppContext } from '../../context/AppContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import { firestore, auth } from '../../firebase/config'
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
    onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'User logged out')
      if (user) {
        console.log('User UID:', user.uid)
        const usersRef = doc(firestore, 'users', user.uid)
        onSnapshot(usersRef, (querySnapshot) => {
          if (querySnapshot.exists()) {
            const userData = querySnapshot.data()
            console.log('User data loaded:', userData)
            setUserData(userData)
            setLoggedIn(true)
            setChecked(true)
          } else {
            console.error('User document does not exist in Firestore')
            setLoggedIn(false)
            setChecked(true)
          }
        }, (error) => {
          console.error('Error listening to user document:', error)
          setLoggedIn(false)
          setChecked(true)
        })
      } else {
        console.log('No user authenticated')
        setLoggedIn(false)
        setChecked(true)
      }
    })
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
