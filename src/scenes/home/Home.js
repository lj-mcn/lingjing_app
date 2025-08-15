import React, {
  useEffect, useState, useContext, useLayoutEffect,
} from 'react'
import {
  Text, View, ScrollView, StyleSheet, TouchableOpacity, Image, Animated, ImageBackground,
} from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import { useNavigation } from '@react-navigation/native'
import MenuOverlay from '../../components/MenuOverlay'
import IconButton from '../../components/IconButton'
import { colors } from '../../theme'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'

export default function Home() {
  const navigation = useNavigation()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [weather] = useState({ temp: '22°C', condition: '晴朗' })
  const [showMenu, setShowMenu] = useState(false)
  const [arrowOpacity] = useState(new Animated.Value(1))
  const [navButtonScale] = useState(new Animated.Value(1))
  const { scheme } = useContext(ColorSchemeContext)
  const isDark = scheme === 'dark'
  const colorScheme = {
    background: isDark ? colors.black : colors.white,
    text: isDark ? colors.white : colors.primaryText,
  }

  // 更新当前时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 箭头忽明忽暗动画
  useEffect(() => {
    const fadeAnimation = () => {
      Animated.sequence([
        Animated.timing(arrowOpacity, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(arrowOpacity, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]).start(() => fadeAnimation())
    }
    fadeAnimation()
  }, [])

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setShowMenu(true)}
        >
          <Image
            source={require('../../../assets/images/嘎巴龙菜单栏.png')}
            style={styles.menuButtonImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      ),
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
    console.log('Tapped header button')
    // alert('Tapped header button')
  }

  const handleBackToVillage = () => {
    // 直接导航到垃圾村漫游视频，不显示商店提示
    navigation.navigate('VillageVideo', { mode: 'returnToVillage' })
  }

  const handleOpenBlindBox = () => {
    // 导航到盲盒视频页面
    navigation.navigate('BlindBoxVideo')
  }

  // 导航按钮颤抖效果
  const triggerShakeAnimation = () => {
    Animated.sequence([
      Animated.timing(navButtonScale, {
        toValue: 1.1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(navButtonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(navButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const onLeftArrowPress = () => {
    triggerShakeAnimation()
    navigation.navigate('Voice')
  }

  const onRightArrowPress = () => {
    triggerShakeAnimation()
    navigation.navigate('Text')
  }

  const formatTime = (date) => date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const formatDate = (date) => date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  const swipeGesture = Gesture.Pan()
    .onEnd((event) => {
      const { translationX, velocityX } = event

      // 检测左滑手势: 向左滑动超过100像素或速度足够快
      if (translationX < -100 || velocityX < -500) {
        navigation.navigate('Voice')
      }
      // 检测右滑手势: 向右滑动超过100像素或速度足够快
      if (translationX > 100 || velocityX > 500) {
        navigation.navigate('Text')
      }
    })

  return (
    <ImageBackground
      source={require('../../../assets/images/background.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <GestureHandlerRootView style={styles.gestureContainer}>
        <GestureDetector gesture={swipeGesture}>
          <View style={styles.content}>
            <ScrollView style={styles.main} showsVerticalScrollIndicator={false}>
              {/* 时间天气信息块 */}
              <View style={styles.infoContainer}>
                <Text style={[styles.timeText, { color: colorScheme.text }]}>
                  {formatTime(currentTime)}
                </Text>
                <Text style={[styles.dateText, { color: colorScheme.text }]}>
                  {formatDate(currentTime)}
                </Text>
                <View style={styles.weatherContainer}>
                  <Text style={[styles.weatherText, { color: colorScheme.text }]}>
                    {weather.condition} {weather.temp}
                  </Text>
                </View>
              </View>

              {/* 导航箭头 */}
              <View style={styles.arrowContainer}>
                <Animated.View style={[styles.arrowWrapper, { opacity: arrowOpacity, transform: [{ scale: navButtonScale }] }]}>
                  <TouchableOpacity onPress={onLeftArrowPress}>
                    <Image
                      source={require('../../../assets/images/左.png')}
                      style={styles.arrowImage}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </Animated.View>
                <Animated.View style={[styles.arrowWrapper, { opacity: arrowOpacity, transform: [{ scale: navButtonScale }] }]}>
                  <TouchableOpacity onPress={onRightArrowPress}>
                    <Image
                      source={require('../../../assets/images/右.png')}
                      style={styles.arrowImage}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </Animated.View>
              </View>

            </ScrollView>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>

      {/* 菜单覆盖层 */}
      <MenuOverlay
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        isDark={isDark}
        onBackToVillage={handleBackToVillage}
        onOpenBlindBox={handleOpenBlindBox}
      />
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gestureContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  main: {
    flex: 1,
    paddingHorizontal: 20,
  },
  infoContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    marginTop: 60,
  },
  timeText: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 18,
    marginBottom: 20,
    opacity: 0.8,
  },
  weatherContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  weatherText: {
    fontSize: 16,
    fontWeight: '500',
  },
  arrowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    marginVertical: 30,
  },
  arrowWrapper: {
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 24,
    fontWeight: '600',
  },
  arrowImage: {
    width: 80,
    height: 80,
  },
  menuButton: {
    paddingLeft: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginLeft: 10,
  },
  menuButtonImage: {
    width: 32,
    height: 32,
  },
})
