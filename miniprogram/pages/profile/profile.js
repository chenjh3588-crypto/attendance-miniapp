// pages/profile/profile.js
// 个人标签页面 - 头像 + 昵称编辑
const app = getApp()
const db = require('../../utils/db')

Page({
  data: {
    avatarUrl: '',
    nickname: '',
    employeeName: '',
    department: '',
    saving: false
  },

  onLoad: function() {
    this.loadProfile()
  },

  async loadProfile() {
    const employee = app.globalData.currentEmployee
    if (!employee) return

    this.setData({
      avatarUrl: employee.avatarUrl || '',
      nickname: employee.nickname || '',
      employeeName: employee.name || '',
      department: employee.department || ''
    })
  },

  // 选择头像
  onChooseAvatar: function() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: async (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.setData({ avatarUrl: tempFilePath })

        // 上传到云存储
        try {
          const cloudPath = `avatars/${app.globalData.companyId}/${app.globalData.currentEmployee._id}_${Date.now()}.jpg`
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath,
            filePath: tempFilePath
          })

          // 更新到数据库
          await db.updateEmployee(app.globalData.currentEmployee._id, {
            avatarUrl: uploadRes.fileID
          })

          // 更新全局
          app.globalData.currentEmployee.avatarUrl = uploadRes.fileID

          wx.showToast({ title: '头像已更新', icon: 'success' })
        } catch (err) {
          console.error('上传头像失败:', err)
          wx.showToast({ title: '头像上传失败', icon: 'none' })
        }
      }
    })
  },

  // 昵称输入
  onNicknameInput: function(e) {
    this.setData({ nickname: e.detail.value })
  },

  // 保存昵称
  async onSaveNickname() {
    const { nickname } = this.data
    if (!nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      await db.updateEmployee(app.globalData.currentEmployee._id, {
        nickname: nickname.trim()
      })

      app.globalData.currentEmployee.nickname = nickname.trim()

      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (err) {
      console.error('保存昵称失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
