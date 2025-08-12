import React, { useRef, useEffect } from 'react'
import { View, StyleSheet, Dimensions } from 'react-native'
import { Video } from 'expo-av'
import { StatusBar } from 'expo-status-bar'

const { width, height } = Dimensions.get('window')

export default function VideoPlayer({ route }) {
  const videoRef = useRef(null)
  const { onVideoEnd } = route.params || {}

  useEffect(() => {
    // 自动播放视频
    if (videoRef.current) {
      videoRef.current.playAsync()
    }
  }, [])

  const handleVideoEnd = () => {
    console.log('Video finished, calling onVideoEnd callback')
    if (onVideoEnd) {
      onVideoEnd()
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Video
        ref={videoRef}
        style={styles.video}
        source={require('../../../assets/images/垃圾村漫游视频.mp4')}
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
