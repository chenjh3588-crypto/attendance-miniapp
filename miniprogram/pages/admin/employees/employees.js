// pages/admin/employees/employees.js
// 员工管理页面
const app = getApp()
const db = require('../../utils/db')
const { fenToYuan, yuanToFen } = require('../../../utils/util')

Page({
  data: {
    employees: [],
    loading: true,
    isAdmin: false,
    departments: [],

    // 编辑弹窗
    showEditModal: false,
    editingEmployee: null,
    editForm: {
      name: '',
      phone: '',
      type: 'fulltime',
      monthlySalary: '',
      department: '',
      positionAllowance: '',
      businessCommission: '',
      laborProtectionSubsidy: '',
      loan: '',
      role: 'employee'
    },

    // 新增弹窗
    showAddModal: false,
    addForm: {
      name: '',
      phone: '',
      type: 'fulltime',
      monthlySalary: '',
      department: '',
      positionAllowance: '',
      businessCommission: '',
      laborProtectionSubsidy: '',
      loan: '',
      role: 'employee'
    }
  },

  onLoad() {
    this.checkAdmin()
  },

  onShow() {
    if (this.data.isAdmin) {
      this.loadEmployees()
    }
  },

  checkAdmin() {
    const isAdmin = app.globalData.isAdmin
    if (!isAdmin) {
      wx.showModal({
        title: '无权限',
        content: '仅管理员可访问此页面',
        showCancel: false,
        success: () => { wx.switchTab({ url: '/pages/checkin/checkin' }) }
      })
      return
    }
    this.setData({ isAdmin: true })
    this.loadEmployees()
    this.loadDepartments()
  },

  async loadDepartments() {
    const company = app.globalData.currentCompany
    if (company && company.departments) {
      this.setData({ departments: company.departments })
    }
  },

  async loadEmployees() {
    try {
      const employees = await db.getCompanyEmployees()
      this.setData({
        employees: employees.map(e => ({
          ...e,
          salaryYuan: fenToYuan(e.monthlySalary),
          positionAllowanceYuan: fenToYuan(e.positionAllowance || 0),
          businessCommissionYuan: fenToYuan(e.businessCommission || 0),
          typeLabel: e.type === 'fulltime' ? '正式' : '实习',
          roleLabel: e.role === 'admin' ? '管理员' : '员工',
          departmentLabel: e.department || '未分配'
        })),
        loading: false
      })
    } catch (err) {
      console.error('加载员工列表失败:', err)
      this.setData({ loading: false })
    }
  },

  onShowAddModal() {
    this.setData({
      showAddModal: true,
      addForm: {
        name: '', phone: '', type: 'fulltime', monthlySalary: '',
        department: '', positionAllowance: '', businessCommission: '',
        laborProtectionSubsidy: '', loan: '', role: 'employee'
      }
    })
  },

  onHideAddModal() { this.setData({ showAddModal: false }) },

  onAddFormInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`addForm.${field}`]: e.detail.value })
  },

  onAddDepartmentChange(e) {
    this.setData({ 'addForm.department': this.data.departments[e.detail.value] || '' })
  },

  async onSubmitAdd() {
    const { name, phone, type, monthlySalary, department, positionAllowance, businessCommission, laborProtectionSubsidy, loan, role } = this.data.addForm
    if (!name.trim()) { wx.showToast({ title: '请输入姓名', icon: 'none' }); return }

    try {
      await db.addEmployee({
        openid: 'pending_' + Date.now(),
        name: name.trim(),
        phone: phone.trim(),
        role,
        type,
        monthlySalary: yuanToFen(monthlySalary),
        department: department || '',
        positionAllowance: yuanToFen(positionAllowance),
        businessCommission: yuanToFen(businessCommission),
        laborProtectionSubsidy: yuanToFen(laborProtectionSubsidy),
        loan: yuanToFen(loan),
        customWorkTime: null,
        joinedAt: new Date().toISOString()
      })

      await db.addOperationLog('add_employee', name.trim(), `添加员工：${name.trim()}`)
      wx.showToast({ title: '添加成功', icon: 'success' })
      this.onHideAddModal()
      this.loadEmployees()
    } catch (err) {
      console.error('添加员工失败:', err)
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  },

  onShowEditModal(e) {
    const employee = e.currentTarget.dataset.employee
    this.setData({
      showEditModal: true,
      editingEmployee: employee,
      editForm: {
        name: employee.name,
        phone: employee.phone || '',
        type: employee.type,
        monthlySalary: employee.salaryYuan,
        department: employee.department || '',
        positionAllowance: employee.positionAllowanceYuan || '',
        businessCommission: employee.businessCommissionYuan || '',
        laborProtectionSubsidy: fenToYuan(employee.laborProtectionSubsidy || 0),
        loan: fenToYuan(employee.loan || 0),
        role: employee.role
      }
    })
  },

  onHideEditModal() { this.setData({ showEditModal: false, editingEmployee: null }) },

  onEditFormInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`editForm.${field}`]: e.detail.value })
  },

  onEditDepartmentChange(e) {
    this.setData({ 'editForm.department': this.data.departments[e.detail.value] || '' })
  },

  async onSubmitEdit() {
    const { editingEmployee, editForm } = this.data
    if (!editForm.name.trim()) { wx.showToast({ title: '请输入姓名', icon: 'none' }); return }

    try {
      await db.updateEmployee(editingEmployee._id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        type: editForm.type,
        monthlySalary: yuanToFen(editForm.monthlySalary),
        department: editForm.department || '',
        positionAllowance: yuanToFen(editForm.positionAllowance),
        businessCommission: yuanToFen(editForm.businessCommission),
        laborProtectionSubsidy: yuanToFen(editForm.laborProtectionSubsidy),
        loan: yuanToFen(editForm.loan),
        role: editForm.role
      })

      await db.addOperationLog('edit_employee', editingEmployee.name, `编辑员工：${editingEmployee.name}`)
      wx.showToast({ title: '保存成功', icon: 'success' })
      this.onHideEditModal()
      this.loadEmployees()
    } catch (err) {
      console.error('编辑员工失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  onDeleteEmployee(e) {
    const employee = e.currentTarget.dataset.employee
    wx.showModal({
      title: '确认删除',
      content: `确定要删除员工「${employee.name}」吗？`,
      dangerColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          try {
            await db.deleteEmployee(employee._id)
            await db.addOperationLog('delete_employee', employee.name, `删除员工：${employee.name}`)
            wx.showToast({ title: '删除成功', icon: 'success' })
            this.loadEmployees()
          } catch (err) {
            console.error('删除员工失败:', err)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
})
