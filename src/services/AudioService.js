import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

class AudioService {
  constructor() {
    this.recording = null;
    this.sound = null;
    this.isRecording = false;
    this.isPlaying = false;
    this.recordingUri = null;
  }

  async initializeAudio() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      console.log('音频初始化成功');
      return true;
    } catch (error) {
      console.error('音频初始化失败:', error);
      return false;
    }
  }

  async startRecording() {
    try {
      if (this.isRecording) {
        console.log('已经在录音中');
        return false;
      }

      const initialized = await this.initializeAudio();
      if (!initialized) {
        throw new Error('音频初始化失败');
      }

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      
      this.recording = recording;
      await this.recording.startAsync();
      this.isRecording = true;
      
      console.log('开始录音');
      return true;
    } catch (error) {
      console.error('开始录音失败:', error);
      return false;
    }
  }

  async stopRecording() {
    try {
      if (!this.isRecording || !this.recording) {
        console.log('没有正在进行的录音');
        return null;
      }

      await this.recording.stopAndUnloadAsync();
      this.recordingUri = this.recording.getURI();
      this.recording = null;
      this.isRecording = false;
      
      console.log('录音结束，文件保存在:', this.recordingUri);
      return this.recordingUri;
    } catch (error) {
      console.error('停止录音失败:', error);
      return null;
    }
  }

  async getRecordingBase64() {
    try {
      if (!this.recordingUri) {
        throw new Error('没有录音文件');
      }

      const audioData = await FileSystem.readAsStringAsync(this.recordingUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      return audioData;
    } catch (error) {
      console.error('读取录音文件失败:', error);
      return null;
    }
  }

  async playAudio(uri) {
    try {
      if (this.isPlaying) {
        await this.stopAudio();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: uri },
        { shouldPlay: true, volume: 1.0 }
      );
      
      this.sound = sound;
      this.isPlaying = true;
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          this.isPlaying = false;
          this.sound = null;
        }
      });
      
      console.log('开始播放音频');
      return true;
    } catch (error) {
      console.error('播放音频失败:', error);
      return false;
    }
  }

  async playAudioFromBase64(base64Data) {
    try {
      const uri = `data:audio/wav;base64,${base64Data}`;
      return await this.playAudio(uri);
    } catch (error) {
      console.error('播放Base64音频失败:', error);
      return false;
    }
  }

  async stopAudio() {
    try {
      if (this.sound) {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
        this.sound = null;
        this.isPlaying = false;
        console.log('音频播放已停止');
      }
    } catch (error) {
      console.error('停止音频播放失败:', error);
    }
  }

  async cleanup() {
    try {
      if (this.isRecording && this.recording) {
        await this.stopRecording();
      }
      
      if (this.isPlaying && this.sound) {
        await this.stopAudio();
      }

      // 清理录音文件
      if (this.recordingUri) {
        try {
          await FileSystem.deleteAsync(this.recordingUri, { idempotent: true });
        } catch (error) {
          console.log('清理录音文件时出错:', error);
        }
        this.recordingUri = null;
      }
      
      console.log('音频服务清理完成');
    } catch (error) {
      console.error('音频服务清理失败:', error);
    }
  }

  getRecordingStatus() {
    return {
      isRecording: this.isRecording,
      isPlaying: this.isPlaying,
      recordingUri: this.recordingUri
    };
  }
}

// 创建单例实例
const audioService = new AudioService();
export default audioService;