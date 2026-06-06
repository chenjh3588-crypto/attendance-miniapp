/**
 * 工资条动态字段系统
 *
 * 设计理念：不同公司的工资条组成完全不同，管理员可以自由：
 * 1. 添加/删除字段
 * 2. 修改字段名称、类型、分组
 * 3. 字段值来源分为：
 *    - auto（自动计算）：系统根据考勤和配置自动填值，不可手动修改
 *    - manual（手动填写）：管理员在生成工资时或每月批量填写
 *
 * 自动计算字段的数据源映射：
 *    attendanceDays → 出勤天数
 *    normalWorkHours → 平班时间
 *    baseSalary → 基本底薪
 *    ...等等
 *
 * 手动填写字段：如"奖金"、"其他补贴"、"业务提成"等，每个公司不同
 */

// ========== 自动计算字段的数据源映射 ==========

const AUTO_FIELD_SOURCES = {
  // 考勤类
  attendanceDays:        { dataType: 'number', desc: '出勤天数（自动从考勤计算）' },
  normalWorkHours:       { dataType: 'number', desc: '平班时间/小时（自动计算）' },
  restDayHours:          { dataType: 'number', desc: '休息日时间/小时（自动计算）' },
  weekdayOvertimeHours:  { dataType: 'number', desc: '平时加班时间/小时（自动计算）' },
  holidayOvertimeHours:  { dataType: 'number', desc: '假日加班时间/小时（自动计算）' },
  personalLeaveHours:    { dataType: 'number', desc: '事假时间/小时（自动计算）' },
  personalLeaveDays:     { dataType: 'number', desc: '事假天数（自动计算）' },
  absentHours:           { dataType: 'number', desc: '缺勤时间/小时（自动计算）' },

  // 薪资类
  baseSalary:            { dataType: 'money', desc: '基本底薪（来自员工信息）' },
  hourlyRate:            { dataType: 'money', desc: '时薪（自动计算）' },
  positionAllowance:     { dataType: 'money', desc: '职务津贴（来自员工信息）' },
  businessCommission:    { dataType: 'money', desc: '业务提成（来自员工信息）' },
  salaryTotal:           { dataType: 'money', desc: '薪资合计=底薪+职务津贴+提成（自动计算）' },

  // 加班类
  weekdayOvertimePay:    { dataType: 'money', desc: '平时加班费（自动计算）' },
  holidayOvertimePay:    { dataType: 'money', desc: '假日加班费（自动计算）' },
  overtimePay:           { dataType: 'money', desc: '加班费合计（自动计算）' },
  overtimeMealSubsidy:   { dataType: 'money', desc: '加班餐补（自动计算）' },

  // 奖补类
  laborProtectionSubsidy:{ dataType: 'money', desc: '劳保补贴（来自员工信息）' },
  seniorityPay:          { dataType: 'money', desc: '工龄工资（自动计算）' },

  // 扣款类
  personalLeaveDeduction:{ dataType: 'money', desc: '事假扣款（自动计算）' },
  absentDeduction:       { dataType: 'money', desc: '缺勤扣款（自动计算）' },
  leaveDeductionTotal:   { dataType: 'money', desc: '请假扣款合计（自动计算）' },

  // 汇总类
  grossPay:              { dataType: 'money', desc: '应付工资（自动计算）' },
  socialInsurance:       { dataType: 'money', desc: '社保个人缴纳（来自配置）' },
  incomeTax:             { dataType: 'money', desc: '个人所得税（自动计算）' },
  loan:                  { dataType: 'money', desc: '借款（来自员工信息）' },
  actualPay:             { dataType: 'money', desc: '实发工资（自动计算）' }
}

// ========== 默认工资条模板 ==========

function getDefaultTemplate() {
  return [
    // 考勤
    { id: 'f01', label: '出勤天数',   type: 'auto',  source: 'attendanceDays',       group: 'attendance', order: 1 },
    { id: 'f02', label: '平班时间',   type: 'auto',  source: 'normalWorkHours',      group: 'attendance', order: 2 },
    { id: 'f03', label: '休息时间',   type: 'auto',  source: 'restDayHours',         group: 'attendance', order: 3 },
    { id: 'f04', label: '事假',       type: 'auto',  source: 'personalLeaveDays',    group: 'attendance', order: 4 },
    { id: 'f05', label: '缺勤时间(H)',type: 'auto',  source: 'absentHours',          group: 'attendance', order: 5 },
    // 薪资
    { id: 'f06', label: '基本底薪',   type: 'auto',  source: 'baseSalary',           group: 'salary',     order: 6 },
    { id: 'f07', label: '职务津贴',   type: 'auto',  source: 'positionAllowance',    group: 'salary',     order: 7 },
    { id: 'f08', label: '业务提成',   type: 'auto',  source: 'businessCommission',   group: 'salary',     order: 8 },
    { id: 'f09', label: '薪资合计',   type: 'auto',  source: 'salaryTotal',          group: 'salary',     order: 9,  highlight: true },
    // 加班
    { id: 'f10', label: '平时加班费', type: 'auto',  source: 'weekdayOvertimePay',   group: 'overtime',   order: 10 },
    { id: 'f11', label: '假日加班费', type: 'auto',  source: 'holidayOvertimePay',   group: 'overtime',   order: 11 },
    { id: 'f12', label: '加班费',     type: 'auto',  source: 'overtimePay',          group: 'overtime',   order: 12 },
    { id: 'f13', label: '加班餐补',   type: 'auto',  source: 'overtimeMealSubsidy',  group: 'overtime',   order: 13 },
    // 奖补
    { id: 'f14', label: '劳保补贴',   type: 'auto',  source: 'laborProtectionSubsidy', group: 'bonus',    order: 14 },
    { id: 'f15', label: '奖金',       type: 'manual', source: null, dataType: 'money',  group: 'bonus',    order: 15 },
    { id: 'f16', label: '工龄工资',   type: 'auto',  source: 'seniorityPay',         group: 'bonus',      order: 16 },
    { id: 'f17', label: '其他补贴',   type: 'manual', source: null, dataType: 'money',  group: 'bonus',    order: 17 },
    // 扣款
    { id: 'f18', label: '请假扣款',   type: 'auto',  source: 'leaveDeductionTotal',  group: 'deduction',  order: 18 },
    // 汇总
    { id: 'f19', label: '应付工资',   type: 'auto',  source: 'grossPay',            group: 'summary',    order: 19, highlight: true },
    { id: 'f20', label: '社保个人缴纳',type: 'auto',  source: 'socialInsurance',     group: 'summary',    order: 20 },
    { id: 'f21', label: '个人所得税',  type: 'auto',  source: 'incomeTax',           group: 'summary',    order: 21 },
    { id: 'f22', label: '借款',        type: 'auto',  source: 'loan',                group: 'summary',    order: 22 },
    { id: 'f23', label: '实发工资',    type: 'auto',  source: 'actualPay',           group: 'summary',    order: 23, highlight: true }
  ]
}

// ========== 分组定义 ==========

const DEFAULT_GROUPS = [
  { key: 'attendance', label: '考勤',     order: 1 },
  { key: 'salary',     label: '薪资',     order: 2 },
  { key: 'overtime',   label: '加班',     order: 3 },
  { key: 'bonus',      label: '补贴与奖金', order: 4 },
  { key: 'deduction',  label: '扣款',     order: 5 },
  { key: 'summary',    label: '汇总',     order: 6 }
]

/**
 * 生成唯一字段ID
 */
function generateFieldId() {
  return 'cf_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5)
}

/**
 * 获取自动计算字段可选列表（用于管理员添加字段时选择）
 */
function getAvailableAutoSources(usedSources) {
  const used = new Set(usedSources || [])
  return Object.entries(AUTO_FIELD_SOURCES)
    .filter(([key]) => !used.has(key))
    .map(([key, val]) => ({
      source: key,
      desc: val.desc,
      dataType: val.dataType
    }))
}

/**
 * 根据字段模板和工资数据，构建动态工资条行
 * @param {Array} template - 工资条字段模板
 * @param {object} salaryData - 格式化后的工资数据（已转为元）
 * @param {object} manualData - 手动填写的数据 { fieldId: value }
 * @returns {Array} 工资条行数组
 */
function buildSalaryRows(template, salaryData, manualData) {
  const rows = []
  const sorted = [...template].sort((a, b) => a.order - b.order)
  let currentGroup = ''

  for (const field of sorted) {
    // 分组标题
    if (field.group !== currentGroup) {
      currentGroup = field.group
      const groupDef = DEFAULT_GROUPS.find(g => g.key === currentGroup)
      rows.push({
        isGroupTitle: true,
        groupLabel: groupDef ? groupDef.label : currentGroup,
        groupKey: currentGroup
      })
    }

    let displayValue = ''
    let valueClass = ''

    if (field.type === 'auto' && field.source) {
      // 自动计算字段
      const rawValue = salaryData[field.source]
      const sourceDef = AUTO_FIELD_SOURCES[field.source]
      const dataType = sourceDef ? sourceDef.dataType : (field.dataType || 'money')

      if (dataType === 'money') {
        displayValue = `¥${rawValue || '0.00'}`
        const num = parseFloat(rawValue) || 0
        // 扣款项显示红色
        if (['personalLeaveDeduction', 'absentDeduction', 'leaveDeductionTotal',
             'socialInsurance', 'incomeTax', 'loan'].includes(field.source) && num > 0) {
          valueClass = 'text-danger'
        }
      } else {
        displayValue = rawValue !== undefined ? `${rawValue}` : '0'
      }
    } else {
      // 手动填写字段
      const value = (manualData && manualData[field.id]) || '0.00'
      if (field.dataType === 'money') {
        displayValue = `¥${value}`
      } else if (field.dataType === 'number') {
        displayValue = `${value}`
      } else {
        displayValue = `${value}`
      }
    }

    rows.push({
      isGroupTitle: false,
      id: field.id,
      label: field.label,
      value: displayValue,
      valueClass,
      highlight: field.highlight || false,
      group: field.group,
      type: field.type
    })
  }

  return rows
}

/**
 * 格式化工资数据（分 → 元）
 */
function formatSalaryToYuan(data, fenToYuan) {
  const moneyKeys = [
    'baseSalary', 'hourlyRate', 'dailyRate', 'positionAllowance', 'businessCommission',
    'salaryTotal', 'weekdayOvertimePay', 'weekdayOvertimeRate', 'holidayOvertimePay',
    'holidayOvertimeRate', 'overtimePay', 'overtimeMealSubsidy', 'laborProtectionSubsidy',
    'bonusAmount', 'seniorityPay', 'otherSubsidy', 'personalLeaveDeduction',
    'absentDeduction', 'leaveDeductionTotal', 'grossPay', 'socialInsurance',
    'taxableIncome', 'incomeTax', 'loan', 'actualPay'
  ]
  const result = {}
  for (const key of Object.keys(data)) {
    if (moneyKeys.includes(key) && typeof data[key] === 'number') {
      result[key] = fenToYuan(data[key])
    } else {
      result[key] = data[key]
    }
  }
  return result
}

module.exports = {
  AUTO_FIELD_SOURCES,
  DEFAULT_GROUPS,
  getDefaultTemplate,
  generateFieldId,
  getAvailableAutoSources,
  buildSalaryRows,
  formatSalaryToYuan
}
