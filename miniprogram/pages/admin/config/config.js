// pages/admin/config/config.js
// 配置中心 - 工作时间、加班费率、餐补规则、罚款规则、社保、个税、工资条个性化
const app = getApp()
const db = require('../../utils/db')
const { fenToYuan, yuanToFen } = require('../../../utils/util')
const { getDefaultTemplate, generateFieldId, getAvailableAutoSources, DEFAULT_GROUPS } = require('../../../utils/salary-fields')

Page({
  data: {
    isAdmin: false,
    loading: true,
    configId: '',

    // 配置表单
    form: {
      standardWorkStart: '09:00',
      standardWorkEnd: '18:00',
      monthlyWorkHours: 174,
      monthlyWorkDays: 21.75,
      // 加班费率
      overtimeRateFulltime: 26,
      overtimeRateIntern: 18,
      weekdayOvertimeRateFulltime: 26,
      weekdayOvertimeRateIntern: 18,
      holidayOvertimeRateFulltime: 39,
      holidayOvertimeRateIntern: 27,
      // 餐补规则
      mealSubsidyRules: {
        weekdayAmount: 15,
        weekendFullAmount: 30,
        weekendHalfAmount: 15,
        weekdayThreshold: 2,
        weekendFullThreshold: 8,
        weekendHalfThreshold: 4
      },
      // 工龄工资
      seniorityRules: {
        baseAmount: 50,
        perYear: 100
      },
      // 社保个税
      socialInsurancePersonal: 1050,
      taxThreshold: 5000,
      specialDeduction: 0,
      // 请假扣款
      leaveRules: {
        personalLeaveRate: 1,
        absentRate: 1
      },
      penaltyRules: []
    },

    // 公司配置
    companyConfig: {
      wifiWhitelist: [],
      workLocation: null
    },

    // 部门列表
    departments: [],

    // Wi-Fi 输入
    newWifi: '',
    // 邀请码
    inviteCode: '',

    // 自定义罚款
    newPenaltyName: '',
    newPenaltyMode: 'fixed',
    newPenaltyRate: '',

    // 新部门
    newDepartment: '',

    // 折叠状态
    expandedSections: {
      workTime: true,
      overtime: false,
      meal: false,
      seniority: false,
      socialTax: false,
      leave: false,
      penalty: false,
      salaryFields: false
    },

    // 工资条字段模板
    salaryTemplate: [],
    // 添加字段弹窗
    showAddFieldModal: false,
    addFieldForm: {
      label: '',
      type: 'manual',   // auto / manual
      source: '',
      dataType: 'money', // money / number / text
      group: 'bonus'
    },
    availableAutoSources: [],
    // 编辑字段弹窗
    showEditFieldModal: false,
    editFieldForm: {
      id: '',
      label: '',
      group: ''
    },
  },

  onLoad() {
    this.checkAdmin()
  },

  checkAdmin() {
    if (!app.globalData.isAdmin) {
      wx.showModal({
        title: '无权限',
        content: '仅管理员可访问此页面',
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/checkin/checkin' })
      })
      return
    }
    this.setData({ isAdmin: true })
    this.loadConfig()
  },

  async loadConfig() {
    try {
      const config = await db.getSalaryConfig()
      const company = app.globalData.currentCompany

      if (config) {
        this.setData({
          configId: config._id,
          form: {
            standardWorkStart: config.standardWorkStart,
            standardWorkEnd: config.standardWorkEnd,
            monthlyWorkHours: config.monthlyWorkHours,
            monthlyWorkDays: config.monthlyWorkDays || 21.75,
            overtimeRateFulltime: fenToYuan(config.overtimeRateFulltime),
            overtimeRateIntern: fenToYuan(config.overtimeRateIntern),
            weekdayOvertimeRateFulltime: fenToYuan(config.weekdayOvertimeRateFulltime || config.overtimeRateFulltime),
            weekdayOvertimeRateIntern: fenToYuan(config.weekdayOvertimeRateIntern || config.overtimeRateIntern),
            holidayOvertimeRateFulltime: fenToYuan(config.holidayOvertimeRateFulltime || 3900),
            holidayOvertimeRateIntern: fenToYuan(config.holidayOvertimeRateIntern || 2700),
            mealSubsidyRules: {
              weekdayAmount: fenToYuan(config.mealSubsidyRules.weekdayAmount),
              weekendFullAmount: fenToYuan(config.mealSubsidyRules.weekendFullAmount),
              weekendHalfAmount: fenToYuan(config.mealSubsidyRules.weekendHalfAmount),
              weekdayThreshold: config.mealSubsidyRules.weekdayThreshold,
              weekendFullThreshold: config.mealSubsidyRules.weekendFullThreshold,
              weekendHalfThreshold: config.mealSubsidyRules.weekendHalfThreshold
            },
            seniorityRules: {
              baseAmount: fenToYuan((config.seniorityRules && config.seniorityRules.baseAmount) || 5000),
              perYear: fenToYuan((config.seniorityRules && config.seniorityRules.perYear) || 10000)
            },
            socialInsurancePersonal: fenToYuan(config.socialInsurancePersonal || 105000),
            taxThreshold: fenToYuan(config.taxThreshold || 500000),
            specialDeduction: fenToYuan(config.specialDeduction || 0),
            leaveRules: config.leaveRules || { personalLeaveRate: 1, absentRate: 1 },
            penaltyRules: (config.penaltyRules || []).map(r => ({
              ...r,
              rate: r.mode === 'fixed' ? fenToYuan(r.rate) : r.rate
            }))
          },
          companyConfig: {
            wifiWhitelist: company.wifiWhitelist || [],
            workLocation: company.workLocation || null
          },
          departments: company.departments || [],
          inviteCode: company.inviteCode || ''
        })

        // 加载工资条字段模板
        const salaryTemplate = config.salaryTemplate && config.salaryTemplate.length
          ? config.salaryTemplate
          : getDefaultTemplate()
        this.setData({ salaryTemplate })
      }

      this.setData({ loading: false })
    } catch (err) {
      console.error('加载配置失败:', err)
      this.setData({ loading: false })
    }
  },

  // 折叠/展开
  onToggleSection(e) {
    const section = e.currentTarget.dataset.section
    this.setData({
      [`expandedSections.${section}`]: !this.data.expandedSections[section]
    })
  },

  // 表单输入处理
  onFormInput(e) {
    const field = e.currentTarget.dataset.field
    let value = e.detail.value
    if (['monthlyWorkHours', 'monthlyWorkDays'].includes(field)) value = Number(value)
    this.setData({ [`form.${field}`]: value })
  },

  onMealRuleInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.mealSubsidyRules.${field}`]: Number(e.detail.value) })
  },

  onSeniorityInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.seniorityRules.${field}`]: Number(e.detail.value) })
  },

  onLeaveRuleInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.leaveRules.${field}`]: Number(e.detail.value) })
  },

  // 部门管理
  onDepartmentInput(e) {
    this.setData({ newDepartment: e.detail.value })
  },

  onAddDepartment() {
    const dept = this.data.newDepartment.trim()
    if (!dept) return
    if (this.data.departments.includes(dept)) {
      wx.showToast({ title: '部门已存在', icon: 'none' })
      return
    }
    const departments = [...this.data.departments, dept]
    this.setData({ departments, newDepartment: '' })
  },

  onRemoveDepartment(e) {
    const index = e.currentTarget.dataset.index
    const departments = [...this.data.departments]
    departments.splice(index, 1)
    this.setData({ departments })
  },

  // Wi-Fi 管理
  onWifiInput(e) { this.setData({ newWifi: e.detail.value }) },
  onAddWifi() {
    const wifi = this.data.newWifi.trim()
    if (!wifi) return
    this.setData({
      'companyConfig.wifiWhitelist': [...this.data.companyConfig.wifiWhitelist, wifi],
      newWifi: ''
    })
  },
  onRemoveWifi(e) {
    const whitelist = [...this.data.companyConfig.wifiWhitelist]
    whitelist.splice(e.currentTarget.dataset.index, 1)
    this.setData({ 'companyConfig.wifiWhitelist': whitelist })
  },

  // 罚款规则管理
  onPenaltyToggle(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ [`form.penaltyRules[${index}].enabled`]: !this.data.form.penaltyRules[index].enabled })
  },
  onPenaltyRateInput(e) {
    this.setData({ [`form.penaltyRules[${e.currentTarget.dataset.index}].rate`]: Number(e.detail.value) })
  },
  onAddPenaltyRule() {
    const { newPenaltyName, newPenaltyMode, newPenaltyRate } = this.data
    if (!newPenaltyName.trim()) { wx.showToast({ title: '请输入规则名称', icon: 'none' }); return }
    this.setData({
      'form.penaltyRules': [...this.data.form.penaltyRules, {
        type: 'custom_' + Date.now(), name: newPenaltyName.trim(),
        mode: newPenaltyMode, rate: Number(newPenaltyRate), enabled: true
      }],
      newPenaltyName: '', newPenaltyRate: ''
    })
  },
  onRemovePenaltyRule(e) {
    const rules = [...this.data.form.penaltyRules]
    rules.splice(e.currentTarget.dataset.index, 1)
    this.setData({ 'form.penaltyRules': rules })
  },

  // 保存配置
  async onSaveConfig() {
    try {
      wx.showLoading({ title: '保存中...' })
      const form = this.data.form

      const configData = {
        standardWorkStart: form.standardWorkStart,
        standardWorkEnd: form.standardWorkEnd,
        monthlyWorkHours: Number(form.monthlyWorkHours),
        monthlyWorkDays: Number(form.monthlyWorkDays),
        overtimeRateFulltime: yuanToFen(form.overtimeRateFulltime),
        overtimeRateIntern: yuanToFen(form.overtimeRateIntern),
        weekdayOvertimeRateFulltime: yuanToFen(form.weekdayOvertimeRateFulltime),
        weekdayOvertimeRateIntern: yuanToFen(form.weekdayOvertimeRateIntern),
        holidayOvertimeRateFulltime: yuanToFen(form.holidayOvertimeRateFulltime),
        holidayOvertimeRateIntern: yuanToFen(form.holidayOvertimeRateIntern),
        mealSubsidyRules: {
          weekdayAmount: yuanToFen(form.mealSubsidyRules.weekdayAmount),
          weekendFullAmount: yuanToFen(form.mealSubsidyRules.weekendFullAmount),
          weekendHalfAmount: yuanToFen(form.mealSubsidyRules.weekendHalfAmount),
          weekdayThreshold: Number(form.mealSubsidyRules.weekdayThreshold),
          weekendFullThreshold: Number(form.mealSubsidyRules.weekendFullThreshold),
          weekendHalfThreshold: Number(form.mealSubsidyRules.weekendHalfThreshold)
        },
        seniorityRules: {
          baseAmount: yuanToFen(form.seniorityRules.baseAmount),
          perYear: yuanToFen(form.seniorityRules.perYear)
        },
        socialInsurancePersonal: yuanToFen(form.socialInsurancePersonal),
        taxThreshold: yuanToFen(form.taxThreshold),
        specialDeduction: yuanToFen(form.specialDeduction),
        leaveRules: form.leaveRules,
        penaltyRules: form.penaltyRules.map(r => ({
          ...r,
          rate: r.mode === 'fixed' ? yuanToFen(r.rate) : r.rate
        })),
        // 工资条字段模板
        salaryTemplate: this.data.salaryTemplate
      }

      if (this.data.configId) {
        await db.updateSalaryConfig(this.data.configId, configData)
      } else {
        await db.createSalaryConfig(configData)
      }

      // 更新公司配置
      await db.updateCompany({
        wifiWhitelist: this.data.companyConfig.wifiWhitelist,
        departments: this.data.departments
      })

      await db.addOperationLog('update_config', '工资配置', '更新工资配置')
      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('保存配置失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  onSetLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: async (res) => {
        this.setData({ 'companyConfig.workLocation': { latitude: res.latitude, longitude: res.longitude, radius: 200 } })
        await db.updateCompany({ workLocation: this.data.companyConfig.workLocation })
        wx.showToast({ title: '定位设置成功', icon: 'success' })
      },
      fail: () => { wx.showToast({ title: '获取定位失败', icon: 'none' }) }
    })
  },

  onNewPenaltyNameInput(e) { this.setData({ newPenaltyName: e.detail.value }) },
  onNewPenaltyRateInput(e) { this.setData({ newPenaltyRate: e.detail.value }) },
  onSetPenaltyMode(e) { this.setData({ newPenaltyMode: e.currentTarget.dataset.mode }) },

  // ===== 工资条字段完全自定义管理 =====

  // 添加字段
  onShowAddFieldModal() {
    const usedSources = this.data.salaryTemplate
      .filter(f => f.type === 'auto' && f.source)
      .map(f => f.source)
    const availableAutoSources = getAvailableAutoSources(usedSources)
    this.setData({
      showAddFieldModal: true,
      availableAutoSources,
      addFieldForm: { label: '', type: 'manual', source: '', dataType: 'money', group: 'bonus' }
    })
  },
  onHideAddFieldModal() { this.setData({ showAddFieldModal: false }) },
  onAddFieldFormInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`addFieldForm.${field}`]: e.detail.value })
  },
  onAddFieldTypeChange(e) {
    const type = e.currentTarget.dataset.type
    const updates = { 'addFieldForm.type': type }
    if (type === 'auto') {
      updates['addFieldForm.dataType'] = 'money' // 自动字段默认金额
    }
    this.setData(updates)
  },
  onAddFieldSourceChange(e) {
    const source = e.currentTarget.dataset.source
    const sourceDef = getAvailableAutoSources([]).find(s => s.source === source)
    this.setData({
      'addFieldForm.source': source,
      'addFieldForm.dataType': sourceDef ? sourceDef.dataType : 'money',
      'addFieldForm.label': sourceDef ? sourceDef.desc.replace(/（.*）/, '') : this.data.addFieldForm.label
    })
  },

  onSubmitAddField() {
    const form = this.data.addFieldForm
    if (!form.label.trim()) { wx.showToast({ title: '请输入字段名称', icon: 'none' }); return }
    if (form.type === 'auto' && !form.source) { wx.showToast({ title: '请选择数据来源', icon: 'none' }); return }

    const template = [...this.data.salaryTemplate]
    // 计算同组内最大 order
    const groupFields = template.filter(f => f.group === form.group)
    const maxOrder = groupFields.length > 0 ? Math.max(...groupFields.map(f => f.order)) : 0

    const newField = {
      id: generateFieldId(),
      label: form.label.trim(),
      type: form.type,
      group: form.group,
      order: maxOrder + 1,
      highlight: false
    }

    if (form.type === 'auto') {
      newField.source = form.source
    } else {
      newField.source = null
      newField.dataType = form.dataType || 'money'
    }

    template.push(newField)
    this.setData({ salaryTemplate: template, showAddFieldModal: false })
    wx.showToast({ title: '已添加', icon: 'success' })
  },

  // 编辑字段
  onShowEditFieldModal(e) {
    const id = e.currentTarget.dataset.id
    const field = this.data.salaryTemplate.find(f => f.id === id)
    if (!field) return
    this.setData({
      showEditFieldModal: true,
      editFieldForm: { id: field.id, label: field.label, group: field.group }
    })
  },
  onHideEditFieldModal() { this.setData({ showEditFieldModal: false }) },
  onEditFieldFormInput(e) {
    this.setData({ [`editFieldForm.${e.currentTarget.dataset.field}`]: e.detail.value })
  },
  onSubmitEditField() {
    const { editFieldForm, salaryTemplate } = this.data
    if (!editFieldForm.label.trim()) { wx.showToast({ title: '请输入名称', icon: 'none' }); return }
    const template = [...salaryTemplate]
    const field = template.find(f => f.id === editFieldForm.id)
    if (field) {
      field.label = editFieldForm.label.trim()
      field.group = editFieldForm.group
      this.setData({ salaryTemplate: template, showEditFieldModal: false })
      wx.showToast({ title: '已修改', icon: 'success' })
    }
  },

  // 删除字段
  onDeleteField(e) {
    const id = e.currentTarget.dataset.id
    const field = this.data.salaryTemplate.find(f => f.id === id)
    wx.showModal({
      title: '删除字段',
      content: `确定删除「${field.label}」吗？`,
      success: (res) => {
        if (res.confirm) {
          this.setData({ salaryTemplate: this.data.salaryTemplate.filter(f => f.id !== id) })
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

  // 上移
  onMoveFieldUp(e) {
    const id = e.currentTarget.dataset.id
    const template = [...this.data.salaryTemplate].sort((a, b) => a.order - b.order)
    const index = template.findIndex(f => f.id === id)
    if (index > 0 && template[index].group === template[index - 1].group) {
      const tmp = template[index].order
      template[index].order = template[index - 1].order
      template[index - 1].order = tmp
      this.setData({ salaryTemplate: template })
    }
  },

  // 下移
  onMoveFieldDown(e) {
    const id = e.currentTarget.dataset.id
    const template = [...this.data.salaryTemplate].sort((a, b) => a.order - b.order)
    const index = template.findIndex(f => f.id === id)
    if (index < template.length - 1 && template[index].group === template[index + 1].group) {
      const tmp = template[index].order
      template[index].order = template[index + 1].order
      template[index + 1].order = tmp
      this.setData({ salaryTemplate: template })
    }
  },

  // 切换高亮
  onToggleHighlight(e) {
    const id = e.currentTarget.dataset.id
    const template = [...this.data.salaryTemplate]
    const field = template.find(f => f.id === id)
    if (field) { field.highlight = !field.highlight; this.setData({ salaryTemplate: template }) }
  },

  // 恢复默认模板
  onResetTemplate() {
    wx.showModal({
      title: '恢复默认',
      content: '将恢复为默认工资条模板，所有自定义字段将丢失',
      success: (res) => {
        if (res.confirm) {
          this.setData({ salaryTemplate: getDefaultTemplate() })
          wx.showToast({ title: '已恢复默认', icon: 'success' })
        }
      }
    })
  },

  goToEmployees: function() { wx.redirectTo({ url: '/pages/admin/employees/employees' }) },
  goToAttendance: function() { wx.redirectTo({ url: '/pages/admin/attendance/attendance' }) },
  goToLogs: function() { wx.redirectTo({ url: '/pages/admin/logs/logs' }) }
})
