import React, { useContext, useState } from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { ColorSchemeContext } from '../../../context/ColorSchemeContext'
import { lightProps, darkProps } from './navigationProps/navigationProps'
import HeaderStyle from './headerComponents/HeaderStyle'

import Login from '../../../scenes/login'
import Registration from '../../../scenes/registration'
import LoadingVideo from '../../../scenes/loadingVideo'

const Stack = createStackNavigator()

export const LoginNavigator = () => {
  const { scheme } = useContext(ColorSchemeContext)
  const [loadingCompleted, setLoadingCompleted] = useState(false)
  const navigationProps = scheme === 'dark' ? darkProps:lightProps

  const handleLoadingEnd = () => {
    setLoadingCompleted(true)
  }

  return (
    <Stack.Navigator screenOptions={navigationProps}>
      {!loadingCompleted ? (
        <Stack.Screen
          name="LoadingVideo"
          component={LoadingVideo}
          options={{
            headerShown: false,
          }}
          initialParams={{ onLoadingEnd: handleLoadingEnd }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Login"
            component={Login}
            options={({ navigation }) => ({
              headerBackground: scheme === 'dark' ? null: () => <HeaderStyle />,
            })}
          />
          <Stack.Screen
            name="Registration"
            component={Registration}
            options={({ navigation }) => ({
              headerBackground: scheme === 'dark' ? null: () => <HeaderStyle />,
            })}
          />
        </>
      )}
    </Stack.Navigator>
  )
}