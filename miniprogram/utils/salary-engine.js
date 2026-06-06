/**
 * 工资计算引擎（独立模块）
 *
 * 工资条字段：
 * 序号 | 姓名 | 部门 | 出勤天数 | 基本底薪 | 平班时间 | 平时加班费 | 休息时间 |
 * 假日加班费 | 职务津贴 | 业务提成 | 薪资合计 | 加班餐补 | 加班费 |
 * 劳保补贴 | 奖金 | 工龄工资 | 其他补贴 | 事假 | 缺勤时间(H) | 请假扣款 |
 * 应付工资 | 社保个人缴纳 | 个人所得税 | 借款 | 实发工资
 *
 * 计算公式：
 * 时薪 = 基本底薪 ÷ 本月应工作小时数
 * 平时加班费 = 平时加班小时数 × 平时加班费率
 * 假日加班费 = 假日加班小时数 × 假日加班费率
 * 薪资合计 = 基本底薪 + 职务津贴 + 业务提成
 * 加班费 = 平时加班费 + 假日加班费
 * 请假扣款 = (事假天数 + 缺勤时间折算天数) × 日薪
 * 应付工资 = 薪资合计 + 加班餐补 + 加班费 + 劳保补贴 + 奖金 + 工龄工资 + 其他补贴 - 请假扣款
 * 实发工资 = 应付工资 - 社保个人缴纳 - 个人所得税 - 借款
 *
 * 所有金额使用"分"为单位存储，避免浮点误差
 */

const { isSunday, hoursBetween } = require('./util')

/**
 * 计算时薪
 * @param {number} baseSalary - 基本底薪（分）
 * @param {number} monthlyWorkHours - 本月应工作小时数
 * @returns {number} 时薪（分/小时），向下取整
 */
function calcHourlyRate(baseSalary, monthlyWorkHours) {
  if (!monthlyWorkHours || monthlyWorkHours <= 0) return 0
  return Math.floor(baseSalary / monthlyWorkHours)
}

/**
 * 计算日薪
 * @param {number} baseSalary - 基本底薪（分）
 * @param {number} monthlyWorkDays - 本月应工作天数
 * @returns {number} 日薪（分），向下取整
 */
function calcDailyRate(baseSalary, monthlyWorkDays) {
  if (!monthlyWorkDays || monthlyWorkDays <= 0) return 0
  return Math.floor(baseSalary / monthlyWorkDays)
}

/**
 * 计算平时加班费（工作日加班）
 * @param {number} weekdayOvertimeHours - 平时加班小时数
 * @param {number} weekdayOvertimeRate - 平时加班费率（分/小时）
 * @returns {number} 平时加班费（分）
 */
function calcWeekdayOvertimePay(weekdayOvertimeHours, weekdayOvertimeRate) {
  if (!weekdayOvertimeHours || weekdayOvertimeHours <= 0) return 0
  return Math.floor(weekdayOvertimeHours * weekdayOvertimeRate)
}

/**
 * 计算假日加班费（周末/法定假日加班）
 * @param {number} holidayOvertimeHours - 假日加班小时数
 * @param {number} holidayOvertimeRate - 假日加班费率（分/小时）
 * @returns {number} 假日加班费（分）
 */
function calcHolidayOvertimePay(holidayOvertimeHours, holidayOvertimeRate) {
  if (!holidayOvertimeHours || holidayOvertimeHours <= 0) return 0
  return Math.floor(holidayOvertimeHours * holidayOvertimeRate)
}

/**
 * 计算加班餐补
 * @param {number} overtimeHours - 当日加班小时数
 * @param {string} dateStr - 日期字符串 YYYY-MM-DD
 * @param {object} mealRules - 餐补规则
 * @returns {number} 餐补金额（分）
 */
function calcMealSubsidy(overtimeHours, dateStr, mealRules) {
  if (!overtimeHours || overtimeHours <= 0 || !mealRules) return 0

  const sunday = isSunday(dateStr)

  if (sunday) {
    if (overtimeHours >= mealRules.weekendFullThreshold) {
      return mealRules.weekendFullAmount
    } else if (overtimeHours >= mealRules.weekendHalfThreshold) {
      return mealRules.weekendHalfAmount
    }
    return 0
  } else {
    if (overtimeHours >= mealRules.weekdayThreshold) {
      return mealRules.weekdayAmount
    }
    return 0
  }
}

/**
 * 计算月度加班餐补合计
 * @param {Array} dailyOvertime - 每日加班记录 [{date, overtimeHours}]
 * @param {object} mealRules - 餐补规则
 * @returns {number} 月度加班餐补合计（分）
 */
function calcMonthlyMealSubsidy(dailyOvertime, mealRules) {
  let total = 0
  for (const day of dailyOvertime) {
    total += calcMealSubsidy(day.overtimeHours, day.date, mealRules)
  }
  return total
}

/**
 * 计算工龄工资
 * @param {string} joinedAt - 入职时间 ISO 8601
 * @param {number} currentYear - 当前年
 * @param {number} currentMonth - 当前月
 * @param {object} seniorityRules - 工龄工资规则 { baseAmount, perYear }
 * @returns {number} 工龄工资（分）
 */
function calcSeniorityPay(joinedAt, currentYear, currentMonth, seniorityRules) {
  if (!joinedAt || !seniorityRules || !seniorityRules.baseAmount) return 0

  const joinedDate = new Date(joinedAt)
  const currentDate = new Date(currentYear, currentMonth - 1, 1)

  let years = currentDate.getFullYear() - joinedDate.getFullYear()
  const monthDiff = currentDate.getMonth() - joinedDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && currentDate.getDate() < joinedDate.getDate())) {
    years--
  }

  if (years <= 0) return 0
  return Math.floor(seniorityRules.baseAmount + (years - 1) * (seniorityRules.perYear || 0))
}

/**
 * 计算请假扣款
 * @param {number} personalLeaveHours - 事假时间（小时）
 * @param {number} absentHours - 缺勤时间（小时）
 * @param {number} hourlyRate - 时薪（分/小时）
 * @param {object} leaveRules - 请假扣款规则
 * @returns {object} { personalLeaveDeduction, absentDeduction, total }
 */
function calcLeaveDeduction(personalLeaveHours, absentHours, hourlyRate, leaveRules) {
  const personalRate = (leaveRules && leaveRules.personalLeaveRate) || 1
  const absentRate = (leaveRules && leaveRules.absentRate) || 1

  const personalLeaveDeduction = Math.floor(hourlyRate * (personalLeaveHours || 0) * personalRate)
  const absentDeduction = Math.floor(hourlyRate * (absentHours || 0) * absentRate)

  return {
    personalLeaveDeduction,
    absentDeduction,
    total: personalLeaveDeduction + absentDeduction
  }
}

/**
 * 计算个人所得税（中国个税 - 简化版累进税率）
 * 按月度应纳税所得额计算
 * @param {number} taxableIncome - 应纳税所得额（分）= 应付工资 - 5000元起征点 - 专项扣除
 * @returns {number} 个人所得税（分）
 */
function calcIncomeTax(taxableIncome) {
  if (!taxableIncome || taxableIncome <= 0) return 0

  const taxableYuan = taxableIncome / 100
  let tax = 0

  if (taxableYuan <= 3000) {
    tax = taxableYuan * 0.03
  } else if (taxableYuan <= 12000) {
    tax = taxableYuan * 0.10 - 210
  } else if (taxableYuan <= 25000) {
    tax = taxableYuan * 0.20 - 1410
  } else if (taxableYuan <= 35000) {
    tax = taxableYuan * 0.25 - 2660
  } else if (taxableYuan <= 55000) {
    tax = taxableYuan * 0.30 - 4410
  } else if (taxableYuan <= 80000) {
    tax = taxableYuan * 0.35 - 7160
  } else {
    tax = taxableYuan * 0.45 - 15160
  }

  return Math.max(Math.floor(tax * 100), 0) // 转回分
}

/**
 * 计算月度工资（主入口）
 * @param {object} params - 计算参数
 * @param {object} params.employee - 员工信息 { baseSalary, department, position, joinedAt, type }
 * @param {object} params.attendance - 考勤数据 { attendanceDays, normalWorkHours, weekdayOvertimeHours, restDayHours, holidayOvertimeHours, personalLeaveHours, absentHours, dailyOvertime }
 * @param {object} params.bonuses - 奖补数据 { positionAllowance, businessCommission, laborProtectionSubsidy, bonus, otherSubsidy, loan }
 * @param {object} params.config - 工资配置
 * @returns {object} 完整工资条数据
 */
function calcMonthlySalary(params) {
  const { employee, attendance, bonuses, config } = params

  // === 基础数据 ===
  const baseSalary = employee.baseSalary || 0
  const monthlyWorkHours = config.monthlyWorkHours || 174
  const monthlyWorkDays = config.monthlyWorkDays || 21.75
  const hourlyRate = calcHourlyRate(baseSalary, monthlyWorkHours)

  // === 考勤字段 ===
  const attendanceDays = attendance.attendanceDays || 0
  const normalWorkHours = attendance.normalWorkHours || 0
  const weekdayOvertimeHours = attendance.weekdayOvertimeHours || 0
  const restDayHours = attendance.restDayHours || 0
  const holidayOvertimeHours = attendance.holidayOvertimeHours || 0
  const personalLeaveHours = attendance.personalLeaveHours || 0
  const absentHours = attendance.absentHours || 0

  // === 加班费计算 ===
  const weekdayOvertimeRate = employee.type === 'intern'
    ? (config.weekdayOvertimeRateIntern || config.overtimeRateIntern || 1800)
    : (config.weekdayOvertimeRateFulltime || config.overtimeRateFulltime || 2600)
  const holidayOvertimeRate = employee.type === 'intern'
    ? (config.holidayOvertimeRateIntern || 2700)
    : (config.holidayOvertimeRateFulltime || 3900)

  const weekdayOvertimePay = calcWeekdayOvertimePay(weekdayOvertimeHours, weekdayOvertimeRate)
  const holidayOvertimePay = calcHolidayOvertimePay(holidayOvertimeHours, holidayOvertimeRate)

  // === 奖补字段 ===
  const positionAllowance = bonuses.positionAllowance || 0       // 职务津贴
  const businessCommission = bonuses.businessCommission || 0     // 业务提成
  const laborProtectionSubsidy = bonuses.laborProtectionSubsidy || 0 // 劳保补贴
  const bonusAmount = bonuses.bonus || 0                          // 奖金
  const otherSubsidy = bonuses.otherSubsidy || 0                 // 其他补贴
  const loan = bonuses.loan || 0                                  // 借款

  // 工龄工资
  const seniorityPay = calcSeniorityPay(
    employee.joinedAt,
    config.year || new Date().getFullYear(),
    config.month || new Date().getMonth() + 1,
    config.seniorityRules
  )

  // === 薪资合计 = 基本底薪 + 职务津贴 + 业务提成 ===
  const salaryTotal = baseSalary + positionAllowance + businessCommission

  // === 加班餐补 ===
  const overtimeMealSubsidy = calcMonthlyMealSubsidy(
    attendance.dailyOvertime || [],
    config.mealSubsidyRules || {}
  )

  // === 加班费 = 平时加班费 + 假日加班费 ===
  const overtimePay = weekdayOvertimePay + holidayOvertimePay

  // === 请假扣款 ===
  const leaveDeduction = calcLeaveDeduction(
    personalLeaveHours,
    absentHours,
    hourlyRate,
    config.leaveRules || {}
  )

  // === 事假（天）= 事假小时 / 8 ===
  const personalLeaveDays = Math.round((personalLeaveHours / 8) * 100) / 100

  // === 缺勤时间(H) ===
  const absentHoursDisplay = Math.round(absentHours * 100) / 100

  // === 应付工资 = 薪资合计 + 加班餐补 + 加班费 + 劳保补贴 + 奖金 + 工龄工资 + 其他补贴 - 请假扣款 ===
  const grossPay = salaryTotal + overtimeMealSubsidy + overtimePay +
    laborProtectionSubsidy + bonusAmount + seniorityPay + otherSubsidy -
    leaveDeduction.total

  // === 社保个人缴纳 ===
  const socialInsurance = config.socialInsurancePersonal || 0

  // === 个人所得税 ===
  const taxThreshold = config.taxThreshold || 500000 // 5000元=500000分
  const specialDeduction = config.specialDeduction || 0 // 专项附加扣除
  const taxableIncome = grossPay - taxThreshold - socialInsurance - specialDeduction
  const incomeTax = calcIncomeTax(taxableIncome)

  // === 实发工资 = 应付工资 - 社保个人缴纳 - 个人所得税 - 借款 ===
  const actualPay = grossPay - socialInsurance - incomeTax - loan

  return {
    // 基础
    baseSalary,
    hourlyRate,
    dailyRate: calcDailyRate(baseSalary, monthlyWorkDays),
    // 考勤
    attendanceDays,
    normalWorkHours: Math.round(normalWorkHours * 100) / 100,
    weekdayOvertimeHours: Math.round(weekdayOvertimeHours * 100) / 100,
    restDayHours: Math.round(restDayHours * 100) / 100,
    holidayOvertimeHours: Math.round(holidayOvertimeHours * 100) / 100,
    // 加班
    weekdayOvertimePay,
    weekdayOvertimeRate,
    holidayOvertimePay,
    holidayOvertimeRate,
    overtimePay,
    overtimeMealSubsidy,
    // 奖补
    positionAllowance,
    businessCommission,
    salaryTotal,
    laborProtectionSubsidy,
    bonusAmount,
    seniorityPay,
    otherSubsidy,
    // 扣款
    personalLeaveDays,
    personalLeaveHours: Math.round(personalLeaveHours * 100) / 100,
    absentHours: absentHoursDisplay,
    leaveDeductionTotal: leaveDeduction.total,
    personalLeaveDeduction: leaveDeduction.personalLeaveDeduction,
    absentDeduction: leaveDeduction.absentDeduction,
    // 汇总
    grossPay,
    socialInsurance,
    taxableIncome: Math.max(taxableIncome, 0),
    incomeTax,
    loan,
    actualPay: Math.max(actualPay, 0)
  }
}

/**
 * 从打卡记录中汇总月度考勤数据
 * @param {Array} records - 打卡记录数组
 * @param {object} config - 工资配置
 * @returns {object} 考勤汇总
 */
function aggregateMonthData(records, config) {
  let attendanceDays = 0
  let normalWorkHours = 0
  let weekdayOvertimeHours = 0
  let restDayHours = 0
  let holidayOvertimeHours = 0
  let personalLeaveHours = 0
  let absentHours = 0
  const dailyOvertime = []

  const workStart = config.standardWorkStart || '09:00'
  const workEnd = config.standardWorkEnd || '18:00'
  const [startH, startM] = workStart.split(':').map(Number)
  const [endH, endM] = workEnd.split(':').map(Number)
  const standardHours = (endH + endM / 60) - (startH + startM / 60)

  for (const record of records) {
    if (record.status === 'absent') {
      absentHours += standardHours
      continue
    }

    if (record.checkInTime && record.checkOutTime) {
      attendanceDays++
      const totalHours = hoursBetween(record.checkInTime, record.checkOutTime)
      const sunday = isSunday(record.date)

      if (sunday) {
        // 周日算假日加班
        holidayOvertimeHours += totalHours
        dailyOvertime.push({ date: record.date, overtimeHours: totalHours })
      } else if (totalHours > standardHours) {
        // 工作日：标准时间内为平班，超出为平时加班
        normalWorkHours += standardHours
        const ot = totalHours - standardHours
        weekdayOvertimeHours += ot
        dailyOvertime.push({ date: record.date, overtimeHours: ot })
      } else {
        normalWorkHours += totalHours
      }

      // 迟到时间记为事假
      if (record.status === 'late' && record.checkInTime) {
        const checkInDate = new Date(record.checkInTime)
        const standardStart = new Date(record.date + 'T' + workStart)
        if (checkInDate > standardStart) {
          personalLeaveHours += hoursBetween(standardStart.toISOString(), record.checkInTime)
        }
      }

      // 早退时间记为缺勤
      if (record.status === 'early' && record.checkOutTime) {
        const checkOutDate = new Date(record.checkOutTime)
        const standardEnd = new Date(record.date + 'T' + workEnd)
        if (checkOutDate < standardEnd) {
          absentHours += hoursBetween(record.checkOutTime, standardEnd.toISOString())
        }
      }
    }
  }

  return {
    attendanceDays,
    normalWorkHours: Math.round(normalWorkHours * 100) / 100,
    weekdayOvertimeHours: Math.round(weekdayOvertimeHours * 100) / 100,
    restDayHours: Math.round(restDayHours * 100) / 100,
    holidayOvertimeHours: Math.round(holidayOvertimeHours * 100) / 100,
    personalLeaveHours: Math.round(personalLeaveHours * 100) / 100,
    absentHours: Math.round(absentHours * 100) / 100,
    dailyOvertime
  }
}

module.exports = {
  calcHourlyRate,
  calcDailyRate,
  calcWeekdayOvertimePay,
  calcHolidayOvertimePay,
  calcMealSubsidy,
  calcMonthlyMealSubsidy,
  calcSeniorityPay,
  calcLeaveDeduction,
  calcIncomeTax,
  calcMonthlySalary,
  aggregateMonthData
}
