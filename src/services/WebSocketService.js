import { Audio } from 'expo-av';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.onMessageCallback = null;
    this.onErrorCallback = null;
    this.onConnectCallback = null;
    this.onDisconnectCallback = null;
  }

  connect(url = 'ws://localhost:3000/ws') {
    try {
      console.log(`尝试连接WebSocket: ${url}`);
      
      // 如果已有连接，先关闭
      if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
        this.ws.close();
      }
      
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket连接已建立');
        this.reconnectAttempts = 0;
        if (this.onConnectCallback) {
          try {
            this.onConnectCallback();
          } catch (callbackError) {
            console.error('WebSocket连接回调错误:', callbackError);
          }
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 收到WebSocket消息:', data);
          if (this.onMessageCallback) {
            this.onMessageCallback(data);
          }
        } catch (error) {
          console.error('❌ 解析WebSocket消息失败:', error);
          console.error('原始消息:', event.data);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket错误:', error);
        if (this.onErrorCallback) {
          try {
            this.onErrorCallback(error);
          } catch (callbackError) {
            console.error('WebSocket错误回调异常:', callbackError);
          }
        }
      };

      this.ws.onclose = (event) => {
        console.log(`⚠️ WebSocket连接已关闭: 代码=${event.code}, 原因=${event.reason || '未知'}`);
        if (this.onDisconnectCallback) {
          try {
            this.onDisconnectCallback(event);
          } catch (callbackError) {
            console.error('WebSocket断开回调错误:', callbackError);
          }
        }
        
        // 只有在非正常关闭时才尝试重连
        if (event.code !== 1000) {
          this.handleReconnect(url);
        }
      };
      
      return true;
    } catch (error) {
      console.error('❌ WebSocket连接初始化失败:', error);
      if (this.onErrorCallback) {
        try {
          this.onErrorCallback(error);
        } catch (callbackError) {
          console.error('WebSocket错误回调异常:', callbackError);
        }
      }
      return false;
    }
  }

  handleReconnect(url = 'ws://localhost:3000/ws') {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 尝试重连 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      setTimeout(() => {
        console.log(`🔄 执行第${this.reconnectAttempts}次重连...`);
        this.connect(url);
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ WebSocket重连失败，已达到最大重连次数');
    }
  }

  send(message) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const jsonMessage = JSON.stringify(message);
        this.ws.send(jsonMessage);
        console.log('📤 WebSocket消息已发送:', message);
        return true;
      } else {
        const state = this.ws ? this.getReadyStateText() : '未创建';
        console.error(`❌ WebSocket未连接，无法发送消息 (状态: ${state})`);
        return false;
      }
    } catch (error) {
      console.error('❌ WebSocket发送消息失败:', error);
      return false;
    }
  }

  getReadyStateText() {
    if (!this.ws) return '未创建';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return '连接中';
      case WebSocket.OPEN: return '已连接';
      case WebSocket.CLOSING: return '关闭中';
      case WebSocket.CLOSED: return '已关闭';
      default: return '未知状态';
    }
  }

  sendAudio(audioData, type = 'audio') {
    const message = {
      type: type,
      data: audioData,
      timestamp: Date.now()
    };
    return this.send(message);
  }

  sendText(text, type = 'text') {
    const message = {
      type: type,
      data: text,
      timestamp: Date.now()
    };
    return this.send(message);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // 设置回调函数
  setOnMessage(callback) {
    this.onMessageCallback = callback;
  }

  setOnError(callback) {
    this.onErrorCallback = callback;
  }

  setOnConnect(callback) {
    this.onConnectCallback = callback;
  }

  setOnDisconnect(callback) {
    this.onDisconnectCallback = callback;
  }
}

// 创建单例实例
const webSocketService = new WebSocketService();
export default webSocketService;