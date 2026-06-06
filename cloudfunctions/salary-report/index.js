// 云函数：salary-report - 每月生成工资报表（新工资条结构）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// ========== 内嵌工资计算引擎 ==========

function isSunday(dateStr) { return new Date(dateStr).getDay() === 0 }

function calcHourlyRate(baseSalary, monthlyWorkHours) {
  if (!monthlyWorkHours || monthlyWorkHours <= 0) return 0
  return Math.floor(baseSalary / monthlyWorkHours)
}

function calcDailyRate(baseSalary, monthlyWorkDays) {
  if (!monthlyWorkDays || monthlyWorkDays <= 0) return 0
  return Math.floor(baseSalary / monthlyWorkDays)
}

function calcMealSubsidy(overtimeHours, dateStr, mealRules) {
  if (!overtimeHours || overtimeHours <= 0 || !mealRules) return 0
  if (isSunday(dateStr)) {
    if (overtimeHours >= mealRules.weekendFullThreshold) return mealRules.weekendFullAmount
    if (overtimeHours >= mealRules.weekendHalfThreshold) return mealRules.weekendHalfAmount
    return 0
  }
  return overtimeHours >= mealRules.weekdayThreshold ? mealRules.weekdayAmount : 0
}

function calcSeniorityPay(joinedAt, currentYear, currentMonth, seniorityRules) {
  if (!joinedAt || !seniorityRules || !seniorityRules.baseAmount) return 0
  const joinedDate = new Date(joinedAt)
  const currentDate = new Date(currentYear, currentMonth - 1, 1)
  let years = currentDate.getFullYear() - joinedDate.getFullYear()
  const monthDiff = currentDate.getMonth() - joinedDate.getMonth()
  if (monthDiff < 0) years--
  if (years <= 0) return 0
  return Math.floor(seniorityRules.baseAmount + (years - 1) * (seniorityRules.perYear || 0))
}

function calcLeaveDeduction(personalLeaveHours, absentHours, hourlyRate, leaveRules) {
  const personalRate = (leaveRules && leaveRules.personalLeaveRate) || 1
  const absentRate = (leaveRules && leaveRules.absentRate) || 1
  const personalLeaveDeduction = Math.floor(hourlyRate * (personalLeaveHours || 0) * personalRate)
  const absentDeduction = Math.floor(hourlyRate * (absentHours || 0) * absentRate)
  return { personalLeaveDeduction, absentDeduction, total: personalLeaveDeduction + absentDeduction }
}

function calcIncomeTax(taxableIncome) {
  if (!taxableIncome || taxableIncome <= 0) return 0
  const taxableYuan = taxableIncome / 100
  let tax = 0
  if (taxableYuan <= 3000) tax = taxableYuan * 0.03
  else if (taxableYuan <= 12000) tax = taxableYuan * 0.10 - 210
  else if (taxableYuan <= 25000) tax = taxableYuan * 0.20 - 1410
  else if (taxableYuan <= 35000) tax = taxableYuan * 0.25 - 2660
  else if (taxableYuan <= 55000) tax = taxableYuan * 0.30 - 4410
  else if (taxableYuan <= 80000) tax = taxableYuan * 0.35 - 7160
  else tax = taxableYuan * 0.45 - 15160
  return Math.max(Math.floor(tax * 100), 0)
}

// ========== 主函数 ==========

exports.main = async (event, context) => {
  const { companyId, year, month } = event
  if (!companyId || !year || !month) {
    return { success: false, message: '缺少必要参数' }
  }

  try {
    // 获取配置
    const configRes = await db.collection('salaryConfig').where({ companyId }).get()
    if (!configRes.data.length) return { success: false, message: '未找到工资配置' }
    const config = configRes.data[0]

    // 获取员工
    const employeesRes = await db.collection('employees').where({ companyId, status: 'active' }).get()
    const employees = employeesRes.data

    // 获取打卡记录
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`
    const recordsRes = await db.collection('checkinRecords')
      .where({ companyId, date: _.gte(startDate).and(_.lte(endDate)) })
      .get()
    const allRecords = recordsRes.data

    const results = []

    for (const employee of employees) {
      const records = allRecords.filter(r => r.employeeId === employee._id)

      // 汇总考勤
      let attendanceDays = 0, normalWorkHours = 0, weekdayOvertimeHours = 0
      let restDayHours = 0, holidayOvertimeHours = 0
      let personalLeaveHours = 0, absentHours = 0
      const dailyOvertime = []

      const workStart = config.standardWorkStart || '09:00'
      const workEnd = config.standardWorkEnd || '18:00'
      const [sH, sM] = workStart.split(':').map(Number)
      const [eH, eM] = workEnd.split(':').map(Number)
      const standardHours = (eH + eM / 60) - (sH + sM / 60)

      for (const record of records) {
        if (record.status === 'absent') { absentHours += standardHours; continue }
        if (record.checkInTime && record.checkOutTime) {
          attendanceDays++
          const total = (new Date(record.checkOutTime) - new Date(record.checkInTime)) / 3600000
          const sunday = isSunday(record.date)

          if (sunday) {
            holidayOvertimeHours += total
            dailyOvertime.push({ date: record.date, overtimeHours: total })
          } else if (total > standardHours) {
            normalWorkHours += standardHours
            const ot = total - standardHours
            weekdayOvertimeHours += ot
            dailyOvertime.push({ date: record.date, overtimeHours: ot })
          } else {
            normalWorkHours += total
          }

          if (record.status === 'late') {
            const stdStart = new Date(record.date + 'T' + workStart)
            const checkIn = new Date(record.checkInTime)
            if (checkIn > stdStart) personalLeaveHours += (checkIn - stdStart) / 3600000
          }
          if (record.status === 'early') {
            const stdEnd = new Date(record.date + 'T' + workEnd)
            const checkOut = new Date(record.checkOutTime)
            if (checkOut < stdEnd) absentHours += (stdEnd - checkOut) / 3600000
          }
        }
      }

      normalWorkHours = Math.round(normalWorkHours * 100) / 100
      weekdayOvertimeHours = Math.round(weekdayOvertimeHours * 100) / 100
      holidayOvertimeHours = Math.round(holidayOvertimeHours * 100) / 100
      personalLeaveHours = Math.round(personalLeaveHours * 100) / 100
      absentHours = Math.round(absentHours * 100) / 100

      // 计算工资
      const baseSalary = employee.monthlySalary || 0
      const monthlyWorkHours = config.monthlyWorkHours || 174
      const hourlyRate = calcHourlyRate(baseSalary, monthlyWorkHours)

      // 平时加班费 / 假日加班费
      const weekdayOvertimeRate = employee.type === 'intern'
        ? (config.weekdayOvertimeRateIntern || config.overtimeRateIntern || 1800)
        : (config.weekdayOvertimeRateFulltime || config.overtimeRateFulltime || 2600)
      const holidayOvertimeRate = employee.type === 'intern'
        ? (config.holidayOvertimeRateIntern || 2700)
        : (config.holidayOvertimeRateFulltime || 3900)
      const weekdayOvertimePay = Math.floor(weekdayOvertimeHours * weekdayOvertimeRate)
      const holidayOvertimePay = Math.floor(holidayOvertimeHours * holidayOvertimeRate)

      // 奖补
      const positionAllowance = employee.positionAllowance || 0
      const businessCommission = employee.businessCommission || 0
      const laborProtectionSubsidy = employee.laborProtectionSubsidy || 0
      const bonusAmount = 0
      const otherSubsidy = 0
      const loan = employee.loan || 0

      // 工龄工资
      const seniorityPay = calcSeniorityPay(employee.joinedAt, year, month, config.seniorityRules || {})

      // 薪资合计
      const salaryTotal = baseSalary + positionAllowance + businessCommission

      // 加班餐补
      let overtimeMealSubsidy = 0
      for (const day of dailyOvertime) {
        overtimeMealSubsidy += calcMealSubsidy(day.overtimeHours, day.date, config.mealSubsidyRules || {})
      }

      // 加班费
      const overtimePay = weekdayOvertimePay + holidayOvertimePay

      // 请假扣款
      const leaveDeduction = calcLeaveDeduction(personalLeaveHours, absentHours, hourlyRate, config.leaveRules || {})

      // 应付工资
      const grossPay = salaryTotal + overtimeMealSubsidy + overtimePay +
        laborProtectionSubsidy + bonusAmount + seniorityPay + otherSubsidy - leaveDeduction.total

      // 社保/个税
      const socialInsurance = config.socialInsurancePersonal || 0
      const taxThreshold = config.taxThreshold || 500000
      const specialDeduction = config.specialDeduction || 0
      const taxableIncome = grossPay - taxThreshold - socialInsurance - specialDeduction
      const incomeTax = calcIncomeTax(taxableIncome)

      // 实发工资
      const actualPay = Math.max(grossPay - socialInsurance - incomeTax - loan, 0)

      // 保存工资记录
      const salaryRecord = {
        companyId,
        employeeId: employee._id,
        year,
        month,
        // 考勤
        attendanceDays,
        normalWorkHours,
        weekdayOvertimeHours,
        restDayHours,
        holidayOvertimeHours,
        personalLeaveHours,
        absentHours,
        // 薪资
        baseSalary,
        hourlyRate,
        dailyRate: calcDailyRate(baseSalary, config.monthlyWorkDays || 21.75),
        positionAllowance,
        businessCommission,
        salaryTotal,
        // 加班
        weekdayOvertimePay,
        weekdayOvertimeRate,
        holidayOvertimePay,
        holidayOvertimeRate,
        overtimePay,
        overtimeMealSubsidy,
        // 奖补
        laborProtectionSubsidy,
        bonusAmount,
        seniorityPay,
        otherSubsidy,
        // 扣款
        personalLeaveDays: Math.round((personalLeaveHours / 8) * 100) / 100,
        leaveDeductionTotal: leaveDeduction.total,
        personalLeaveDeduction: leaveDeduction.personalLeaveDeduction,
        absentDeduction: leaveDeduction.absentDeduction,
        // 汇总
        grossPay,
        socialInsurance,
        taxableIncome: Math.max(taxableIncome, 0),
        incomeTax,
        loan,
        actualPay,
        configSnapshot: config,
        generatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }

      // 检查是否已存在
      const existing = await db.collection('salaryRecords')
        .where({ companyId, employeeId: employee._id, year, month })
        .get()

      if (existing.data.length > 0) {
        await db.collection('salaryRecords').doc(existing.data[0]._id).update({ data: salaryRecord })
      } else {
        await db.collection('salaryRecords').add({ data: salaryRecord })
      }

      results.push({
        employeeName: employee.name,
        department: employee.department || '',
        baseSalary: (baseSalary / 100).toFixed(2),
        salaryTotal: (salaryTotal / 100).toFixed(2),
        overtimePay: (overtimePay / 100).toFixed(2),
        overtimeMealSubsidy: (overtimeMealSubsidy / 100).toFixed(2),
        grossPay: (grossPay / 100).toFixed(2),
        socialInsurance: (socialInsurance / 100).toFixed(2),
        incomeTax: (incomeTax / 100).toFixed(2),
        loan: (loan / 100).toFixed(2),
        actualPay: (actualPay / 100).toFixed(2)
      })
    }

    return { success: true, count: results.length, results }
  } catch (err) {
    console.error('生成工资报表失败:', err)
    return { success: false, message: err.message }
  }
}
