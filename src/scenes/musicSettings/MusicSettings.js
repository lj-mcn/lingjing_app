import React from 'react'
import {
  View, StyleSheet, Dimensions, TouchableOpacity, ImageBackground, Image,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useAppFlow } from '../../context/AppFlowContext'

const { width, height } = Dimensions.get('window')

export default function MusicSettings() {
  const { markMusicSettingsCompleted } = useAppFlow()

  const handleMuteChoice = () => {
    console.log('User chose to mute')
    markMusicSettingsCompleted()
  }

  const handleOkChoice = () => {
    console.log('User chose OK for music')
    markMusicSettingsCompleted()
  }


  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <ImageBackground
        source={require('../../../assets/images/提示弹窗.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.imageButton}
            onPress={handleMuteChoice}
          >
            <Image 
              source={require('../../../assets/images/silent.png')} 
              style={styles.buttonImage}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.imageButton}
            onPress={handleOkChoice}
          >
            <Image 
              source={require('../../../assets/images/iknow.png')} 
              style={styles.buttonImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  backgroundImage: {
    flex: 1,
    width,
    height,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: height / 12 + height / 5 - 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '80%',
    paddingHorizontal: 16,
    gap: 20,
  },
  imageButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonImage: {
    width: 120,
    height: 50,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
})
