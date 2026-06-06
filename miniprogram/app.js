App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        traceUser: true
      })
    }

    this.globalData = {
      // 当前用户信息
      userInfo: null,
      openid: null,
      // 当前公司信息
      currentCompany: null,
      companyId: null,
      // 当前员工信息
      currentEmployee: null,
      // 是否为管理员
      isAdmin: false,
      // 离线打卡队列
      offlineQueue: wx.getStorageSync('offlineQueue') || []
    }

    this.checkLoginStatus()
  },

  // 检查登录状态
  checkLoginStatus() {
    const companyId = wx.getStorageSync('currentCompanyId')
    const employeeId = wx.getStorageSync('currentEmployeeId')
    if (companyId) {
      this.globalData.companyId = companyId
      this.globalData.currentEmployeeId = employeeId
    }
  },

  // 获取 openid
  getOpenId() {
    if (this.globalData.openid) {
      return Promise.resolve(this.globalData.openid)
    }
    return wx.cloud.callFunction({
      name: 'login'
    }).then(res => {
      this.globalData.openid = res.result.openid
      return res.result.openid
    })
  },

  // 设置当前公司
  setCurrentCompany(company) {
    this.globalData.currentCompany = company
    this.globalData.companyId = company._id
    wx.setStorageSync('currentCompanyId', company._id)
  },

  // 设置当前员工
  setCurrentEmployee(employee) {
    this.globalData.currentEmployee = employee
    this.globalData.isAdmin = employee.role === 'admin'
    wx.setStorageSync('currentEmployeeId', employee._id)
  },

  // 添加离线打卡记录
  addOfflineCheckin(record) {
    const queue = this.globalData.offlineQueue
    queue.push({
      ...record,
      offlineId: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    })
    this.globalData.offlineQueue = queue
    wx.setStorageSync('offlineQueue', queue)
  },

  // 同步离线打卡
  syncOfflineCheckin() {
    const queue = this.globalData.offlineQueue
    if (!queue.length) return Promise.resolve()

    return wx.cloud.callFunction({
      name: 'checkin-sync',
      data: { records: queue }
    }).then(() => {
      this.globalData.offlineQueue = []
      wx.setStorageSync('offlineQueue', [])
      wx.showToast({ title: '离线记录已同步', icon: 'success' })
    }).catch(err => {
      console.error('同步离线打卡失败:', err)
    })
  }
})
