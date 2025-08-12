import React, { useEffect, useContext, useState } from 'react'
import { Text, View, StyleSheet, ScrollView, FlatList, TouchableOpacity } from 'react-native'
import ScreenTemplate from '../../components/ScreenTemplate'
import Button from '../../components/Button'
import { colors, fontSize } from 'theme'
import { ColorSchemeContext } from '../../context/ColorSchemeContext'
import { UserDataContext } from '../../context/UserDataContext'
import { useNavigation } from '@react-navigation/native'

export default function Follow() {
  const navigation = useNavigation()
  const { userData } = useContext(UserDataContext)
  const { scheme } = useContext(ColorSchemeContext)
  const isDark = scheme === 'dark'
  const colorScheme = {
    text: isDark? colors.white : colors.primaryText,
    background: isDark? colors.black : colors.white,
    cardBackground: isDark? '#333' : '#f8f9fa'
  }

  const [followingList, setFollowingList] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    console.log('Follow screen - 关注列表')
    loadFollowingList()
  }, [])

  const loadFollowingList = async () => {
    setLoading(true)
    try {
      // 这里应该从服务器获取关注列表
      // 暂时使用模拟数据
      const mockData = [
        { id: 1, name: '张三', email: 'zhangsan@example.com', avatar: '👤' },
        { id: 2, name: '李四', email: 'lisi@example.com', avatar: '👤' },
        { id: 3, name: '王五', email: 'wangwu@example.com', avatar: '👤' },
      ]
      setFollowingList(mockData)
    } catch (error) {
      console.error('加载关注列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUnfollow = (userId) => {
    // 取消关注逻辑
    setFollowingList(prev => prev.filter(user => user.id !== userId))
  }

  const renderFollowItem = ({ item }) => (
    <View style={[styles.followItem, { backgroundColor: colorScheme.cardBackground }]}>
      <View style={styles.userInfo}>
        <Text style={styles.userAvatar}>{item.avatar}</Text>
        <View style={styles.userDetails}>
          <Text style={[styles.userName, { color: colorScheme.text }]}>{item.name}</Text>
          <Text style={[styles.userEmail, { color: colorScheme.text }]}>{item.email}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.unfollowButton}
        onPress={() => handleUnfollow(item.id)}
      >
        <Text style={styles.unfollowButtonText}>取消关注</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <ScreenTemplate>
      <View style={styles.container}>
        {/* 头部标题 */}
        <View style={styles.headerContainer}>
          <Text style={[styles.title, { color: colorScheme.text }]}>
            👥 我的关注
          </Text>
          <Text style={[styles.subtitle, { color: colorScheme.text }]}>
            关注了 {followingList.length} 个用户
          </Text>
        </View>

        {/* 关注列表 */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colorScheme.text }]}>
              加载中...
            </Text>
          </View>
        ) : followingList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colorScheme.text }]}>
              😔 还没有关注任何人
            </Text>
            <Text style={[styles.emptySubtext, { color: colorScheme.text }]}>
              去发现一些有趣的人吧！
            </Text>
          </View>
        ) : (
          <FlatList
            data={followingList}
            renderItem={renderFollowItem}
            keyExtractor={(item) => item.id.toString()}
            style={styles.followList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* 刷新按钮 */}
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadFollowingList}
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
  followList: {
    flex: 1,
    marginBottom: 20,
  },
  followItem: {
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
  unfollowButton: {
    backgroundColor: '#ff4757',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  unfollowButtonText: {
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