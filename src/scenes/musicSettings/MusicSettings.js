import React from 'react'
import {
  View, StyleSheet, Dimensions, TouchableOpacity, Text, ImageBackground,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'

const { width, height } = Dimensions.get('window')

export default function MusicSettings({ route }) {
  const { onMusicChoice } = route.params || {}

  const handleMuteChoice = () => {
    console.log('User chose to mute')
    if (onMusicChoice) {
      onMusicChoice('mute')
    }
  }

  const handleOkChoice = () => {
    console.log('User chose OK for music')
    if (onMusicChoice) {
      onMusicChoice('ok')
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <ImageBackground
        source={require('../../../assets/images/music.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.muteButton]}
            onPress={handleMuteChoice}
          >
            <Text style={styles.buttonText}>先静音吧</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.okButton]}
            onPress={handleOkChoice}
          >
            <Text style={styles.buttonText}>知道咯</Text>
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
    gap: -4,
  },
  button: {
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 25,
    width: '45%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  muteButton: {
    backgroundColor: '#CCCCCC',
  },
  okButton: {
    backgroundColor: '#FF6B35',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
})
