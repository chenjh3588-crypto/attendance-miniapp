// pages/guild/guild.js
// 引导页 - 首次使用选择创建公司或加入公司
const app = getApp()
const { generateInviteCode } = require('../../utils/util')

Page({
  data: {
    step: 'choose', // choose / create / join
    // 创建公司表单
    companyName: '',
    themeColor: '#4A90D9',
    themeColors: ['#4A90D9', '#52C41A', '#FF6B35', '#8B5CF6', '#EC4899', '#14B8A6'],
    companyLogo: '',
    // 加入公司表单
    inviteCode: '',
    submitting: false
  },

  // 切换到创建公司
  onCreateCompany() {
    this.setData({ step: 'create' })
  },

  // 切换到加入公司
  onJoinCompany() {
    this.setData({ step: 'join' })
  },

  // 返回选择页
  goBack() {
    this.setData({ step: 'choose' })
  },

  // 输入公司名称
  onCompanyNameInput(e) {
    this.setData({ companyName: e.detail.value })
  },

  // 选择主题色
  onThemeColorSelect(e) {
    const color = e.currentTarget.dataset.color
    this.setData({ themeColor: color })
  },

  // 上传公司 Logo
  onChooseLogo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.setData({ companyLogo: tempFilePath })
      }
    })
  },

  // 提交创建公司
  async onSubmitCreate() {
    const { companyName, themeColor, companyLogo } = this.data

    if (!companyName.trim()) {
      wx.showToast({ title: '请输入公司名称', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      const openid = await app.getOpenId()

      // 上传 Logo 到云存储
      let logoFileId = ''
      if (companyLogo) {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `logos/${openid}_${Date.now()}.png`,
          filePath: companyLogo
        })
        logoFileId = uploadRes.fileID
      }

      // 生成唯一邀请码
      const db = wx.cloud.database()
      let inviteCode = ''
      let isUnique = false
      while (!isUnique) {
        inviteCode = generateInviteCode()
        const checkRes = await db.collection('companies')
          .where({ inviteCode })
          .count()
        if (checkRes.total === 0) {
          isUnique = true
        }
      }

      // 创建公司
      const companyRes = await db.collection('companies').add({
        data: {
          name: companyName.trim(),
          logo: logoFileId,
          inviteCode,
          themeColor,
          ownerOpenid: openid,
          wifiWhitelist: [],
          ipRange: null,
          workLocation: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      })

      // 获取公司完整数据
      const companyDoc = await db.collection('companies')
        .doc(companyRes._id)
        .get()
      const company = companyDoc.data

      // 自动创建管理员员工记录
      await db.collection('employees').add({
        data: {
          companyId: company._id,
          openid,
          name: '管理员',
          phone: '',
          role: 'admin',
          type: 'fulltime',
          monthlySalary: 0,
          status: 'active',
          customWorkTime: null,
          joinedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      })

      // 创建默认工资配置
      await db.collection('salaryConfig').add({
        data: {
          companyId: company._id,
          standardWorkStart: '09:00',
          standardWorkEnd: '18:00',
          monthlyWorkHours: 174,
          overtimeRateFulltime: 2600,
          overtimeRateIntern: 1800,
          mealSubsidyRules: {
            weekdayAmount: 1500,
            weekendFullAmount: 3000,
            weekendHalfAmount: 1500,
            weekdayThreshold: 2,
            weekendFullThreshold: 8,
            weekendHalfThreshold: 4
          },
          penaltyRules: [
            { type: 'late', name: '迟到罚款', mode: 'hourly', rate: 1, enabled: true },
            { type: 'early', name: '早退罚款', mode: 'hourly', rate: 1, enabled: true },
            { type: 'absent', name: '缺勤罚款', mode: 'fixed', rate: 50000, enabled: true }
          ],
          createdBy: openid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      })

      // 设置全局状态
      app.setCurrentCompany(company)

      // 获取员工信息
      const empRes = await db.collection('employees')
        .where({ companyId: company._id, openid })
        .get()
      if (empRes.data.length > 0) {
        app.setCurrentEmployee(empRes.data[0])
      }

      wx.showToast({ title: '创建成功', icon: 'success' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/checkin/checkin' })
      }, 1500)

    } catch (err) {
      console.error('创建公司失败:', err)
      wx.showToast({ title: '创建失败，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 输入邀请码
  onInviteCodeInput(e) {
    this.setData({ inviteCode: e.detail.value.toUpperCase() })
  },

  // 提交加入公司
  async onSubmitJoin() {
    const { inviteCode } = this.data

    if (!inviteCode.trim()) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      const openid = await app.getOpenId()
      const db = wx.cloud.database()

      // 查找公司
      const companyRes = await db.collection('companies')
        .where({ inviteCode: inviteCode.trim() })
        .get()

      if (companyRes.data.length === 0) {
        wx.showToast({ title: '邀请码无效', icon: 'none' })
        this.setData({ submitting: false })
        return
      }

      const company = companyRes.data[0]

      // 检查是否已加入
      const existRes = await db.collection('employees')
        .where({
          companyId: company._id,
          openid,
          status: 'active'
        })
        .get()

      if (existRes.data.length > 0) {
        // 已加入，直接进入
        app.setCurrentCompany(company)
        app.setCurrentEmployee(existRes.data[0])
        wx.switchTab({ url: '/pages/checkin/checkin' })
        return
      }

      // 弹出输入姓名
      wx.showModal({
        title: '加入 ' + company.name,
        editable: true,
        placeholderText: '请输入您的姓名',
        success: async (res) => {
          if (res.confirm && res.content) {
            const name = res.content.trim()

            // 创建员工记录
            await db.collection('employees').add({
              data: {
                companyId: company._id,
                openid,
                name,
                phone: '',
                role: 'employee',
                type: 'fulltime',
                monthlySalary: 0,
                status: 'active',
                customWorkTime: null,
                joinedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            })

            // 设置全局状态
            app.setCurrentCompany(company)
            const empRes = await db.collection('employees')
              .where({ companyId: company._id, openid })
              .get()
            if (empRes.data.length > 0) {
              app.setCurrentEmployee(empRes.data[0])
            }

            wx.showToast({ title: '加入成功', icon: 'success' })
            setTimeout(() => {
              wx.switchTab({ url: '/pages/checkin/checkin' })
            }, 1500)
          }
        },
        complete: () => {
          this.setData({ submitting: false })
        }
      })

    } catch (err) {
      console.error('加入公司失败:', err)
      wx.showToast({ title: '加入失败，请重试', icon: 'none' })
      this.setData({ submitting: false })
    }
  }
})
