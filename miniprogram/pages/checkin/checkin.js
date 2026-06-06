// pages/checkin/checkin.js
// 打卡页面 - GPS + Wi-Fi 双重验证
const app = getApp()
const db = require('../../utils/db')
const { formatTime, getToday, getDeviceInfo, getDistance, showToast } = require('../../utils/util')

Page({
  data: {
    // 公司信息
    companyName: '',
    companyLogo: '',
    themeColor: '#4A90D9',

    // 员工个人标签
    avatarUrl: '',
    nickname: '',
    employeeName: '',

    // 打卡状态
    todayRecord: null,
    hasCheckIn: false,
    hasCheckOut: false,
    checkInTime: '',
    checkOutTime: '',
    currentDate: '',
    currentTime: '',
    currentDay: '',

    // 定位信息
    currentLocation: null,
    currentWifi: '',
    isInArea: false,
    locationText: '正在获取位置...',

    // 状态
    checking: false,
    isAdmin: false,

    // 异常标记
    isAbnormal: false,
    abnormalReason: '',

    // 全屏感谢页
    showThanks: false,
    thanksCheckType: 'in',
    thanksTime: ''
  },

  onLoad: function() {
    this.setData({
      currentDate: formatTime(new Date(), 'YYYY年MM月DD日'),
      currentDay: this.getDayName(new Date().getDay())
    })
  },

  onShow: function() {
    this.updateCompanyTheme()
    this.loadEmployeeProfile()
    this.startClock()
    this.getLocation()
    this.getWifiInfo()
    this.loadTodayRecord()

    if (app.globalData.isAdmin !== undefined) {
      this.setData({ isAdmin: app.globalData.isAdmin })
    }

    // 尝试同步离线打卡
    if (app.globalData.offlineQueue.length > 0) {
      app.syncOfflineCheckin()
    }
  },

  onUnload: function() {
    if (this._clockTimer) {
      clearInterval(this._clockTimer)
    }
  },

  // 加载员工个人标签
  loadEmployeeProfile: function() {
    const employee = app.globalData.currentEmployee
    if (employee) {
      this.setData({
        avatarUrl: employee.avatarUrl || '',
        nickname: employee.nickname || '',
        employeeName: employee.name || ''
      })
    }
  },

  // 更新公司主题
  updateCompanyTheme: function() {
    const company = app.globalData.currentCompany
    if (company) {
      this.setData({
        companyName: company.name,
        companyLogo: company.logo,
        themeColor: company.themeColor || '#4A90D9'
      })
      // 动态设置导航栏颜色
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: company.themeColor || '#4A90D9',
        animation: { duration: 300, timingFunc: 'easeIn' }
      })
    }
  },

  // 启动时钟
  startClock: function() {
    const update = () => {
      const now = new Date()
      this.setData({
        currentTime: formatTime(now, 'HH:mm:ss')
      })
    }
    update()
    this._clockTimer = setInterval(update, 1000)
  },

  // 获取星期名
  getDayName(day) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day]
  },

  // 获取 GPS 定位
  getLocation: function() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          currentLocation: {
            latitude: res.latitude,
            longitude: res.longitude
          }
        })
        this.checkLocationInArea()
      },
      fail: (err) => {
        console.error('获取位置失败:', err)
        this.setData({
          locationText: '无法获取位置，请授权',
          isAbnormal: true,
          abnormalReason: '无法获取定位'
        })
        // 请求授权
        if (err.errMsg.indexOf('auth deny') !== -1) {
          wx.showModal({
            title: '需要位置权限',
            content: '打卡需要获取您的位置信息，请在设置中开启位置权限',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting()
              }
            }
          })
        }
      }
    })
  },

  // 获取 Wi-Fi 信息
  getWifiInfo: function() {
    wx.getConnectedWifi({
      success: (res) => {
        this.setData({
          currentWifi: res.wifi.SSID || ''
        })
        this.checkWifiInWhitelist()
      },
      fail: () => {
        this.setData({ currentWifi: '' })
      }
    })
  },

  // 检查 GPS 是否在公司范围内
  checkLocationInArea: function() {
    const company = app.globalData.currentCompany
    const location = this.data.currentLocation

    if (!company || !company.workLocation || !location) {
      this.setData({
        isInArea: true,
        locationText: '定位成功'
      })
      return
    }

    const distance = getDistance(
      location.latitude, location.longitude,
      company.workLocation.latitude, company.workLocation.longitude
    )

    const radius = company.workLocation.radius || 200
    const inArea = distance <= radius

    this.setData({
      isInArea: inArea,
      locationText: inArea
        ? `距公司${distance}米（范围内）`
        : `距公司${distance}米（超出范围）`,
      isAbnormal: !inArea,
      abnormalReason: !inArea ? '不在公司定位范围内' : ''
    })
  },

  // 检查 Wi-Fi 是否在白名单
  checkWifiInWhitelist: function() {
    const company = app.globalData.currentCompany
    if (!company || !company.wifiWhitelist || !company.wifiWhitelist.length) {
      return
    }

    const currentWifi = this.data.currentWifi
    const inWhitelist = company.wifiWhitelist.includes(currentWifi)

    if (!inWhitelist && !this.data.isInArea) {
      this.setData({
        isAbnormal: true,
        abnormalReason: '不在公司Wi-Fi范围内'
      })
    } else if (inWhitelist) {
      this.setData({
        isAbnormal: false,
        abnormalReason: ''
      })
    }
  },

  // 加载今日打卡记录
  async loadTodayRecord() {
    try {
      const employee = app.globalData.currentEmployee
      if (!employee) return

      const today = getToday()
      const record = await db.getCheckinRecord(employee._id, today)

      if (record) {
        this.setData({
          todayRecord: record,
          hasCheckIn: !!record.checkInTime,
          hasCheckOut: !!record.checkOutTime,
          checkInTime: record.checkInTime ? formatTime(new Date(record.checkInTime), 'HH:mm:ss') : '',
          checkOutTime: record.checkOutTime ? formatTime(new Date(record.checkOutTime), 'HH:mm:ss') : ''
        })
      }
    } catch (err) {
      console.error('加载打卡记录失败:', err)
    }
  },

  // 显示全屏感谢页
  showThanksOverlay(checkType) {
    const now = new Date()
    this.setData({
      showThanks: true,
      thanksCheckType: checkType,
      thanksTime: formatTime(now, 'HH:mm')
    })
  },

  // 关闭感谢页
  onThanksDismiss: function() {
    this.setData({ showThanks: false })
  },

  // 上班打卡
  async onCheckIn() {
    if (this.data.hasCheckIn) {
      showToast('今日已打卡上班')
      return
    }
    if (this.data.checking) return

    this.setData({ checking: true })

    try {
      const employee = app.globalData.currentEmployee
      const company = app.globalData.currentCompany
      const now = new Date().toISOString()
      const today = getToday()

      // 检查是否迟到
      const config = await db.getSalaryConfig()
      let status = 'normal'
      if (config) {
        const workStart = config.standardWorkStart || '09:00'
        const nowTime = formatTime(new Date(), 'HH:mm')
        if (nowTime > workStart) {
          status = 'late'
        }
      }

      const recordData = {
        companyId: company._id,
        employeeId: employee._id,
        date: today,
        checkInTime: now,
        checkInLocation: this.data.currentLocation,
        checkInWifi: this.data.currentWifi,
        checkInDevice: JSON.stringify(getDeviceInfo()),
        status,
        isAbnormal: this.data.isAbnormal,
        abnormalReason: this.data.abnormalReason,
        isOffline: false,
        workContent: ''
      }

      // 检查网络状态
      const networkType = await this.getNetworkType()

      if (networkType === 'none') {
        recordData.isOffline = true
        app.addOfflineCheckin(recordData)
        showToast('已保存离线打卡记录')
      } else {
        const result = await db.createCheckinRecord(recordData)
        recordData._id = result._id
      }

      this.setData({
        todayRecord: recordData,
        hasCheckIn: true,
        checkInTime: formatTime(new Date(now), 'HH:mm:ss')
      })

      // 显示全屏感谢页
      this.showThanksOverlay('in')

    } catch (err) {
      console.error('打卡失败:', err)
      showToast('打卡失败，请重试')
    } finally {
      this.setData({ checking: false })
    }
  },

  // 下班打卡
  async onCheckOut() {
    if (this.data.checking) return
    if (!this.data.hasCheckIn) {
      showToast('请先上班打卡')
      return
    }
    if (this.data.hasCheckOut) {
      showToast('今日已打卡下班')
      return
    }

    this.setData({ checking: true })

    try {
      const now = new Date().toISOString()
      const record = this.data.todayRecord

      // 检查是否早退
      const config = await db.getSalaryConfig()
      let status = record.status || 'normal'
      if (config && status !== 'late') {
        const workEnd = config.standardWorkEnd || '18:00'
        const nowTime = formatTime(new Date(), 'HH:mm')
        if (nowTime < workEnd) {
          status = 'early'
        }
      }

      // 检查是否加班
      if (config) {
        const workEnd = config.standardWorkEnd || '18:00'
        const nowTime = formatTime(new Date(), 'HH:mm')
        if (nowTime > workEnd && status !== 'late' && status !== 'early') {
          status = 'overtime'
        }
      }

      const updateData = {
        checkOutTime: now,
        checkOutLocation: this.data.currentLocation,
        checkOutWifi: this.data.currentWifi,
        checkOutDevice: JSON.stringify(getDeviceInfo()),
        status
      }

      // 网络检查
      const networkType = await this.getNetworkType()

      if (networkType === 'none') {
        app.addOfflineCheckin({
          ...record,
          ...updateData,
          isOffline: true
        })
        showToast('已保存离线打卡记录')
      } else if (record._id) {
        await db.updateCheckinRecord(record._id, updateData)
      }

      this.setData({
        hasCheckOut: true,
        checkOutTime: formatTime(new Date(now), 'HH:mm:ss')
      })

      // 显示全屏感谢页
      this.showThanksOverlay('out')

    } catch (err) {
      console.error('下班打卡失败:', err)
      showToast('打卡失败，请重试')
    } finally {
      this.setData({ checking: false })
    }
  },

  // 获取网络类型
  getNetworkType: function() {
    return new Promise((resolve) => {
      wx.getNetworkType({
        success: (res) => resolve(res.networkType),
        fail: () => resolve('unknown')
      })
    })
  },

  // 跳转个人标签页
  goToProfile: function() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  }
})
