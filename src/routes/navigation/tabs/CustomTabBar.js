import React, { useState } from 'react'
import { View, TouchableOpacity, Text, Animated, StyleSheet } from 'react-native'
import FontIcon from 'react-native-vector-icons/FontAwesome'
import { colors } from 'theme'

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const [buttonScales] = useState(
    state.routes.map(() => new Animated.Value(1))
  )

  const handleTabPress = (route, index, isFocused) => {
    // 动画效果
    Animated.sequence([
      Animated.timing(buttonScales[index], {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScales[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start()

    // 导航逻辑
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    })

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate({ name: route.name, merge: true })
    }
  }

  const getTabBarIcon = (routeName) => {
    switch (routeName) {
      case 'HomeTab':
        return 'home'
      case 'ProfileTab':
        return 'user'
      default:
        return 'home'
    }
  }

  const getTabBarLabel = (routeName) => {
    switch (routeName) {
      case 'HomeTab':
        return 'Home'
      case 'ProfileTab':
        return 'Profile'
      default:
        return 'Home'
    }
  }

  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index
        const tintColor = isFocused ? colors.lightPurple : colors.gray

        return (
          <Animated.View 
            key={route.key}
            style={[
              styles.tabItem,
              { transform: [{ scale: buttonScales[index] }] }
            ]}
          >
            <TouchableOpacity
              onPress={() => handleTabPress(route, index, isFocused)}
              style={styles.tabButton}
            >
              <FontIcon
                name={getTabBarIcon(route.name)}
                color={tintColor}
                size={24}
              />
              <Text style={[styles.tabLabel, { color: tintColor }]}>
                {getTabBarLabel(route.name)}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: 5,
    paddingTop: 5,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 2,
  },
})

export default CustomTabBar