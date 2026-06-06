/**
 * 工资计算引擎 - 单元测试
 *
 * 运行方式：node salary-engine.test.js
 */

const {
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
} = require('./salary-engine')

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
    console.log(`  PASS: ${message}`)
  } else {
    failed++
    console.error(`  FAIL: ${message}`)
  }
}

function assertEqual(actual, expected, message) {
  const ok = actual === expected
  if (!ok) {
    console.error(`    期望: ${expected}, 实际: ${actual}`)
  }
  assert(ok, message)
}

// ========== 测试用例 ==========

function testCalcHourlyRate() {
  console.log('\n--- calcHourlyRate 测试 ---')
  assertEqual(calcHourlyRate(500000, 174), 2873, '时薪 = 500000 / 174 = 2873(分)')
  assertEqual(calcHourlyRate(0, 174), 0, '底薪为0，时薪为0')
  assertEqual(calcHourlyRate(500000, 0), 0, '工时为0，时薪为0')
}

function testCalcDailyRate() {
  console.log('\n--- calcDailyRate 测试 ---')
  assertEqual(calcDailyRate(500000, 21.75), 22988, '日薪 = 500000 / 21.75 = 22988(分)')
  assertEqual(calcDailyRate(800000, 21.75), 36781, '日薪 = 800000 / 21.75 = 36781(分)')
}

function testCalcWeekdayOvertimePay() {
  console.log('\n--- calcWeekdayOvertimePay 测试 ---')
  assertEqual(calcWeekdayOvertimePay(10, 2600), 26000, '平时加班 = 10 * 2600 = 26000(分)')
  assertEqual(calcWeekdayOvertimePay(0, 2600), 0, '平时加班0小时，费用为0')
}

function testCalcHolidayOvertimePay() {
  console.log('\n--- calcHolidayOvertimePay 测试 ---')
  assertEqual(calcHolidayOvertimePay(8, 3900), 31200, '假日加班 = 8 * 3900 = 31200(分)')
  assertEqual(calcHolidayOvertimePay(0, 3900), 0, '假日加班0小时，费用为0')
}

function testCalcMealSubsidy() {
  console.log('\n--- calcMealSubsidy 测试 ---')
  const mealRules = {
    weekdayAmount: 1500, weekendFullAmount: 3000, weekendHalfAmount: 1500,
    weekdayThreshold: 2, weekendFullThreshold: 8, weekendHalfThreshold: 4
  }
  assertEqual(calcMealSubsidy(3, '2025-01-06', mealRules), 1500, '周一加班3小时，餐补15元')
  assertEqual(calcMealSubsidy(1.5, '2025-01-07', mealRules), 0, '周二加班1.5小时，无餐补')
  assertEqual(calcMealSubsidy(10, '2025-01-05', mealRules), 3000, '周日加班10小时，餐补30元')
  assertEqual(calcMealSubsidy(5, '2025-01-05', mealRules), 1500, '周日加班5小时，餐补15元')
}

function testCalcSeniorityPay() {
  console.log('\n--- calcSeniorityPay 测试 ---')
  const rules = { baseAmount: 5000, perYear: 10000 } // 基础50元/年，每年加100元
  const result = calcSeniorityPay('2020-06-01', 2025, 6, rules)
  // years=5, baseAmount(50元)+4*perYear(400元)=450元=45000分
  assertEqual(result, 45000, '5年工龄 = 50+4*100=450元=45000分')

  // 入职不满1年，years=0，返回0
  const result2 = calcSeniorityPay('2024-12-01', 2025, 5, rules)
  assertEqual(result2, 0, '不满1年工龄=0')

  const result3 = calcSeniorityPay('2024-01-01', 2025, 6, rules)
  assertEqual(result3, 5000, '1年工龄 = 基础50元=5000分')
}

function testCalcLeaveDeduction() {
  console.log('\n--- calcLeaveDeduction 测试 ---')
  const hourlyRate = 2873
  // 事假8小时，缺勤4小时
  let result = calcLeaveDeduction(8, 4, hourlyRate, {})
  assertEqual(result.personalLeaveDeduction, 22984, '事假扣款 = 2873*8*1 = 22984(分)')
  assertEqual(result.absentDeduction, 11492, '缺勤扣款 = 2873*4*1 = 11492(分)')
  assertEqual(result.total, 34476, '请假扣款合计 = 34476(分)')

  // 自定义扣款倍率
  result = calcLeaveDeduction(8, 4, hourlyRate, { personalLeaveRate: 1, absentRate: 2 })
  assertEqual(result.absentDeduction, 22984, '缺勤2倍扣款 = 2873*4*2 = 22984(分)')
}

function testCalcIncomeTax() {
  console.log('\n--- calcIncomeTax 测试 ---')
  // 不超过3000元：3%
  assertEqual(calcIncomeTax(300000), 9000, '应纳税3000元，税=3000*3%=90元=9000分')
  // 超过3000-12000元：10% - 210
  assertEqual(calcIncomeTax(600000), 39000, '应纳税6000元，税=6000*10%-210=390元=39000分')
  // 不纳税
  assertEqual(calcIncomeTax(0), 0, '应纳税0，税为0')
  assertEqual(calcIncomeTax(-100000), 0, '应纳税为负，税为0')
}

function testCalcMonthlySalary() {
  console.log('\n--- calcMonthlySalary 完整计算测试 ---')

  const result = calcMonthlySalary({
    employee: {
      baseSalary: 800000,     // 基本底薪 8000元
      department: '技术部',
      joinedAt: '2021-06-01',
      type: 'fulltime'
    },
    attendance: {
      attendanceDays: 20,
      normalWorkHours: 168,
      weekdayOvertimeHours: 12,
      restDayHours: 0,
      holidayOvertimeHours: 8,
      personalLeaveHours: 4,
      absentHours: 0,
      dailyOvertime: [
        { date: '2025-01-06', overtimeHours: 3 },
        { date: '2025-01-07', overtimeHours: 4 },
        { date: '2025-01-05', overtimeHours: 8 }
      ]
    },
    bonuses: {
      positionAllowance: 50000,   // 职务津贴 500元
      businessCommission: 100000, // 业务提成 1000元
      laborProtectionSubsidy: 2000, // 劳保补贴 20元
      bonus: 0,
      otherSubsidy: 0,
      loan: 0
    },
    config: {
      monthlyWorkHours: 174,
      monthlyWorkDays: 21.75,
      overtimeRateFulltime: 2600,
      overtimeRateIntern: 1800,
      weekdayOvertimeRateFulltime: 2600,
      holidayOvertimeRateFulltime: 3900,
      mealSubsidyRules: {
        weekdayAmount: 1500, weekendFullAmount: 3000, weekendHalfAmount: 1500,
        weekdayThreshold: 2, weekendFullThreshold: 8, weekendHalfThreshold: 4
      },
      seniorityRules: { baseAmount: 5000, perYear: 10000 }, // 50元基础，每年加100元
      leaveRules: { personalLeaveRate: 1, absentRate: 1 },
      socialInsurancePersonal: 105000, // 社保个人 1050元
      taxThreshold: 500000,            // 起征点 5000元
      specialDeduction: 0,
      year: 2025,
      month: 1
    }
  })

  // 验证核心字段
  assert(result.baseSalary === 800000, '基本底薪 = 800000(分)')
  assert(result.attendanceDays === 20, '出勤天数 = 20')

  // 薪资合计 = 底薪 + 职务津贴 + 业务提成
  assertEqual(result.salaryTotal, 950000, '薪资合计 = 8000+500+1000 = 9500元=950000分')

  // 加班费 = 平时加班费 + 假日加班费
  const expectedWeekdayOT = Math.floor(12 * 2600) // 31200
  const expectedHolidayOT = Math.floor(8 * 3900)  // 31200
  assertEqual(result.weekdayOvertimePay, expectedWeekdayOT, `平时加班费 = ${expectedWeekdayOT}`)
  assertEqual(result.holidayOvertimePay, expectedHolidayOT, `假日加班费 = ${expectedHolidayOT}`)
  assertEqual(result.overtimePay, expectedWeekdayOT + expectedHolidayOT, '加班费合计')

  // 加班餐补
  assertEqual(result.overtimeMealSubsidy, 6000, '加班餐补 = 15+15+30 = 60元=6000分')

  // 工龄工资 (2021-06-01到2025-01-01，约3.5年，取3年)
  assert(result.seniorityPay > 0, '工龄工资大于0')

  // 请假扣款
  assert(result.leaveDeductionTotal > 0, '请假扣款大于0')

  // 实发工资
  assert(result.actualPay > 0, '实发工资大于0')
  assert(result.grossPay > 0, '应付工资大于0')

  console.log(`    基本底薪: ${(result.baseSalary / 100).toFixed(2)} 元`)
  console.log(`    薪资合计: ${(result.salaryTotal / 100).toFixed(2)} 元`)
  console.log(`    加班费: ${(result.overtimePay / 100).toFixed(2)} 元 (平时${(result.weekdayOvertimePay / 100).toFixed(2)} + 假日${(result.holidayOvertimePay / 100).toFixed(2)})`)
  console.log(`    加班餐补: ${(result.overtimeMealSubsidy / 100).toFixed(2)} 元`)
  console.log(`    工龄工资: ${(result.seniorityPay / 100).toFixed(2)} 元`)
  console.log(`    请假扣款: ${(result.leaveDeductionTotal / 100).toFixed(2)} 元`)
  console.log(`    应付工资: ${(result.grossPay / 100).toFixed(2)} 元`)
  console.log(`    社保: ${(result.socialInsurance / 100).toFixed(2)} 元`)
  console.log(`    个税: ${(result.incomeTax / 100).toFixed(2)} 元`)
  console.log(`    实发工资: ${(result.actualPay / 100).toFixed(2)} 元`)
}

// ========== 运行所有测试 ==========

function runTests() {
  console.log('========================================')
  console.log('  工资计算引擎 - 单元测试（新工资条结构）')
  console.log('========================================')

  passed = 0
  failed = 0

  testCalcHourlyRate()
  testCalcDailyRate()
  testCalcWeekdayOvertimePay()
  testCalcHolidayOvertimePay()
  testCalcMealSubsidy()
  testCalcSeniorityPay()
  testCalcLeaveDeduction()
  testCalcIncomeTax()
  testCalcMonthlySalary()

  console.log('\n========================================')
  console.log(`  结果: ${passed} 通过, ${failed} 失败`)
  console.log('========================================')

  return failed === 0
}

if (typeof module !== 'undefined' && !module.parent) {
  runTests()
}

module.exports = { runTests }
