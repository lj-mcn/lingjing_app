import React, { useRef, useEffect } from 'react'
import { View, StyleSheet, Dimensions } from 'react-native'
import { Video } from 'expo-av'

const { width, height } = Dimensions.get('window')

export default function DigitalAvatar({ 
  style, 
  videoStyle, 
  autoPlay = true, 
  loop = true,
  showControls = false 
}) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (autoPlay && videoRef.current) {
      videoRef.current.playAsync()
    }
  }, [autoPlay])

  return (
    <View style={[styles.container, style]}>
      <Video
        ref={videoRef}
        style={[styles.video, videoStyle]}
        source={require('../../assets/images/嘎巴龙待机.mp4')}
        useNativeControls={showControls}
        resizeMode="contain"
        isLooping={loop}
        shouldPlay={autoPlay}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: 200,
    height: 300,
  },
})