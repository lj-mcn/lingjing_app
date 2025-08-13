import { colors } from 'theme'

const headerTintColor = 'white'
const fontSize = 18
const headerMode = 'float'

const lightProps = {
  headerTintColor,
  headerStyle: {
    backgroundColor: colors.darkPurple,
  },
  headerTitleStyle: { fontSize },
  headerMode,
}

const darkProps = {
  headerTintColor,
  headerStyle: {
    backgroundColor: colors.dark,
  },
  headerTitleStyle: { fontSize },
  headerMode,
}

export { lightProps, darkProps }
