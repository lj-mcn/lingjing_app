import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import FontIcon from 'react-native-vector-icons/FontAwesome'
import { colors } from 'theme'
import CustomTabBar from './CustomTabBar'

// stack navigators
import { HomeNavigator, ProfileNavigator, ConnectNavigator } from '../stacks'

const Tab = createBottomTabNavigator()

const TabNavigator = () => (
  <Tab.Navigator
    tabBar={(props) => <CustomTabBar {...props} />}
    defaultScreenOptions={{
      headerShown: false,
      headerTransparent: true,
    }}
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.lightPurple,
      tabBarInactiveTintColor: colors.gray,
    })}
    initialRouteName="HomeTab"
    swipeEnabled={false}
  >
    <Tab.Screen
      name="HomeTab"
      component={HomeNavigator}
      options={{
        tabBarLabel: 'Home',
        tabBarIcon: ({ color, size }) => (
          <FontIcon
            name="home"
            color={color}
            size={size}
          />
        ),
      }}
    />
    <Tab.Screen
      name="ProfileTab"
      component={ProfileNavigator}
      options={{
        tabBarLabel: 'Profile',
        tabBarIcon: ({ color, size }) => (
          <FontIcon
            name="user"
            color={color}
            size={size}
          />
        ),
      }}
    />
  </Tab.Navigator>
)

export default TabNavigator
