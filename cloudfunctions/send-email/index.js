// 云函数：send-email - 发送工资报表邮件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/**
 * 发送邮件（使用云开发 HTTP 触发器 + 第三方邮件服务）
 * 实际生产环境中，建议使用：
 * 1. 腾讯云 SES（Simple Email Service）
 * 2. SendGrid
 * 3. 阿里云邮件推送
 *
 * 此处提供基本框架，需根据实际邮件服务配置
 */

exports.main = async (event, context) => {
  const { companyId, year, month, email } = event

  if (!companyId || !year || !month || !email) {
    return { success: false, message: '缺少必要参数' }
  }

  try {
    // 获取公司信息
    const companyRes = await db.collection('companies').doc(companyId).get()
    const company = companyRes.data

    // 获取工资记录
    const salaryRes = await db.collection('salaryRecords')
      .where({ companyId, year, month })
      .get()
    const records = salaryRes.data

    if (!records.length) {
      return { success: false, message: '无工资记录' }
    }

    // 获取员工信息
    const employeeIds = records.map(r => r.employeeId)
    const employeesRes = await db.collection('employees')
      .where({ _id: db.command.in(employeeIds) })
      .get()
    const employeeMap = {}
    employeesRes.data.forEach(e => { employeeMap[e._id] = e })

    // 构建报表内容
    let htmlContent = `
      <html>
      <head><style>
        body { font-family: -apple-system, sans-serif; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 14px; }
        th { background: #4A90D9; color: white; }
        tr:nth-child(even) { background: #f9f9f9; }
        .total { font-weight: bold; color: #4A90D9; }
        h1 { color: #333; }
        .company-name { color: #4A90D9; }
      </style></head>
      <body>
        <h1><span class="company-name">${company.name}</span> 工资报表</h1>
        <p>${year}年${month}月</p>
        <table>
          <tr>
            <th>姓名</th>
            <th>类型</th>
            <th>月薪(元)</th>
            <th>普通工资(元)</th>
            <th>加班工资(元)</th>
            <th>餐补(元)</th>
            <th>罚款(元)</th>
            <th>实发(元)</th>
          </tr>
    `

    let totalActualPay = 0
    for (const record of records) {
      const employee = employeeMap[record.employeeId] || {}
      const actualYuan = (record.actualPay / 100).toFixed(2)
      totalActualPay += record.actualPay

      htmlContent += `
        <tr>
          <td>${employee.name || '未知'}</td>
          <td>${employee.type === 'intern' ? '实习' : '正式'}</td>
          <td>${(record.monthlySalary / 100).toFixed(2)}</td>
          <td>${(record.normalPay / 100).toFixed(2)}</td>
          <td>${(record.overtimePay / 100).toFixed(2)}</td>
          <td>${(record.mealSubsidy / 100).toFixed(2)}</td>
          <td>${(record.penaltyTotal / 100).toFixed(2)}</td>
          <td class="total">${actualYuan}</td>
        </tr>
      `
    }

    htmlContent += `
        <tr>
          <td colspan="7" style="text-align: right; font-weight: bold;">合计</td>
          <td class="total">${(totalActualPay / 100).toFixed(2)}</td>
        </tr>
        </table>
        <p style="color: #999; font-size: 12px; margin-top: 20px;">
          本报表由考勤打卡系统自动生成，生成时间：${new Date().toLocaleString('zh-CN')}
        </p>
      </body></html>
    `

    // TODO: 实际发送邮件（需配置邮件服务）
    // 示例：使用腾讯云 SES
    // const ses = require('tencentcloud-sdk-nodejs-ses')
    // ... 发送邮件逻辑

    console.log('工资报表已生成，待发送至:', email)
    console.log('报表内容长度:', htmlContent.length)

    // 记录操作日志
    await db.collection('operationLogs').add({
      data: {
        companyId,
        operatorId: 'system',
        operatorName: '系统',
        action: 'generate_salary',
        target: `${year}年${month}月工资报表`,
        detail: `已发送至 ${email}`,
        createdAt: new Date().toISOString()
      }
    })

    return {
      success: true,
      message: '工资报表已生成',
      recordCount: records.length,
      totalAmount: totalActualPay
    }
  } catch (err) {
    console.error('发送工资邮件失败:', err)
    return { success: false, message: err.message }
  }
}
