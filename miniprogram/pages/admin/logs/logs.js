// pages/admin/logs/logs.js
// 操作日志页面
const app = getApp()
const db = require('../../utils/db')
const { formatTime } = require('../../../utils/util')

Page({
  data: {
    isAdmin: false,
    loading: true,
    logs: [],
    page: 1,
    hasMore: true
  },

  onLoad() {
    this.checkAdmin()
  },

  checkAdmin() {
    if (!app.globalData.isAdmin) {
      wx.showModal({
        title: '无权限',
        content: '仅管理员可访问此页面',
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/checkin/checkin' })
      })
      return
    }
    this.setData({ isAdmin: true })
    this.loadLogs()
  },

  async loadLogs() {
    try {
      const logs = await db.getOperationLogs(this.data.page)
      const formatted = logs.map(log => ({
        ...log,
        timeDisplay: formatTime(new Date(log.createdAt), 'MM-DD HH:mm'),
        actionLabel: this.getActionLabel(log.action)
      }))

      this.setData({
        logs: this.data.page === 1 ? formatted : [...this.data.logs, ...formatted],
        loading: false,
        hasMore: formatted.length >= 20
      })
    } catch (err) {
      console.error('加载日志失败:', err)
      this.setData({ loading: false })
    }
  },

  getActionLabel(action) {
    const map = {
      add_employee: '添加员工',
      edit_employee: '编辑员工',
      delete_employee: '删除员工',
      modify_checkin: '修改打卡',
      update_config: '更新配置',
      generate_salary: '生成工资'
    }
    return map[action] || action
  },

  onLoadMore() {
    if (!this.data.hasMore) return
    this.setData({ page: this.data.page + 1 })
    this.loadLogs()
  },

  // 导航
  goToEmployees() { wx.redirectTo({ url: '/pages/admin/employees/employees' }) },
  goToAttendance() { wx.redirectTo({ url: '/pages/admin/attendance/attendance' }) },
  goToConfig() { wx.redirectTo({ url: '/pages/admin/config/config' }) }
})
