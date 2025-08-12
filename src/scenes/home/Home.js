import React, {
  useEffect, useState, useContext, useLayoutEffect,
} from 'react'
import {
  Text, View, ScrollView, StyleSheet, TouchableOpacity, Image,
} from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import { useNavigation } from '@react-navigation/native'
import { doc, onSnapshot } from 'firebase/firestore'
import IconButton from '../../components/IconButton'
import ScreenTemplate from '../../components/ScreenTemplate'
import Button from '../../components/Button'
import { firestore } from '../../firebase/config'
import { colors, fontSize } from '../../theme'
import { UserDataContext } from '../../context/UserDataContext'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'
import { sendNotification } from '../../utils/SendNotification'
import { getKilobyteSize } from '../../utils/functions'

export default function Home() {
  const navigation = useNavigation()
  const [token, setToken] = useState('')
  const { userData } = useContext(UserDataContext)
  const { scheme } = useContext(ColorSchemeContext)
  const isDark = scheme === 'dark'
  const colorScheme = {
    content: isDark ? styles.darkContent : styles.lightContent,
    text: isDark ? colors.white : colors.primaryText,
  }

  useEffect(() => {
    const str = 'Hello, こんにちは!'
    const kilobyteSize = getKilobyteSize({ str })
    console.log({ str, kilobyteSize })
  }, [])

  useEffect(() => {
    const obj = {
      name: 'name1',
      age: 15,
    }
    const kilobyteSize = getKilobyteSize({ str: obj })
    console.log({ obj, kilobyteSize })
  }, [])

  useEffect(() => {
    const array = ['name1', 'name2', 'name3']
    const kilobyteSize = getKilobyteSize({ str: array })
    console.log({ array, kilobyteSize })
  }, [])

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="align-right"
          color={colors.lightPurple}
          size={24}
          onPress={() => headerButtonPress()}
          containerStyle={{ paddingRight: 15 }}
        />
      ),
    })
  }, [navigation])

  const headerButtonPress = () => {
    alert('Tapped header button')
  }

  useEffect(() => {
    const tokensRef = doc(firestore, 'tokens', userData.id)
    const tokenListner = onSnapshot(tokensRef, (querySnapshot) => {
      if (querySnapshot.exists) {
        const data = querySnapshot.data()
        setToken(data)
      } else {
        console.log('No such document!')
      }
    })
    return () => tokenListner()
  }, [])

  const onNotificationPress = async () => {
    const res = await sendNotification({
      title: 'Hello',
      body: 'This is some something 👋',
      data: 'something data',
      token: token.token,
    })
    console.log(res)
  }

  const onLeftButtonPress = () => {
    navigation.navigate('Detail', { userData, from: 'Home', title: 'Left Page' })
  }

  const onRightButtonPress = () => {
    navigation.navigate('ModalStacks', {
      screen: 'Post',
      params: {
        data: userData,
        from: 'Right Button',
      },
    })
  }

  const swipeGesture = Gesture.Pan()
    .onEnd((event) => {
      const { translationX, velocityX } = event

      // 检测左滑手势: 向左滑动超过100像素或速度足够快
      if (translationX < -100 || velocityX < -500) {
        navigation.navigate('Blank')
      }
    })

  return (
    <ScreenTemplate>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={swipeGesture}>
          <View style={{ flex: 1 }}>
            <ScrollView style={styles.main}>
              <View style={colorScheme.content}>
                <Text style={[styles.field, { color: colorScheme.text }]}>Mail:</Text>
                <Text style={[styles.title, { color: colorScheme.text }]}>{userData.email}</Text>
                {token
                  ? (
                    <>
                      <Text style={[styles.field, { color: colorScheme.text }]}>Expo push token:</Text>
                      <Text style={[styles.title, { color: colorScheme.text }]}>{token.token}</Text>
                    </>
                  ) : null}
              </View>
              <Button
                label="Go to Detail"
                color={colors.primary}
                onPress={() => navigation.navigate('Detail', { userData, from: 'Home', title: userData.email })}
              />
              <Button
                label="Open Modal"
                color={colors.tertiary}
                onPress={() => {
                  navigation.navigate('ModalStacks', {
                    screen: 'Post',
                    params: {
                      data: userData,
                      from: 'Home screen',
                    },
                  })
                }}
              />
              <Button
                label="Send Notification"
                color={colors.pink}
                onPress={() => onNotificationPress()}
                disable={!token}
              />
              <View style={styles.navigationContainer}>
                <TouchableOpacity style={styles.navButton} onPress={onLeftButtonPress}>
                  <Image
                    source={require('../../../assets/images/左.png')}
                    style={styles.navImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navButton} onPress={onRightButtonPress}>
                  <Image
                    source={require('../../../assets/images/右.png')}
                    style={styles.navImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  lightContent: {
    backgroundColor: colors.lightyellow,
    padding: 20,
    borderRadius: 5,
    marginTop: 30,
    marginLeft: 30,
    marginRight: 30,
  },
  darkContent: {
    backgroundColor: colors.gray,
    padding: 20,
    borderRadius: 5,
    marginTop: 30,
    marginLeft: 30,
    marginRight: 30,
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
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 50,
    marginTop: 20,
    marginBottom: 30,
  },
  navButton: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: colors.lightyellow,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  navImage: {
    width: 40,
    height: 40,
  },
})
