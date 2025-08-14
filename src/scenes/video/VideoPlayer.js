import React, { useRef, useEffect, useState } from 'react'
import {
  View, StyleSheet, Dimensions, TouchableOpacity, Text, Modal,
} from 'react-native'
import { Video, Audio } from 'expo-av'
import { StatusBar } from 'expo-status-bar'
import { useRoute, useNavigation } from '@react-navigation/native'
import { useAppFlow } from '../../context/AppFlowContext'

const { width, height } = Dimensions.get('window')

export default function VideoPlayer() {
  const videoRef = useRef(null)
  const audioRef = useRef(null)
  const route = useRoute()
  const navigation = useNavigation()
  const { markVideoWatched } = useAppFlow()
  const isReturnToVillage = route.params?.mode === 'returnToVillage'
  const musicEnabled = route.params?.musicEnabled ?? true

  console.log('VideoPlayer params:', route.params)
  console.log('Music enabled:', musicEnabled)
  const [showStorePrompt, setShowStorePrompt] = useState(false)
  const [playingStoreVideo, setPlayingStoreVideo] = useState(false)
  const [showGabalonModal, setShowGabalonModal] = useState(false)
  const [playingGabalonVideo, setPlayingGabalonVideo] = useState(false)
  const [showGabalonReward, setShowGabalonReward] = useState(false)

  useEffect(() => {
    const initializeAudioVideo = async () => {
      try {
        // 设置音频模式 - 使用简化配置
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
        })

        console.log('Audio mode set, musicEnabled:', musicEnabled)

        // 如果启用音乐，加载并播放背景音乐
        if (musicEnabled) {
          console.log('Loading background music...')
          try {
            // 先尝试加载音频文件
            const musicAsset = require('../../../assets/music/Mixdown.mp3')
            console.log('Music asset loaded:', musicAsset)

            const { sound } = await Audio.Sound.createAsync(
              musicAsset,
              {
                isLooping: true,
                volume: 0.8,
                shouldPlay: true,
              },
            )
            audioRef.current = sound

            // 获取音频状态
            const status = await sound.getStatusAsync()
            console.log('Audio status:', status)
            console.log('Background music loaded and playing')
          } catch (audioError) {
            console.log('Error loading audio:', audioError)
            console.log('Audio error details:', JSON.stringify(audioError, null, 2))
          }
        } else {
          console.log('Music disabled by user')
        }

        // 自动播放视频
        if (videoRef.current) {
          await videoRef.current.playAsync()
        }
      } catch (error) {
        console.log('Error in initializeAudioVideo:', error)
      }
    }

    initializeAudioVideo()

    // 清理函数
    return () => {
      if (audioRef.current) {
        audioRef.current.unloadAsync().catch(console.log)
      }
    }
  }, [musicEnabled])

  useEffect(() => {
    // 当需要播放嘎巴龙视频时
    if (showGabalonModal) {
      setShowGabalonModal(false)
      setPlayingGabalonVideo(true)
    }
  }, [showGabalonModal])

  const handleVideoEnd = async () => {
    // 停止背景音乐
    if (audioRef.current) {
      try {
        await audioRef.current.stopAsync()
        await audioRef.current.unloadAsync()
        audioRef.current = null
      } catch (error) {
        console.log('Error stopping audio:', error)
      }
    }

    if (isReturnToVillage) {
      // 回到垃圾村模式：视频结束后直接回到主页
      console.log('Village video finished, returning to home')
      navigation.goBack()
    } else {
      // 第一次登录模式：显示商店提示
      console.log('Video finished, showing store prompt')
      setShowStorePrompt(true)
    }
  }

  const handleStoreClick = () => {
    setShowStorePrompt(false)
    setPlayingStoreVideo(true)
  }

  const handleStoreVideoEnd = () => {
    // pig_store视频结束后，播放2.mp4（嘎巴龙角色视频）
    setPlayingStoreVideo(false)
    setShowGabalonModal(true)
  }

  const handleGabalonVideoEnd = () => {
    // 嘎巴龙视频结束，显示获得嘎巴龙的提示
    setPlayingGabalonVideo(false)
    setShowGabalonReward(true)
  }

  const handleGabalonRewardConfirm = async () => {
    // 停止背景音乐
    if (audioRef.current) {
      try {
        await audioRef.current.stopAsync()
        await audioRef.current.unloadAsync()
        audioRef.current = null
      } catch (error) {
        console.log('Error stopping audio:', error)
      }
    }

    setShowGabalonReward(false)
    console.log('First character obtained, marking video as watched')
    markVideoWatched()
  }

  const handleSkipStore = async () => {
    // 停止背景音乐
    if (audioRef.current) {
      try {
        await audioRef.current.stopAsync()
        await audioRef.current.unloadAsync()
        audioRef.current = null
      } catch (error) {
        console.log('Error stopping audio:', error)
      }
    }

    setShowStorePrompt(false)
    console.log('User skipped store, marking video as watched')
    markVideoWatched()
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {!playingStoreVideo && !playingGabalonVideo ? (
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
      ) : playingStoreVideo ? (
        <Video
          style={styles.video}
          source={require('../../../assets/images/pig_store.mp4')}
          useNativeControls={false}
          resizeMode="cover"
          isLooping={false}
          shouldPlay
          onPlaybackStatusUpdate={(status) => {
            if (status.didJustFinish) {
              handleStoreVideoEnd()
            }
          }}
        />
      ) : playingGabalonVideo ? (
        <Video
          style={styles.video}
          source={require('../../../assets/images/2.mp4')}
          useNativeControls={false}
          resizeMode="cover"
          isLooping={false}
          shouldPlay
          onPlaybackStatusUpdate={(status) => {
            if (status.didJustFinish) {
              handleGabalonVideoEnd()
            }
          }}
        />
      ) : null}

      <Modal
        visible={showStorePrompt && !isReturnToVillage}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>发现金贱猪商店！</Text>
            <Text style={styles.modalText}>想要去看看吗？</Text>
            <TouchableOpacity
              style={styles.storeButton}
              onPress={handleStoreClick}
            >
              <Text style={styles.buttonText}>进入商店</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleSkipStore}
            >
              <Text style={styles.closeButtonText}>稍后再看</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showGabalonReward && !isReturnToVillage}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>🎉 恭喜你获得第一个角色</Text>
            <Text style={styles.characterName}>嘎巴龙！</Text>
            <TouchableOpacity
              style={styles.storeButton}
              onPress={handleGabalonRewardConfirm}
            >
              <Text style={styles.buttonText}>确认获得</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 280,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  characterName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginBottom: 25,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 25,
    textAlign: 'center',
  },
  storeButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 15,
    minWidth: 120,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  closeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  closeButtonText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
  },
})
