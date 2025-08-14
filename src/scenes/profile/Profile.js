import React, { useState, useContext, useEffect } from 'react'
import {
  Text, View, StyleSheet, ScrollView,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Avatar } from '@rneui/themed'
import Dialog from 'react-native-dialog'
import Spinner from 'react-native-loading-spinner-overlay'
import { doc, deleteDoc } from 'firebase/firestore'
import { useNavigation } from '@react-navigation/native'
import { signOut, deleteUser } from 'firebase/auth'
import ScreenTemplate from '../../components/ScreenTemplate'
import Button from '../../components/Button'
import { firestore, auth } from '../../firebase/config'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'
import { UserDataContext } from '../../context/UserDataContext'
import { colors, fontSize } from '../../theme'
import { Restart } from '../../utils/Restart'

export default function Profile() {
  const { userData, setUserData } = useContext(UserDataContext)
  const navigation = useNavigation()
  const [visible, setVisible] = useState(false)
  const [spinner, setSpinner] = useState(false)
  const { scheme } = useContext(ColorSchemeContext)
  const isDark = scheme === 'dark'
  const colorScheme = {
    text: isDark ? colors.white : colors.primaryText,
  }

  useEffect(() => {
    console.log('Profile screen')
  }, [])

  const goDetail = () => {
    navigation.navigate('Edit', { userData })
  }

  const onSignOutPress = () => {
    signOut(auth)
      .then(async () => {
        await Restart()
      })
      .catch((error) => {
        console.log(error.message)
      })
  }

  const showDialog = () => {
    setVisible(true)
  }

  const handleCancel = () => {
    setVisible(false)
  }

  const accountDelete = async () => {
    try {
      setSpinner(true)
      const tokensDocumentRef = doc(firestore, 'tokens', userData.id)
      const usersDocumentRef = doc(firestore, 'users', userData.id)
      await deleteDoc(tokensDocumentRef)
      await deleteDoc(usersDocumentRef)
      const user = auth.currentUser
      deleteUser(user).then(() => {
        setSpinner(false)
        signOut(auth)
          .then(() => {
            console.log('user deleted')
          })
          .catch((error) => {
            console.log(error.message)
          })
      }).catch((error) => {
        setSpinner(false)
        console.log(error)
      })
    } catch (error) {
      console.log(error)
    }
  }

  return (
    <ScreenTemplate>
      <View style={styles.main}>
        <View style={styles.avatar}>
          <Avatar
            size="large"
            rounded
            source={{ uri: userData.avatar }}
          />
        </View>
        <View style={styles.infoContainer}>
          <Text style={[styles.fieldLabel, { color: colorScheme.text }]}>Name:</Text>
          <BlurView intensity={55} tint="regular" style={styles.textBackground}>
            <Text style={[styles.fieldValue, styles.timesFont, { color: colorScheme.text }]}>{userData.fullName}</Text>
          </BlurView>
          <Text style={[styles.fieldLabel, { color: colorScheme.text }]}>Mail:</Text>
          <BlurView intensity={55} tint="regular" style={styles.textBackground}>
            <Text style={[styles.fieldValue, styles.timesFont, { color: colorScheme.text }]}>{userData.email}</Text>
          </BlurView>
        </View>
        <Button
          label="Edit"
          color="#FFB366"
          style3D
          compact
          onPress={goDetail}
        />
        <Button
          label="Open Modal"
          color="#FF8C42"
          style3D
          compact
          onPress={() => {
            navigation.navigate('ModalStacks', {
              screen: 'Post',
              params: {
                data: userData,
                from: 'Profile screen',
              },
            })
          }}
        />
        <Button
          label="Delete account"
          color="#E65100"
          style3D
          compact
          onPress={showDialog}
        />
        <View style={styles.footerView}>
          <Text onPress={onSignOutPress} style={styles.footerLink}>Sign out</Text>
        </View>
      </View>
      <Dialog.Container visible={visible}>
        <Dialog.Title>Delete account</Dialog.Title>
        <Dialog.Description>
          Do you want to delete this account? You cannot undo this action.
        </Dialog.Description>
        <Dialog.Button label="Cancel" onPress={handleCancel} />
        <Dialog.Button label="Delete" onPress={accountDelete} />
      </Dialog.Container>
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
    justifyContent: 'space-evenly',
    paddingVertical: 10,
  },
  infoContainer: {
    marginHorizontal: 20,
    marginVertical: 15,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  textBackground: {
    marginVertical: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  fieldLabel: {
    fontSize: fontSize.middle,
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  fieldValue: {
    fontSize: fontSize.xLarge,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  timesFont: {
    fontFamily: 'Times New Roman',
  },
  avatar: {
    marginVertical: 10,
    alignSelf: 'center',
  },
  footerView: {
    alignItems: 'center',
    marginTop: 10,
  },
  footerLink: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: fontSize.large,
  },
})
