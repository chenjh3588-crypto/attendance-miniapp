// pages/company/company.js
// 公司选择页面（多公司切换）
const app = getApp()

Page({
  data: {
    companies: [],
    loading: true
  },

  onLoad: function() {
    this.loadCompanies()
  },

  async loadCompanies() {
    try {
      const openid = await app.getOpenId()
      const db = wx.cloud.database()

      // 查找用户加入的所有公司
      const empRes = await db.collection('employees')
        .where({ openid, status: 'active' })
        .get()

      if (empRes.data.length === 0) {
        wx.redirectTo({ url: '/pages/guild/guild' })
        return
      }

      // 获取公司信息
      const companies = []
      for (const emp of empRes.data) {
        try {
          const companyRes = await db.collection('companies').doc(emp.companyId).get()
          companies.push({
            ...companyRes.data,
            employeeRole: emp.role,
            employeeId: emp._id
          })
        } catch (err) {
          console.error('获取公司信息失败:', err)
        }
      }

      this.setData({ companies, loading: false })
    } catch (err) {
      console.error('加载公司列表失败:', err)
      this.setData({ loading: false })
    }
  },

  // 选择公司
  async onSelectCompany(e) {
    const company = e.currentTarget.dataset.company

    const db = wx.cloud.database()
    const openid = await app.getOpenId()
    const empRes = await db.collection('employees')
      .where({ companyId: company._id, openid, status: 'active' })
      .get()

    if (empRes.data.length > 0) {
      app.setCurrentCompany(company)
      app.setCurrentEmployee(empRes.data[0])
      wx.switchTab({ url: '/pages/checkin/checkin' })
    }
  },

  // 创建新公司
  onCreateCompany: function() {
    wx.redirectTo({ url: '/pages/guild/guild' })
  }
})
