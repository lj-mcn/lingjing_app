import React, { useRef, useEffect } from 'react'
import { View, StyleSheet, Dimensions } from 'react-native'
import { Video } from 'expo-av'
import { StatusBar } from 'expo-status-bar'

const { width, height } = Dimensions.get('window')

export default function LoadingVideo({ route }) {
  const videoRef = useRef(null)
  const { onLoadingEnd } = route.params || {}

  useEffect(() => {
    // 自动播放加载视频
    if (videoRef.current) {
      videoRef.current.playAsync()
    }
  }, [])

  const handleVideoEnd = () => {
    console.log('Loading video finished')
    if (onLoadingEnd) {
      onLoadingEnd()
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Video
        ref={videoRef}
        style={styles.video}
        source={require('../../../assets/images/loading.mp4')}
        useNativeControls={false}
        resizeMode="cover"
        isLooping={false}
        shouldPlay
        onPlaybackStatusUpdate={(status) => {
          if (status.didJustFinish) {
            handleVideoEnd()
          }
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width,
    height,
  },
})
