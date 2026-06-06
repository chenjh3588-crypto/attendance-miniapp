// pages/index/index.js
// 首页 - 入口判断页（检查用户是否已加入公司）
const app = getApp()

Page({
  data: {
    loading: true
  },

  onLoad: function() {
    this.init()
  },

  init: function() {
    var that = this

    // 获取 openid
    app.getOpenId().then(function(openid) {
      // 检查是否有已选择的公司
      var companyId = wx.getStorageSync('currentCompanyId')

      if (companyId) {
        // 已有公司，跳转打卡页
        wx.switchTab({ url: '/pages/checkin/checkin' })
        return
      }

      // 检查用户是否加入过公司
      var db = wx.cloud.database()
      return db.collection('employees')
        .where({ openid: openid, status: 'active' })
        .get()

    }).then(function(res) {
      if (!res || !res.data) return

      if (res.data.length > 0) {
        if (res.data.length === 1) {
          // 只有一个公司，自动进入
          var employee = res.data[0]
          var db = wx.cloud.database()

          db.collection('companies')
            .doc(employee.companyId)
            .get()
            .then(function(companyRes) {
              app.setCurrentCompany(companyRes.data)
              app.setCurrentEmployee(employee)
              wx.switchTab({ url: '/pages/checkin/checkin' })
            })

        } else {
          // 多个公司，跳转选择页
          wx.redirectTo({ url: '/pages/company/company' })
        }
      } else {
        // 未加入任何公司，跳转引导页
        wx.redirectTo({ url: '/pages/guild/guild' })
      }

    }).catch(function(err) {
      console.error('初始化失败:', err)
      that.setData({ loading: false })
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    })
  }
})
