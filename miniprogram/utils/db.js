/**
 * 云开发数据库操作封装
 * 统一处理多租户 companyId 隔离
 */

const app = getApp()

class DB {
  constructor() {
    this.db = wx.cloud.database()
  }

  /**
   * 获取当前公司 ID
   */
  getCompanyId() {
    return app.globalData.companyId
  }

  /**
   * 获取当前用户 openid
   */
  async getOpenId() {
    return await app.getOpenId()
  }

  // ========== 公司相关 ==========

  /**
   * 创建公司
   */
  async createCompany(data) {
    return await this.db.collection('companies').add({
      data: {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })
  }

  /**
   * 通过邀请码查找公司
   */
  async getCompanyByInviteCode(code) {
    const res = await this.db.collection('companies')
      .where({ inviteCode: code })
      .get()
    return res.data.length > 0 ? res.data[0] : null
  }

  /**
   * 获取公司信息
   */
  async getCompany(companyId) {
    const res = await this.db.collection('companies')
      .doc(companyId || this.getCompanyId())
      .get()
    return res.data
  }

  /**
   * 更新公司信息
   */
  async updateCompany(data) {
    return await this.db.collection('companies')
      .doc(this.getCompanyId())
      .update({
        data: {
          ...data,
          updatedAt: new Date().toISOString()
        }
      })
  }

  // ========== 员工相关 ==========

  /**
   * 添加员工
   */
  async addEmployee(data) {
    return await this.db.collection('employees').add({
      data: {
        ...data,
        companyId: this.getCompanyId(),
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })
  }

  /**
   * 通过 openid 查找员工（可能属于多个公司）
   */
  async getEmployeesByOpenid(openid) {
    const res = await this.db.collection('employees')
      .where({ openid, status: 'active' })
      .get()
    return res.data
  }

  /**
   * 获取当前公司的所有员工
   */
  async getCompanyEmployees() {
    const res = await this.db.collection('employees')
      .where({
        companyId: this.getCompanyId(),
        status: 'active'
      })
      .orderBy('joinedAt', 'desc')
      .get()
    return res.data
  }

  /**
   * 获取当前员工信息
   */
  async getCurrentEmployee() {
    const openid = await this.getOpenId()
    const res = await this.db.collection('employees')
      .where({
        companyId: this.getCompanyId(),
        openid,
        status: 'active'
      })
      .get()
    return res.data.length > 0 ? res.data[0] : null
  }

  /**
   * 更新员工信息
   */
  async updateEmployee(employeeId, data) {
    return await this.db.collection('employees')
      .doc(employeeId)
      .update({
        data: {
          ...data,
          updatedAt: new Date().toISOString()
        }
      })
  }

  /**
   * 删除员工（软删除）
   */
  async deleteEmployee(employeeId) {
    return await this.db.collection('employees')
      .doc(employeeId)
      .update({
        data: {
          status: 'inactive',
          updatedAt: new Date().toISOString()
        }
      })
  }

  // ========== 打卡记录相关 ==========

  /**
   * 获取某天的打卡记录
   */
  async getCheckinRecord(employeeId, date) {
    const res = await this.db.collection('checkinRecords')
      .where({
        companyId: this.getCompanyId(),
        employeeId,
        date
      })
      .get()
    return res.data.length > 0 ? res.data[0] : null
  }

  /**
   * 创建打卡记录
   */
  async createCheckinRecord(data) {
    return await this.db.collection('checkinRecords').add({
      data: {
        ...data,
        companyId: this.getCompanyId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })
  }

  /**
   * 更新打卡记录
   */
  async updateCheckinRecord(recordId, data) {
    return await this.db.collection('checkinRecords')
      .doc(recordId)
      .update({
        data: {
          ...data,
          updatedAt: new Date().toISOString()
        }
      })
  }

  /**
   * 获取某月所有打卡记录
   */
  async getMonthCheckinRecords(employeeId, year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`

    const res = await this.db.collection('checkinRecords')
      .where({
        companyId: this.getCompanyId(),
        employeeId,
        date: this.db.command.gte(startDate).and(this.db.command.lte(endDate))
      })
      .orderBy('date', 'asc')
      .get()
    return res.data
  }

  /**
   * 获取公司某天所有打卡记录（管理员）
   */
  async getCompanyDayCheckinRecords(date) {
    const res = await this.db.collection('checkinRecords')
      .where({
        companyId: this.getCompanyId(),
        date
      })
      .get()
    return res.data
  }

  // ========== 工资配置相关 ==========

  /**
   * 获取工资配置
   */
  async getSalaryConfig() {
    const res = await this.db.collection('salaryConfig')
      .where({ companyId: this.getCompanyId() })
      .get()
    return res.data.length > 0 ? res.data[0] : null
  }

  /**
   * 创建工资配置
   */
  async createSalaryConfig(data) {
    return await this.db.collection('salaryConfig').add({
      data: {
        ...data,
        companyId: this.getCompanyId(),
        createdBy: app.globalData.currentEmployeeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })
  }

  /**
   * 更新工资配置
   */
  async updateSalaryConfig(configId, data) {
    return await this.db.collection('salaryConfig')
      .doc(configId)
      .update({
        data: {
          ...data,
          updatedAt: new Date().toISOString()
        }
      })
  }

  // ========== 工资记录相关 ==========

  /**
   * 获取某月工资记录
   */
  async getSalaryRecord(employeeId, year, month) {
    const res = await this.db.collection('salaryRecords')
      .where({
        companyId: this.getCompanyId(),
        employeeId,
        year,
        month
      })
      .get()
    return res.data.length > 0 ? res.data[0] : null
  }

  /**
   * 创建工资记录
   */
  async createSalaryRecord(data) {
    return await this.db.collection('salaryRecords').add({
      data: {
        ...data,
        companyId: this.getCompanyId(),
        createdAt: new Date().toISOString()
      }
    })
  }

  // ========== 操作日志相关 ==========

  /**
   * 记录操作日志
   */
  async addOperationLog(action, target, detail) {
    const employee = app.globalData.currentEmployee
    return await this.db.collection('operationLogs').add({
      data: {
        companyId: this.getCompanyId(),
        operatorId: employee._id,
        operatorName: employee.name,
        action,
        target: target || '',
        detail: detail || '',
        createdAt: new Date().toISOString()
      }
    })
  }

  /**
   * 获取操作日志
   */
  async getOperationLogs(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize
    const res = await this.db.collection('operationLogs')
      .where({ companyId: this.getCompanyId() })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    return res.data
  }
}

module.exports = new DB()
