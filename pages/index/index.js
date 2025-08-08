const { textChat, voiceChat } = require('../../utils/api.js')

Page({
  data: {
    messages: [
      {
        type: 'ai',
        text: 'Hello! I\'m Alex, your AI English tutor. How can I help you practice today?',
        audioUrl: null
      }
    ],
    inputValue: '',
    isRecording: false,
    scrollTop: 0,
    innerAudioContext: null,
    isSending: false,
    sessionId: null,
    tempAudioFiles: [],
    recorderManager: null // 新增录音管理器
  },

  onLoad: function () {
    // 初始化音频上下文
    this.innerAudioContext = wx.createInnerAudioContext()
    this.innerAudioContext.onError((res) => {
      console.log('音频播放错误:', res)
      wx.showToast({
        title: '音频播放失败',
        icon: 'none'
      })
    })
    
    // 监听音频播放结束
    this.innerAudioContext.onEnded(() => {
      console.log('音频播放结束')
    })
    
    // 初始化录音管理器
    this.initRecorderManager()
    
    // 生成初始会话ID
    this.generateSessionId()
  },

  // 初始化录音管理器
  initRecorderManager: function() {
    this.recorderManager = wx.getRecorderManager()
    
    // 监听录音开始
    this.recorderManager.onStart(() => {
      console.log('录音开始')
      this.setData({
        isRecording: true
      })
      wx.showToast({
        title: '最长录音60秒',
        icon: 'none'
      })
    })
    
    // 监听录音停止
    this.recorderManager.onStop((res) => {
      console.log('录音结束', res)
      console.log('录音文件:', res.tempFilePath)
      console.log('文件大小:', res.fileSize, '字节')
      console.log('录音时长:', res.duration, '秒')
      
      // 保存临时文件路径以便清理
      const tempAudioFiles = [...this.data.tempAudioFiles, res.tempFilePath]
      this.setData({
        isRecording: false,
        tempAudioFiles: tempAudioFiles
      })

      this.handleVoiceMessage(res.tempFilePath)
    })
    
    // 监听录音错误
    this.recorderManager.onError((res) => {
      console.log('录音错误:', res)
      this.setData({
        isRecording: false
      })
      wx.showToast({
        title: '录音失败，请检查麦克风权限',
        icon: 'none'
      })
    })
  },

  generateSessionId: function() {
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    this.setData({
      sessionId: sessionId
    })
    console.log('生成会话ID:', sessionId)
  },

  onInput: function (e) {
    this.setData({
      inputValue: e.detail.value
    })
  },

  sendMessage: function () {
    const text = this.data.inputValue.trim()
    if (!text || this.data.isSending) return

    this.setData({ isSending: true })
    
    const userMessage = {
      type: 'user',
      text: text,
      timestamp: Date.now()
    }

    const messages = [...this.data.messages, userMessage]
    this.setData({
      messages: messages,
      inputValue: '',
      scrollTop: 999999
    })

    this.callTextChatAPI(this.data.sessionId, text)
  },

  startRecording: function () {
    if (this.data.isSending) {
      wx.showToast({
        title: '请等待上一条消息处理完成',
        icon: 'none'
      })
      return
    }

    if (this.data.isRecording) {
      console.log('已经在录音中')
      return
    }

    // 开始录音
    this.recorderManager.start({
      duration: 60000,        // 最长60秒
      sampleRate: 16000,      // 采样率
      numberOfChannels: 1,    // 单声道
      encodeBitRate: 48000,   // 编码码率
      format: 'wav'           // 格式指定
    })
  },

  stopRecording: function () {
    if (!this.data.isRecording) {
      console.log('当前未在录音')
      return
    }

    // 停止录音
    this.recorderManager.stop()
  },

  handleVoiceMessage: function (audioPath) {
    this.setData({ isSending: true })
    
    const userMessage = {
      type: 'user',
      text: '[Voice Message]',
      audioUrl: audioPath,
      timestamp: Date.now()
    }

    const messages = [...this.data.messages, userMessage]
    this.setData({
      messages: messages,
      scrollTop: 999999
    })
    this.playUserRecording(audioPath)
    this.callVoiceChatAPI(this.data.sessionId, audioPath)
  },

  playUserRecording: function(audioPath) {
    if (!audioPath) {
      wx.showToast({
        title: '无录音文件',
        icon: 'none'
      })
      return
    }
  
    try {
      // 如果当前有音频在播放，先停止
      if (this.innerAudioContext) {
        this.innerAudioContext.stop()
      } else {
        this.innerAudioContext = wx.createInnerAudioContext()
      }
      
      this.innerAudioContext.src = audioPath
      this.innerAudioContext.play()
      
      wx.showToast({
        title: '播放录音中...',
        icon: 'none'
      })
      
      this.innerAudioContext.onEnded(() => {
        console.log('用户录音播放完成')
        wx.showToast({
          title: '播放完成',
          icon: 'none'
        })
      })
      
      this.innerAudioContext.onError((res) => {
        console.log('播放录音失败:', res)
        wx.showToast({
          title: '播放失败',
          icon: 'none'
        })
      })
      
    } catch (error) {
      console.error('播放录音出错:', error)
      wx.showToast({
        title: '播放出错',
        icon: 'none'
      })
    }
  },

  callTextChatAPI: function (sessionId, text) {
    wx.showLoading({
      title: 'AI思考中...'
    })

    textChat(sessionId, text)
      .then(response => {
        console.log('文本对话API响应:', response)
        
        if (!response || !response.text_response) {
          throw new Error('Invalid response format')
        }
        
        if (response.session_id) {
          this.setData({
            sessionId: response.session_id
          })
        }
        
        const aiText = response.text_response
        const aiAudioBase64 = response.audio_response_base64
        
        let aiAudioUrl = null
        if (aiAudioBase64) {
          aiAudioUrl = this.saveBase64Audio(aiAudioBase64)
        }
        
        this.addAIMessage(aiText, aiAudioUrl)
      })
      .catch(error => {
        console.error('文本对话API错误:', error)
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        })
        this.addAIMessage('Sorry, there was an error processing your request. Please try again.')
      })
      .finally(() => {
        wx.hideLoading()
        this.setData({ isSending: false })
      })
  },

  callVoiceChatAPI: function (sessionId, audioPath) {
    wx.showLoading({
      title: 'AI思考中...'
    })

    voiceChat(sessionId, audioPath)
      .then(response => {
        console.log('语音对话API响应:', response)
        
        if (!response || !response.text_response) {
          throw new Error('Invalid response format')
        }
        
        if (response.session_id) {
          this.setData({
            sessionId: response.session_id
          })
        }
        
        const userTextInput = response.text_input || '[Voice Message]'
        const aiText = response.text_response
        const aiAudioBase64 = response.audio_response_base64
        
        if (userTextInput && userTextInput !== '[Voice Message]') {
          const messages = [...this.data.messages]
          const lastMessage = messages[messages.length - 1]
          if (lastMessage && lastMessage.type === 'user') {
            lastMessage.text = userTextInput
          }
          this.setData({
            messages: messages
          })
        }
        
        let aiAudioUrl = null
        if (aiAudioBase64) {
          aiAudioUrl = this.saveBase64Audio(aiAudioBase64)
        }
        
        this.addAIMessage(aiText, aiAudioUrl)
      })
      .catch(error => {
        console.error('语音对话API错误:', error)
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        })
        this.addAIMessage('Sorry, there was an error processing your voice message. Please try again.')
      })
      .finally(() => {
        wx.hideLoading()
        this.setData({ isSending: false })
      })
  },

  saveBase64Audio: function(base64Data) {
    try {
      const fs = wx.getFileSystemManager()
      const filePath = `${wx.env.USER_DATA_PATH}/audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`
      
      fs.writeFile({
        filePath: filePath,
        data: base64Data,
        encoding: 'base64',
        success: () => {
          console.log('音频文件保存成功:', filePath)
        },
        fail: (err) => {
          console.error('保存音频文件失败:', err)
        }
      })
      
      return filePath
    } catch (error) {
      console.error('处理音频数据失败:', error)
      return null
    }
  },

  addAIMessage: function (text, audioUrl = null) {
    const aiMessage = {
      type: 'ai',
      text: text,
      audioUrl: audioUrl,
      timestamp: Date.now()
    }

    const messages = [...this.data.messages, aiMessage]
    this.setData({
      messages: messages,
      scrollTop: 999999
    })
  },

  playAudio: function (e) {
    const audioUrl = e.currentTarget.dataset.url
    if (audioUrl) {
      this.innerAudioContext.src = audioUrl
      this.innerAudioContext.play()
      wx.showToast({
        title: 'Playing...',
        icon: 'none'
      })
    } else {
      wx.showToast({
        title: '暂无音频',
        icon: 'none'
      })
    }
  },

  cleanTempFiles: function() {
    const fs = wx.getFileSystemManager()
    this.data.tempAudioFiles.forEach(filePath => {
      try {
        fs.unlinkSync(filePath)
        console.log('删除临时文件:', filePath)
      } catch (err) {
        console.log('删除临时文件失败:', filePath, err)
      }
    })
    
    this.setData({
      tempAudioFiles: []
    })
  },

  onUnload: function () {
    if (this.innerAudioContext) {
      this.innerAudioContext.destroy()
    }
    
    this.cleanTempFiles()
  },

  onHide: function() {
    this.cleanTempFiles()
  }
})
