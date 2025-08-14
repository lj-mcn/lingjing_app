import React, { useRef, useEffect, useState } from 'react'
import {
  View, StyleSheet, Dimensions, TouchableOpacity, Text, Modal,
} from 'react-native'
import { Video } from 'expo-av'
import { StatusBar } from 'expo-status-bar'
import { useNavigation } from '@react-navigation/native'

const { width, height } = Dimensions.get('window')

export default function BlindBoxVideo() {
  const videoRef = useRef(null)
  const navigation = useNavigation()
  const [currentPhase, setCurrentPhase] = useState('opening') // 'opening', 'reward', 'result'
  const [rewardVideo, setRewardVideo] = useState(null)
  const [rewardName, setRewardName] = useState('')
  const [showRewardModal, setShowRewardModal] = useState(false)

  useEffect(() => {
    // 自动播放开盒视频
    if (videoRef.current) {
      videoRef.current.playAsync()
    }
  }, [])

  const handleOpeningVideoEnd = () => {
    console.log('Opening video finished, selecting reward')
    // 随机选择奖励视频
    const random = Math.random()
    if (random < 0.5) {
      setRewardVideo(require('../../../assets/images/1.mp4'))
      setRewardName('亮屁兔')
    } else {
      setRewardVideo(require('../../../assets/images/3.mp4'))
      setRewardName('垃圾鸡')
    }
    setCurrentPhase('reward')
  }

  const handleRewardVideoEnd = () => {
    console.log('Reward video finished, showing result')
    setCurrentPhase('result')
    setShowRewardModal(true)
  }

  const handleConfirmReward = () => {
    setShowRewardModal(false)
    // 回到主页
    navigation.goBack()
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {currentPhase === 'opening' && (
        <Video
          ref={videoRef}
          style={styles.video}
          source={require('../../../assets/images/pig_store.mp4')}
          useNativeControls={false}
          resizeMode="cover"
          isLooping={false}
          shouldPlay
          onPlaybackStatusUpdate={(status) => {
            if (status.didJustFinish) {
              handleOpeningVideoEnd()
            }
          }}
        />
      )}

      {currentPhase === 'reward' && rewardVideo && (
        <Video
          style={styles.video}
          source={rewardVideo}
          useNativeControls={false}
          resizeMode="cover"
          isLooping={false}
          shouldPlay
          onPlaybackStatusUpdate={(status) => {
            if (status.didJustFinish) {
              handleRewardVideoEnd()
            }
          }}
        />
      )}

      <Modal
        visible={showRewardModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.congratsText}>🎉 恭喜你获得</Text>
            <Text style={styles.rewardText}>{rewardName}!</Text>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirmReward}
            >
              <Text style={styles.confirmButtonText}>确认获得</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    padding: 40,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    minWidth: 300,
  },
  congratsText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  rewardText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginBottom: 30,
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
})
