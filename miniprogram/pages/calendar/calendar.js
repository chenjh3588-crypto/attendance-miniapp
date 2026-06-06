// pages/calendar/calendar.js
// 考勤日历页面 - 月视图展示考勤状态
const app = getApp()
const db = require('../../utils/db')
const { getDaysInMonth, formatTime } = require('../../utils/util')

Page({
  data: {
    // 日历
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    weeks: [],
    today: formatTime(new Date(), 'YYYY-MM-DD'),

    // 考勤统计
    stats: {
      normal: 0,
      late: 0,
      early: 0,
      overtime: 0,
      absent: 0
    },

    // 打卡记录映射 { 'YYYY-MM-DD': record }
    recordMap: {},

    // 选中的日期
    selectedDate: '',
    selectedRecord: null,

    // 工作内容编辑
    editingWorkContent: false,
    workContent: ''
  },

  onLoad() {
    this.generateCalendar()
  },

  onShow() {
    this.loadMonthRecords()
  },

  // 生成日历数据
  generateCalendar() {
    const { year, month } = this.data
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = new Date(year, month - 1, 1).getDay() // 0=周日

    // 构建日期数组
    const days = []
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      days.push({
        day: i,
        date: dateStr,
        isToday: dateStr === this.data.today,
        status: '' // 将在加载记录后更新
      })
    }

    // 构建周数组（7天一组）
    const weeks = []
    let week = new Array(firstDay).fill(null) // 第一周前面的空白
    for (const day of days) {
      week.push(day)
      if (week.length === 7) {
        weeks.push(week)
        week = []
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null)
      weeks.push(week)
    }

    this.setData({ weeks })
  },

  // 加载当月打卡记录
  async loadMonthRecords() {
    try {
      const employee = app.globalData.currentEmployee
      if (!employee) return

      const { year, month } = this.data
      const records = await db.getMonthCheckinRecords(employee._id, year, month)

      // 构建记录映射
      const recordMap = {}
      const stats = { normal: 0, late: 0, early: 0, overtime: 0, absent: 0 }

      for (const record of records) {
        recordMap[record.date] = record
        if (record.status && stats[record.status] !== undefined) {
          stats[record.status]++
        }
      }

      // 更新日历中的状态
      const weeks = this.data.weeks.map(week =>
        week.map(day => {
          if (!day) return null
          const record = recordMap[day.date]
          return {
            ...day,
            status: record ? record.status : ''
          }
        })
      )

      this.setData({ recordMap, stats, weeks })
    } catch (err) {
      console.error('加载考勤记录失败:', err)
    }
  },

  // 上个月
  onPrevMonth() {
    let { year, month } = this.data
    month--
    if (month < 1) {
      month = 12
      year--
    }
    this.setData({ year, month })
    this.generateCalendar()
    this.loadMonthRecords()
  },

  // 下个月
  onNextMonth() {
    let { year, month } = this.data
    month++
    if (month > 12) {
      month = 1
      year++
    }
    this.setData({ year, month })
    this.generateCalendar()
    this.loadMonthRecords()
  },

  // 点击日期
  onDateTap(e) {
    const date = e.currentTarget.dataset.date
    if (!date) return

    const record = this.data.recordMap[date]

    this.setData({
      selectedDate: date,
      selectedRecord: record || null,
      workContent: record ? (record.workContent || '') : '',
      editingWorkContent: false
    })
  },

  // 编辑工作内容
  onEditWorkContent() {
    this.setData({ editingWorkContent: true })
  },

  // 工作内容输入
  onWorkContentInput(e) {
    this.setData({ workContent: e.detail.value })
  },

  // 保存工作内容
  async onSaveWorkContent() {
    const { selectedDate, workContent, selectedRecord } = this.data
    if (!selectedDate) return

    try {
      if (selectedRecord && selectedRecord._id) {
        await db.updateCheckinRecord(selectedRecord._id, {
          workContent
        })
      }

      // 更新本地数据
      const recordMap = { ...this.data.recordMap }
      if (recordMap[selectedDate]) {
        recordMap[selectedDate].workContent = workContent
      }

      this.setData({
        recordMap,
        selectedRecord: { ...selectedRecord, workContent },
        editingWorkContent: false
      })

      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (err) {
      console.error('保存工作内容失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  // 获取状态颜色类名
  getStatusClass(status) {
    const map = {
      normal: 'status-normal',
      late: 'status-late',
      early: 'status-early',
      overtime: 'status-overtime',
      absent: 'status-absent'
    }
    return map[status] || ''
  }
})
