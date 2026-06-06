// 云函数：checkin-sync - 同步离线打卡记录
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { records } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!records || !records.length) {
    return { success: false, message: '无记录需要同步' }
  }

  const results = []

  for (const record of records) {
    try {
      // 检查是否已存在该日期的打卡记录
      const existing = await db.collection('checkinRecords')
        .where({
          companyId: record.companyId,
          employeeId: record.employeeId,
          date: record.date
        })
        .get()

      if (existing.data.length > 0) {
        // 更新已有记录
        const updateData = {}
        if (record.checkInTime && !existing.data[0].checkInTime) {
          updateData.checkInTime = record.checkInTime
          updateData.checkInLocation = record.checkInLocation
          updateData.checkInWifi = record.checkInWifi
          updateData.checkInDevice = record.checkInDevice
        }
        if (record.checkOutTime && !existing.data[0].checkOutTime) {
          updateData.checkOutTime = record.checkOutTime
          updateData.checkOutLocation = record.checkOutLocation
          updateData.checkOutWifi = record.checkOutWifi
          updateData.checkOutDevice = record.checkOutDevice
        }

        if (Object.keys(updateData).length > 0) {
          updateData.isOffline = true
          updateData.updatedAt = new Date().toISOString()
          await db.collection('checkinRecords')
            .doc(existing.data[0]._id)
            .update({ data: updateData })
        }
      } else {
        // 创建新记录
        await db.collection('checkinRecords').add({
          data: {
            ...record,
            isOffline: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        })
      }

      results.push({ offlineId: record.offlineId, success: true })
    } catch (err) {
      results.push({ offlineId: record.offlineId, success: false, error: err.message })
    }
  }

  return { success: true, results }
}
