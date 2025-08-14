import React from 'react'
import {
  StyleSheet, TouchableOpacity, Text, View,
} from 'react-native'
import { fontSize, colors } from '../theme'

export default function Button(props) {
  const {
    label, onPress, color, disable, style3D, compact,
  } = props

  const buttonStyle = style3D ? styles.button3D : styles.button
  const shadowStyle = style3D ? styles.shadow3D : {}
  const containerStyle = style3D ? (compact ? styles.container3DCompact : styles.container3D) : {}

  if (disable) {
    return (
      <View style={[containerStyle]}>
        <View
          style={[buttonStyle, shadowStyle, { backgroundColor: color, opacity: 0.3 }]}
        >
          <Text style={styles.buttonText}>{label}</Text>
        </View>
      </View>
    )
  }

  return (
    <TouchableOpacity style={[containerStyle]} onPress={onPress}>
      <View
        style={[buttonStyle, shadowStyle, { backgroundColor: color }]}
      >
        <Text style={styles.buttonText}>{label}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    marginLeft: 30,
    marginRight: 30,
    marginTop: 20,
    height: 48,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container3D: {
    marginLeft: 30,
    marginRight: 30,
    marginTop: 20,
  },
  container3DCompact: {
    marginLeft: 30,
    marginRight: 30,
    marginTop: 8,
  },
  button3D: {
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12,
  },
  shadow3D: {
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0, 0, 0, 0.3)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.2)',
    borderRightWidth: 3,
    borderRightColor: 'rgba(0, 0, 0, 0.2)',
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.large,
    fontWeight: 'bold',
  },
})
