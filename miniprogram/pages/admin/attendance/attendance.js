// pages/admin/attendance/attendance.js
// 考勤记录总览与管理
const app = getApp()
const db = require('../../utils/db')
const { formatTime, getToday, fenToYuan } = require('../../../utils/util')

Page({
  data: {
    isAdmin: false,
    loading: true,
    // 日期选择
    selectedDate: '',
    // 考勤记录
    records: [],
    employees: [],
    // 合并后的数据
    attendanceList: [],
    // 编辑弹窗
    showEditModal: false,
    editingRecord: null,
    editForm: {
      checkInTime: '',
      checkOutTime: ''
    }
  },

  onLoad() {
    this.setData({ selectedDate: getToday() })
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
    this.loadData()
  },

  async loadData() {
    try {
      const [records, employees] = await Promise.all([
        db.getCompanyDayCheckinRecords(this.data.selectedDate),
        db.getCompanyEmployees()
      ])

      const employeeMap = {}
      employees.forEach(e => { employeeMap[e._id] = e })

      const attendanceList = employees.map(emp => {
        const record = records.find(r => r.employeeId === emp._id)
        return {
          employeeId: emp._id,
          employeeName: emp.name,
          employeeType: emp.type === 'fulltime' ? '正式' : '实习',
          record: record || null,
          status: record ? record.status : 'absent',
          checkInTime: record && record.checkInTime ? record.checkInTime.substring(11, 16) : '--',
          checkOutTime: record && record.checkOutTime ? record.checkOutTime.substring(11, 16) : '--',
          isAbnormal: record ? record.isAbnormal : false
        }
      })

      this.setData({
        records,
        employees,
        attendanceList,
        loading: false
      })
    } catch (err) {
      console.error('加载考勤数据失败:', err)
      this.setData({ loading: false })
    }
  },

  // 日期变更
  onDateChange(e) {
    this.setData({ selectedDate: e.detail.value, loading: true })
    this.loadData()
  },

  // 显示编辑弹窗
  onShowEditModal(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.attendanceList[index]
    if (!item.record) {
      wx.showToast({ title: '无打卡记录', icon: 'none' })
      return
    }

    this.setData({
      showEditModal: true,
      editingRecord: item.record,
      editForm: {
        checkInTime: item.record.checkInTime ? item.record.checkInTime.substring(11, 16) : '',
        checkOutTime: item.record.checkOutTime ? item.record.checkOutTime.substring(11, 16) : ''
      }
    })
  },

  onHideEditModal() {
    this.setData({ showEditModal: false, editingRecord: null })
  },

  onEditFormInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`editForm.${field}`]: e.detail.value })
  },

  // 保存修改
  async onSaveEdit() {
    const { editingRecord, editForm, selectedDate } = this.data
    if (!editingRecord) return

    try {
      const updateData = {}
      if (editForm.checkInTime) {
        updateData.checkInTime = `${selectedDate}T${editForm.checkInTime}:00.000Z`
      }
      if (editForm.checkOutTime) {
        updateData.checkOutTime = `${selectedDate}T${editForm.checkOutTime}:00.000Z`
      }
      updateData.modifiedBy = app.globalData.currentEmployee._id
      updateData.modifiedAt = new Date().toISOString()

      await db.updateCheckinRecord(editingRecord._id, updateData)
      await db.addOperationLog(
        'modify_checkin',
        editingRecord.employeeId,
        `修改打卡时间：${editForm.checkInTime} - ${editForm.checkOutTime}`
      )

      wx.showToast({ title: '修改成功', icon: 'success' })
      this.onHideEditModal()
      this.loadData()
    } catch (err) {
      console.error('修改打卡记录失败:', err)
      wx.showToast({ title: '修改失败', icon: 'none' })
    }
  },

  // 导航方法
  goToEmployees: function() { wx.redirectTo({ url: '/pages/admin/employees/employees' }) },
  goToConfig: function() { wx.redirectTo({ url: '/pages/admin/config/config' }) },
  goToLogs: function() { wx.redirectTo({ url: '/pages/admin/logs/logs' }) }
})
