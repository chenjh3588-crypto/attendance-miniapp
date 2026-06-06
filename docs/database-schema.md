# 数据库 Schema 设计（微信云开发 CloudBase）

## 设计原则
- 所有集合通过 `companyId` 字段实现多租户数据隔离
- 金额统一使用"分"为单位存储（避免浮点误差）
- 时间字段使用 ISO 8601 格式字符串
- 使用云开发安全规则（Security Rules）进行数据访问控制

---

## 集合列表

### 1. companies（公司表）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | 自动 | 云开发自动生成 |
| name | string | 是 | 公司名称 |
| logo | string | 否 | 公司 Logo 云存储 fileID |
| inviteCode | string | 是 | 唯一邀请码（6位大写字母+数字） |
| themeColor | string | 否 | 主题色（默认 #4A90D9） |
| ownerOpenid | string | 是 | 创建者 openid |
| wifiWhitelist | array | 否 | Wi-Fi SSID 白名单 ["Office-WiFi"] |
| ipRange | object | 否 | IP 地址范围 { start: "192.168.1.1", end: "192.168.1.255" } |
| workLocation | object | 否 | 公司定位 { latitude, longitude, radius(米) } |
| departments | array | 否 | 部门列表 ["技术部", "销售部"] |
| createdAt | string | 是 | 创建时间 |
| updatedAt | string | 是 | 更新时间 |

**索引：**
- `inviteCode`（唯一）

---

### 2. employees（员工表）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | 自动 | |
| companyId | string | 是 | 所属公司 ID |
| openid | string | 是 | 微信 openid |
| name | string | 是 | 员工姓名 |
| phone | string | 否 | 手机号 |
| avatar | string | 否 | 头像云存储 fileID |
| role | string | 是 | 角色：admin / employee |
| type | string | 是 | 员工类型：fulltime(正式) / intern(实习) |
| department | string | 否 | 部门 |
| monthlySalary | number | 是 | 基本底薪（分） |
| positionAllowance | number | 否 | 职务津贴（分）默认0 |
| businessCommission | number | 否 | 业务提成（分）默认0 |
| laborProtectionSubsidy | number | 否 | 劳保补贴（分）默认0 |
| loan | number | 否 | 借款（分）默认0 |
| status | string | 是 | 状态：active / inactive |
| customWorkTime | object | 否 | 个人自定义上下班时间（覆盖公司全局） |
| joinedAt | string | 是 | 加入时间 |
| createdAt | string | 是 | 创建时间 |
| updatedAt | string | 是 | 更新时间 |

**索引：**
- `companyId` + `openid`（唯一复合索引）
- `companyId` + `status`

---

### 3. checkinRecords（打卡记录表）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | 自动 | |
| companyId | string | 是 | 所属公司 ID |
| employeeId | string | 是 | 员工 ID |
| date | string | 是 | 日期 YYYY-MM-DD |
| checkInTime | string | 否 | 上班打卡时间 ISO 8601 |
| checkOutTime | string | 否 | 下班打卡时间 ISO 8601 |
| checkInLocation | object | 否 | 上班打卡位置 { latitude, longitude } |
| checkOutLocation | object | 否 | 下班打卡位置 { latitude, longitude } |
| checkInWifi | string | 否 | 上班打卡 Wi-Fi SSID |
| checkOutWifi | string | 否 | 下班打卡 Wi-Fi SSID |
| checkInDevice | string | 否 | 上班打卡设备信息 |
| checkOutDevice | string | 否 | 下班打卡设备信息 |
| status | string | 是 | 状态：normal / late / early / absent / overtime |
| isAbnormal | boolean | 否 | 是否异常打卡（位置不在范围内） |
| isOffline | boolean | 否 | 是否离线打卡 |
| workContent | string | 否 | 当天工作内容 |
| modifiedBy | string | 否 | 修改人 ID（管理员修改时记录） |
| modifiedAt | string | 否 | 修改时间 |
| createdAt | string | 是 | 创建时间 |
| updatedAt | string | 是 | 更新时间 |

**索引：**
- `companyId` + `employeeId` + `date`（唯一复合索引）
- `companyId` + `date`

---

### 4. salaryConfig（工资配置表）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | 自动 | |
| companyId | string | 是 | 所属公司 ID |
| standardWorkStart | string | 是 | 标准上班时间 HH:mm |
| standardWorkEnd | string | 是 | 标准下班时间 HH:mm |
| monthlyWorkHours | number | 是 | 本月应工作小时数 |
| monthlyWorkDays | number | 否 | 本月应工作天数 默认21.75 |
| overtimeRateFulltime | number | 是 | 正式员工加班费率（分/小时）默认 2600 |
| overtimeRateIntern | number | 是 | 实习员工加班费率（分/小时）默认 1800 |
| weekdayOvertimeRateFulltime | number | 否 | 平时加班费率-正式（分/小时） |
| weekdayOvertimeRateIntern | number | 否 | 平时加班费率-实习（分/小时） |
| holidayOvertimeRateFulltime | number | 否 | 假日加班费率-正式（分/小时） |
| holidayOvertimeRateIntern | number | 否 | 假日加班费率-实习（分/小时） |
| mealSubsidyRules | object | 是 | 加班餐补规则（见下方详细结构） |
| seniorityRules | object | 否 | 工龄工资规则 { baseAmount, perYear } |
| socialInsurancePersonal | number | 否 | 社保个人缴纳（分/月）默认 105000 |
| taxThreshold | number | 否 | 个税起征点（分）默认 500000 |
| specialDeduction | number | 否 | 专项附加扣除（分）默认 0 |
| leaveRules | object | 否 | 请假扣款规则 { personalLeaveRate, absentRate } |
| penaltyRules | array | 是 | 罚款规则列表 |
| salaryTemplate | array | 否 | 工资条字段自定义模板（见下方） |
| createdBy | string | 是 | 创建者 ID |
| createdAt | string | 是 | 创建时间 |
| updatedAt | string | 是 | 更新时间 |

**mealSubsidyRules 结构：**
```json
{
  "weekdayAmount": 1500,      // 工作日加班餐补（分）周一至周六超过2小时
  "weekendFullAmount": 3000,  // 周日全天加班餐补（分）
  "weekendHalfAmount": 1500,  // 周日半天加班餐补（分）
  "weekdayThreshold": 2,      // 工作日加班餐补门槛（小时）
  "weekendFullThreshold": 8,  // 周日全天加班门槛（小时）
  "weekendHalfThreshold": 4   // 周日半天加班门槛（小时）
}
```

**penaltyRules 结构：**
```json
[
  {
    "type": "late",           // 违规类型
    "name": "迟到罚款",
    "mode": "hourly",         // hourly=按小时 / fixed=固定金额
    "rate": 0,                // 按小时：时薪倍数；固定：金额（分）
    "enabled": true
  },
  {
    "type": "early",
    "name": "早退罚款",
    "mode": "hourly",
    "rate": 0,
    "enabled": true
  }
]
```

**salaryTemplate 结构：**
```json
[
  {
    "id": "cf_abc123",       // 字段唯一ID
    "label": "交通补贴",      // 自定义显示名称（管理员可改）
    "type": "manual",         // auto=自动计算 / manual=手动填写
    "source": null,           // 自动字段的系统数据源 key（manual 时为 null）
    "dataType": "money",      // manual 字段的数据类型：money/number/text
    "group": "bonus",         // 所属分组：attendance/salary/overtime/bonus/deduction/summary
    "order": 15,              // 排列顺序
    "highlight": false        // 是否高亮显示
  },
  {
    "id": "f06",
    "label": "基本底薪",
    "type": "auto",
    "source": "baseSalary",   // 系统自动计算的数据源
    "group": "salary",
    "order": 6,
    "highlight": false
  }
]
```

> 自动字段的 source 可选值见 `salary-fields.js` 中的 `AUTO_FIELD_SOURCES`，
> 包含 attendanceDays、baseSalary、overtimePay、grossPay、actualPay 等 27 个数据源。
> 管理员可自由添加手动填写字段（如交通补贴、通讯补贴、绩效奖金等）。

---

### 5. salaryRecords（工资记录表）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | 自动 | |
| companyId | string | 是 | 所属公司 ID |
| employeeId | string | 是 | 员工 ID |
| year | number | 是 | 年份 |
| month | number | 是 | 月份 |
| attendanceDays | number | 是 | 出勤天数 |
| normalWorkHours | number | 是 | 平班时间（小时） |
| weekdayOvertimeHours | number | 是 | 平时加班小时数 |
| restDayHours | number | 否 | 休息时间（小时） |
| holidayOvertimeHours | number | 否 | 假日加班小时数 |
| personalLeaveHours | number | 否 | 事假时间（小时） |
| absentHours | number | 否 | 缺勤时间（小时） |
| baseSalary | number | 是 | 基本底薪（分） |
| hourlyRate | number | 是 | 时薪（分/小时） |
| dailyRate | number | 否 | 日薪（分） |
| positionAllowance | number | 否 | 职务津贴（分） |
| businessCommission | number | 否 | 业务提成（分） |
| salaryTotal | number | 是 | 薪资合计=底薪+职务津贴+业务提成（分） |
| weekdayOvertimePay | number | 否 | 平时加班费（分） |
| weekdayOvertimeRate | number | 否 | 平时加班费率（分/小时） |
| holidayOvertimePay | number | 否 | 假日加班费（分） |
| holidayOvertimeRate | number | 否 | 假日加班费率（分/小时） |
| overtimePay | number | 是 | 加班费合计=平时+假日（分） |
| overtimeMealSubsidy | number | 是 | 加班餐补（分） |
| laborProtectionSubsidy | number | 否 | 劳保补贴（分） |
| bonusAmount | number | 否 | 奖金（分） |
| seniorityPay | number | 否 | 工龄工资（分） |
| otherSubsidy | number | 否 | 其他补贴（分） |
| personalLeaveDays | number | 否 | 事假天数 |
| leaveDeductionTotal | number | 否 | 请假扣款合计（分） |
| personalLeaveDeduction | number | 否 | 事假扣款（分） |
| absentDeduction | number | 否 | 缺勤扣款（分） |
| grossPay | number | 是 | 应付工资（分） |
| socialInsurance | number | 否 | 社保个人缴纳（分） |
| taxableIncome | number | 否 | 应纳税所得额（分） |
| incomeTax | number | 否 | 个人所得税（分） |
| loan | number | 否 | 借款（分） |
| actualPay | number | 是 | 实发工资（分） |
| configSnapshot | object | 是 | 配置快照（生成时保存） |
| generatedAt | string | 是 | 生成时间 |
| createdAt | string | 是 | 创建时间 |

**索引：**
- `companyId` + `employeeId` + `year` + `month`（唯一复合索引）

---

### 6. operationLogs（操作日志表）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | 自动 | |
| companyId | string | 是 | 所属公司 ID |
| operatorId | string | 是 | 操作人 ID |
| operatorName | string | 是 | 操作人姓名 |
| action | string | 是 | 操作类型 |
| target | string | 否 | 操作对象 |
| detail | string | 否 | 操作详情 |
| createdAt | string | 是 | 操作时间 |

**索引：**
- `companyId` + `createdAt`

---

## 安全规则（Security Rules）

```json
{
  "companies": {
    "read": true,
    "write": "doc.ownerOpenid == auth.openid"
  },
  "employees": {
    "read": "doc.companyId in auth.custom_claim.companyIds",
    "write": "doc.companyId in auth.custom_claim.companyIds && query.role == 'admin'"
  },
  "checkinRecords": {
    "read": "doc.companyId in auth.custom_claim.companyIds",
    "write": "doc.openid == auth.openid || query.role == 'admin'"
  },
  "salaryConfig": {
    "read": "doc.companyId in auth.custom_claim.companyIds",
    "write": "false"
  },
  "salaryRecords": {
    "read": "doc.employeeId == auth.custom_claim.employeeId || query.role == 'admin'",
    "write": "false"
  },
  "operationLogs": {
    "read": "query.role == 'admin'",
    "write": "false"
  }
}
```

> 注意：实际部署时需根据业务需求调整安全规则。建议管理员操作通过云函数进行，前端 SDK 仅做读取。
