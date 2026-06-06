// pages/index/index.js
// 首页 - 入口判断页（检查用户是否已加入公司）
const app = getApp()

Page({
  data: {
    loading: true
  },

  onLoad() {
    this.init()
  },

  async init() {
    try {
      // 获取 openid
      await app.getOpenId()

      // 检查是否有已选择的公司
      const companyId = wx.getStorageSync('currentCompanyId')

      if (companyId) {
        // 已有公司，跳转打卡页
        wx.switchTab({ url: '/pages/checkin/checkin' })
      } else {
        // 检查用户是否加入过公司
        const db = wx.cloud.database()
        const openid = app.globalData.openid
        const res = await db.collection('employees')
          .where({ openid, status: 'active' })
          .get()

        if (res.data.length > 0) {
          if (res.data.length === 1) {
            // 只有一个公司，自动进入
            const employee = res.data[0]
            const companyRes = await db.collection('companies')
              .doc(employee.companyId)
              .get()

            app.setCurrentCompany(companyRes.data)
            app.setCurrentEmployee(employee)
            wx.switchTab({ url: '/pages/checkin/checkin' })
          } else {
            // 多个公司，跳转选择页
            wx.redirectTo({ url: '/pages/company/company' })
          }
        } else {
          // 未加入任何公司，跳转引导页
          wx.redirectTo({ url: '/pages/guild/guild' })
        }
      }
    } catch (err) {
      console.error('初始化失败:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    }
  }
})
