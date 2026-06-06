// pages/salary/salary.js
// 工资预览页面 - 根据管理员自定义的工资条字段动态渲染
const app = getApp()
const db = require('../../utils/db')
const { fenToYuan } = require('../../utils/util')
const salaryEngine = require('../../utils/salary-engine')
const { buildSalaryRows, formatSalaryToYuan } = require('../../utils/salary-fields')

Page({
  data: {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    salaryRows: [],
    actualPay: '0.00',
    grossPay: '0.00',
    loading: true,
    hasData: false
  },

  onLoad: function() { this.loadSalaryData() },
  onShow: function() { this.loadSalaryData() },

  onPrevMonth() {
    let { year, month } = this.data
    month--
    if (month < 1) { month = 12; year-- }
    this.setData({ year, month, loading: true })
    this.loadSalaryData()
  },

  onNextMonth() {
    let { year, month } = this.data
    month++
    if (month > 12) { month = 1; year++ }
    this.setData({ year, month, loading: true })
    this.loadSalaryData()
  },

  async loadSalaryData() {
    try {
      const employee = app.globalData.currentEmployee
      if (!employee) { this.setData({ loading: false, hasData: false }); return }

      const { year, month } = this.data
      const config = await db.getSalaryConfig()
      if (!config) { this.setData({ loading: false, hasData: false }); return }

      let salaryResult, manualData

      // 先查已生成的工资记录
      const existingRecord = await db.getSalaryRecord(employee._id, year, month)
      if (existingRecord) {
        salaryResult = existingRecord
        manualData = existingRecord.manualData || {}
      } else {
        const records = await db.getMonthCheckinRecords(employee._id, year, month)
        if (!records.length) { this.setData({ loading: false, hasData: false }); return }

        const attendanceData = salaryEngine.aggregateMonthData(records, config)
        salaryResult = salaryEngine.calcMonthlySalary({
          employee: {
            baseSalary: employee.monthlySalary || 0,
            department: employee.department || '',
            joinedAt: employee.joinedAt,
            type: employee.type || 'fulltime'
          },
          attendance: attendanceData,
          bonuses: {
            positionAllowance: employee.positionAllowance || 0,
            businessCommission: employee.businessCommission || 0,
            laborProtectionSubsidy: employee.laborProtectionSubsidy || 0,
            bonus: 0, otherSubsidy: 0, loan: 0
          },
          config: { ...config, year, month }
        })
        manualData = {}
      }

      // 获取工资条字段模板（管理员自定义的）
      const template = config.salaryTemplate || []

      // 格式化工资数据
      const formattedData = formatSalaryToYuan(salaryResult, fenToYuan)

      // 构建动态工资条行
      const salaryRows = buildSalaryRows(template, formattedData, manualData)

      this.setData({
        salaryRows,
        actualPay: fenToYuan(salaryResult.actualPay),
        grossPay: fenToYuan(salaryResult.grossPay),
        loading: false,
        hasData: true
      })

    } catch (err) {
      console.error('加载工资数据失败:', err)
      this.setData({ loading: false, hasData: false })
    }
  }
})
