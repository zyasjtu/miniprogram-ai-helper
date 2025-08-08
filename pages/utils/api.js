// utils/api.js
const BASE_URL = 'http://127.0.0.1:5000' // 请替换为实际的服务端域名

const request = (url, method, data, header = {}) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + url,
      method: method,
      data: data,
      header: {
        'Content-Type': 'application/json',
        ...header
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.data?.message || 'Request failed'}`))
        }
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

// 文本对话API
const textChat = (sessionId, text) => {
  return request('/chat/text', 'POST', { 
    session_id: sessionId, 
    text: text 
  })
}

// 语音对话API - 需要先将音频文件转为base64
const voiceChat = (sessionId, audioFilePath) => {
  return new Promise((resolve, reject) => {
    // 读取音频文件并转为base64
    wx.getFileSystemManager().readFile({
      filePath: audioFilePath,
      encoding: 'base64',
      success: (res) => {
        const base64Audio = res.data
        // 调用语音对话API
        request('/chat/voice', 'POST', {
          session_id: sessionId,
          audio_base64: base64Audio
        }).then(resolve).catch(reject)
      },
      fail: (err) => {
        reject(new Error('读取音频文件失败: ' + err.errMsg))
      }
    })
  })
}

module.exports = {
  textChat,
  voiceChat
}
