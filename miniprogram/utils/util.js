/**
 * 工具函数库
 */

/**
 * 生成唯一邀请码（6位大写字母+数字）
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去除易混淆字符
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * 金额：分 → 元
 */
function fenToYuan(fen) {
  return (fen / 100).toFixed(2)
}

/**
 * 金额：元 → 分
 */
function yuanToFen(yuan) {
  return Math.round(parseFloat(yuan) * 100)
}

/**
 * 格式化时间
 */
function formatTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
  if (typeof date === 'string') {
    date = new Date(date)
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second)
}

/**
 * 获取今日日期字符串
 */
function getToday() {
  return formatTime(new Date(), 'YYYY-MM-DD')
}

/**
 * 计算两个时间之间的小时数
 */
function hoursBetween(startTime, endTime) {
  const start = new Date(startTime)
  const end = new Date(endTime)
  return (end - start) / (1000 * 60 * 60)
}

/**
 * 计算时间差（分钟）
 */
function minutesBetween(startTime, endTime) {
  const start = new Date(startTime)
  const end = new Date(endTime)
  return (end - start) / (1000 * 60)
}

/**
 * 获取某月天数
 */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

/**
 * 获取某天是星期几（0=周日, 1=周一, ..., 6=周六）
 */
function getDayOfWeek(dateStr) {
  return new Date(dateStr).getDay()
}

/**
 * 判断是否为工作日（周一至周六）
 */
function isWorkday(dateStr) {
  const day = getDayOfWeek(dateStr)
  return day >= 1 && day <= 6
}

/**
 * 判断是否为周日
 */
function isSunday(dateStr) {
  return getDayOfWeek(dateStr) === 0
}

/**
 * 获取设备信息
 */
function getDeviceInfo() {
  try {
    const deviceInfo = wx.getDeviceInfo()
    const windowInfo = wx.getWindowInfo()
    return {
      brand: deviceInfo.brand,
      model: deviceInfo.model,
      system: deviceInfo.system,
      platform: deviceInfo.platform,
      SDKVersion: windowInfo.SDKVersion || ''
    }
  } catch (e) {
    // 兼容旧版基础库
    try {
      const systemInfo = wx.getSystemInfoSync()
      return {
        brand: systemInfo.brand,
        model: systemInfo.model,
        system: systemInfo.system,
        platform: systemInfo.platform,
        SDKVersion: systemInfo.SDKVersion
      }
    } catch (e2) {
      return {
        brand: '',
        model: '',
        system: '',
        platform: '',
        SDKVersion: ''
      }
    }
  }
}

/**
 * 防抖
 */
function debounce(fn, delay = 500) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

/**
 * 节流
 */
function throttle(fn, interval = 500) {
  let lastTime = 0
  return function (...args) {
    const now = Date.now()
    if (now - lastTime >= interval) {
      lastTime = now
      fn.apply(this, args)
    }
  }
}

/**
 * 显示 Toast
 */
function showToast(title, icon = 'none', duration = 2000) {
  wx.showToast({ title, icon, duration })
}

/**
 * 显示 Loading
 */
function showLoading(title = '加载中...') {
  wx.showLoading({ title, mask: true })
}

/**
 * 隐藏 Loading
 */
function hideLoading() {
  wx.hideLoading()
}

/**
 * 计算两点间距离（米）
 */
function getDistance(lat1, lng1, lat2, lng2) {
  const radLat1 = lat1 * Math.PI / 180
  const radLat2 = lat2 * Math.PI / 180
  const a = radLat1 - radLat2
  const b = lng1 * Math.PI / 180 - lng2 * Math.PI / 180
  let distance = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin(a / 2), 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(b / 2), 2)
  ))
  distance = distance * 6378137 // 地球半径(米)
  return Math.round(distance)
}

/**
 * 深拷贝
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

module.exports = {
  generateInviteCode,
  fenToYuan,
  yuanToFen,
  formatTime,
  getToday,
  hoursBetween,
  minutesBetween,
  getDaysInMonth,
  getDayOfWeek,
  isWorkday,
  isSunday,
  getDeviceInfo,
  debounce,
  throttle,
  showToast,
  showLoading,
  hideLoading,
  getDistance,
  deepClone
}
