import React, { useState, useContext, useEffect } from 'react'
import { Platform } from 'react-native'
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack'
import * as Notifications from 'expo-notifications'
import { setDoc, doc } from 'firebase/firestore'
import * as Device from 'expo-device'
import TabNavigator from '../tabs/Tabs'
import { ModalStacks } from '../stacks/ModalStacks/ModalStacks'
import VideoPlayer from '../../../scenes/video'
import MusicSettings from '../../../scenes/musicSettings'
import { firestore } from '../../../firebase/config'
import { UserDataContext } from '../../../context/UserDataContext'
import { useAppFlow } from '../../../context/AppFlowContext'
import { expoProjectId } from '../../../config'

const Stack = createStackNavigator()

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export default function RootStack() {
  const { userData } = useContext(UserDataContext)
  const {
    videoWatched, musicSettingsCompleted, markVideoWatched, markMusicSettingsCompleted,
  } = useAppFlow()
  const isIos = Platform.OS === 'ios'

  const handleMusicChoice = (choice) => {
    console.log('Music choice:', choice)
    // 用户选择后进入视频播放阶段
    markMusicSettingsCompleted()
  }

  useEffect(() => {
    (async () => {
      const { isDevice } = Device
      if (!isDevice) return
      console.log('get push token')
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }
      if (finalStatus !== 'granted') {
        return
      }
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: expoProjectId,
      })
      const tokensRef = doc(firestore, 'tokens', userData.id)
      await setDoc(tokensRef, {
        token: token.data,
        id: userData.id,
      })
    })()
  }, [userData])

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log(notification.request.content)
    })
    return () => subscription.remove()
  }, [])

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {!videoWatched ? (
        <Stack.Screen
          name="IntroVideo"
          component={VideoPlayer}
          initialParams={{ onVideoEnd: () => markVideoWatched() }}
        />
      ) : !musicSettingsCompleted ? (
        <Stack.Screen
          name="MusicSettings"
          component={MusicSettings}
          initialParams={{ onMusicChoice: handleMusicChoice }}
        />
      ) : (
        <>
          <Stack.Screen
            name="HomeRoot"
            component={TabNavigator}
          />
          <Stack.Group
            screenOptions={{
              presentation: 'modal',
              headerShown: false,
              gestureEnabled: true,
              cardOverlayEnabled: true,
              ...TransitionPresets.ModalPresentationIOS,
              gestureEnabled: isIos,
            }}
          >
            <Stack.Screen
              name="ModalStacks"
              component={ModalStacks}
            />
          </Stack.Group>
        </>
      )}
    </Stack.Navigator>
  )
}
