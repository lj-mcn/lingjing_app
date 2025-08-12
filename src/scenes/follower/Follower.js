import React, { useEffect, useContext, useState } from 'react'
import { Text, View, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import ScreenTemplate from '../../components/ScreenTemplate'
import { colors, fontSize } from '../../theme'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'
import { UserDataContext } from '../../context/UserDataContext'
import Button from '../../components/Button'

export default function Follower() {
  const { userData } = useContext(UserDataContext)
  const { scheme } = useContext(ColorSchemeContext)
  const isDark = scheme === 'dark'
  const colorScheme = {
    text: isDark ? colors.white : colors.primaryText,
    background: isDark ? colors.black : colors.white,
    cardBackground: isDark ? '#333' : '#f8f9fa'
  }

  const [followerList, setFollowerList] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    console.log('Follower screen - 粉丝列表')
    loadFollowerList()
  }, [])

  const loadFollowerList = async () => {
    setLoading(true)
    try {
      // 这里应该从服务器获取粉丝列表
      // 暂时使用模拟数据
      const mockData = [
        { id: 1, name: '小明', email: 'xiaoming@example.com', avatar: '👤' },
        { id: 2, name: '小红', email: 'xiaohong@example.com', avatar: '👤' },
        { id: 3, name: '小刚', email: 'xiaogang@example.com', avatar: '👤' },
        { id: 4, name: '小李', email: 'xiaoli@example.com', avatar: '👤' },
      ]
      setFollowerList(mockData)
    } catch (error) {
      console.error('加载粉丝列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFollowBack = (userId) => {
    // 回关逻辑
    console.log('回关用户:', userId)
  }

  const renderFollowerItem = ({ item }) => (
    <View style={[styles.followerItem, { backgroundColor: colorScheme.cardBackground }]}>
      <View style={styles.userInfo}>
        <Text style={styles.userAvatar}>{item.avatar}</Text>
        <View style={styles.userDetails}>
          <Text style={[styles.userName, { color: colorScheme.text }]}>{item.name}</Text>
          <Text style={[styles.userEmail, { color: colorScheme.text }]}>{item.email}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.followBackButton}
        onPress={() => handleFollowBack(item.id)}
      >
        <Text style={styles.followBackButtonText}>回关</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <ScreenTemplate>
      <View style={styles.container}>
        {/* 头部标题 */}
        <View style={styles.headerContainer}>
          <Text style={[styles.title, { color: colorScheme.text }]}>
            👥 我的粉丝
          </Text>
          <Text style={[styles.subtitle, { color: colorScheme.text }]}>
            共有 {followerList.length} 个粉丝
          </Text>
        </View>

        {/* 粉丝列表 */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colorScheme.text }]}>
              加载中...
            </Text>
          </View>
        ) : followerList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colorScheme.text }]}>
              😔 还没有粉丝
            </Text>
            <Text style={[styles.emptySubtext, { color: colorScheme.text }]}>
              多发布一些精彩内容吸引粉丝吧！
            </Text>
          </View>
        ) : (
          <FlatList
            data={followerList}
            renderItem={renderFollowerItem}
            keyExtractor={(item) => item.id.toString()}
            style={styles.followerList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* 刷新按钮 */}
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadFollowerList}
        >
          <Text style={styles.refreshButtonText}>🔄 刷新列表</Text>
        </TouchableOpacity>
      </View>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: fontSize.xLarge,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.middle,
    opacity: 0.8,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fontSize.large,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: fontSize.large,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: fontSize.middle,
    textAlign: 'center',
    opacity: 0.7,
  },
  followerList: {
    flex: 1,
    marginBottom: 20,
  },
  followerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    fontSize: 32,
    marginRight: 15,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: fontSize.large,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: fontSize.small,
    opacity: 0.7,
  },
  followBackButton: {
    backgroundColor: colors.tertiary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followBackButtonText: {
    color: colors.white,
    fontSize: fontSize.small,
    fontWeight: '500',
  },
  refreshButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderColor: '#007AFF',
    borderWidth: 1,
    borderRadius: 25,
    paddingHorizontal: 30,
    paddingVertical: 12,
    alignSelf: 'center',
  },
  refreshButtonText: {
    color: '#007AFF',
    fontSize: fontSize.middle,
    textAlign: 'center',
    fontWeight: '500',
  },
})
