import React, { useState } from 'react'
import {
  View, TouchableOpacity, Text, StyleSheet, Dimensions, Alert,
} from 'react-native'
import { Video } from 'expo-av'

const { width, height } = Dimensions.get('window')

const Box = () => {
  const [currentVideo, setCurrentVideo] = useState(null)
  const [videoIndex, setVideoIndex] = useState(0)

  const videos = [
    require('../../../assets/videos/1.mp4'),
    require('../../../assets/videos/2.mp4'),
    require('../../../assets/videos/3.mp4'),
  ]

  const playRandomVideo = () => {
    try {
      const randomIndex = Math.floor(Math.random() * videos.length)
      console.log('Playing video index:', randomIndex)
      setVideoIndex(randomIndex)
      setCurrentVideo(videos[randomIndex])
    } catch (error) {
      console.error('Error playing video:', error)
      Alert.alert('错误', `无法播放视频: ${error.message}`)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titleText}>Box 页面</Text>
      <Text style={styles.infoText}>
        {currentVideo ? `当前视频: ${videoIndex + 1}.mp4` : '点击按钮播放随机视频'}
      </Text>

      {currentVideo && (
        <Video
          source={currentVideo}
          style={styles.video}
          useNativeControls
          resizeMode="contain"
          isLooping={false}
          shouldPlay
          onLoad={() => console.log('Video loaded')}
          onError={(error) => {
            console.error('Video error:', error)
            Alert.alert('视频错误', '视频播放失败')
          }}
        />
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={playRandomVideo}
      >
        <Text style={styles.buttonText}>播放随机视频</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  infoText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
  },
  video: {
    width: width * 0.9,
    height: height * 0.4,
    marginBottom: 30,
    backgroundColor: '#000',
  },
  button: {
    backgroundColor: '#007bff',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
})

export default Box
