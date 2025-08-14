import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message'
import { fontSize, colors } from '../theme'

const showToast = ({
  title, body, isDark, type = 'success',
}) => {
  // 注释掉错误类型的Toast，但保留日志记录
  if (type === 'error' || title?.includes('错误') || title?.includes('失败') || body?.includes('错误') || body?.includes('失败')) {
    console.log('Toast错误消息（已禁用显示）:', { title, body })
    return
  }

  Toast.show({
    type: 'success',
    text1: title,
    text2: body,
    props: {
      isDark,
    },
  })
}

const toastConfig = {
  /*
    Overwrite 'success' type,
    by modifying the existing `BaseToast` component
  */
  success: (props) => {
    const { isDark } = props.props
    const styles = {
      backgroundColor: isDark ? colors.darkInput : colors.white,
      text1Color: isDark ? colors.white : colors.black,
      text2Color: isDark ? colors.lightyellow : colors.darkPurple,
    }
    return (
      <BaseToast
        {...props}
        style={{ borderLeftColor: colors.primary }}
        contentContainerStyle={{
          paddingHorizontal: 15,
          backgroundColor: styles.backgroundColor,
        }}
        text1Style={{
          fontSize: fontSize.middle,
          fontWeight: '400',
          color: styles.text1Color,
        }}
        text2Style={{
          fontSize: fontSize.small,
          fontWeight: '400',
          color: styles.text2Color,
        }}
      />
    )
  },
  /*
    注释掉错误类型Toast，但保留日志记录
    Overwrite 'error' type,
    by modifying the existing `ErrorToast` component
  */
  // error: (props) => (
  //   <ErrorToast
  //     {...props}
  //     text1Style={{
  //       fontSize: 17,
  //     }}
  //     text2Style={{
  //       fontSize: 15,
  //     }}
  //   />
  // ),
  /*
    Or create a completely new type - `tomatoToast`,
    building the layout from scratch.

    I can consume any custom `props` I want.
    They will be passed when calling the `show` method (see below)
  */
  tomatoToast: ({ text1, props }) => (
    <View style={{ height: 60, width: '100%', backgroundColor: 'tomato' }}>
      <Text>{text1}</Text>
      <Text>{props.uuid}</Text>
    </View>
  ),
}

export { showToast, toastConfig }
