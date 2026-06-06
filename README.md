# 公司打卡考勤 & 工资小程序

支持多公司定制的微信打卡考勤与工资计算小程序。一个小程序服务多家公司，数据严格隔离。

## 功能特性

### 多租户支持
- 一个小程序服务多家公司，所有数据按 companyId 严格隔离
- 创建公司时自动生成唯一邀请码（6位字母+数字）
- 支持公司 Logo、名称、主题色个性化定制
- 员工通过邀请码加入公司

### 员工端
- **GPS + Wi-Fi 双重验证打卡**：支持 GPS 定位和 Wi-Fi SSID 校验
- **离线打卡**：网络恢复后自动同步
- **异常标记**：不在范围内自动标记异常打卡
- **考勤日历**：月视图显示正常、迟到、早退、加班、缺勤状态
- **工作内容**：点击日期填写当天工作内容
- **工资预览**：实时显示当月预计工资及明细

### 管理员端
- **员工管理**：添加、编辑、删除员工（含月薪、类型：正式/实习）
- **考勤记录**：按日期查看所有员工打卡状态，支持修改打卡时间（记录操作日志）
- **配置中心**：
  - 标准上下班时间（全局 + 按个人调整）
  - 本月应工作小时数
  - 加班费率（正式 26 元/小时，实习 18 元/小时，可调）
  - 餐补规则（工作日 15 元，周日全天 30 元/半天 15 元）
  - 罚款规则（迟到/早退/缺勤，按时薪或固定金额）
  - Wi-Fi 白名单和公司定位
- **操作日志**：记录所有管理员操作

### 工资计算引擎
独立可测试模块，严格按以下规则计算：
```
时薪 = 月固定工资 ÷ 本月应工作小时数
普通工资 = 时薪 × 当月实际普通工作小时数
加班工资 = 加班小时数 × 对应费率
餐补合计 = 根据星期和加班时长判断
实发工资 = 普通工资 + 加班工资 + 餐补 - 罚款合计
```

- 所有金额使用"分"为单位存储，避免浮点误差
- 作息时间调整仅影响未来打卡，历史数据保留原始快照

### 自动化
- 每月 2 号云函数生成上月工资报表
- 通过邮件自动发送给管理员

## 项目结构

```
attendance-miniapp/
├── miniprogram/                   # 小程序前端
│   ├── app.js                     # 应用入口
│   ├── app.json                   # 全局配置
│   ├── app.wxss                   # 全局样式
│   ├── pages/
│   │   ├── index/                 # 入口页（自动跳转）
│   │   ├── guild/                 # 引导页（创建/加入公司）
│   │   ├── company/               # 公司选择（多公司切换）
│   │   ├── checkin/               # 打卡页
│   │   ├── calendar/              # 考勤日历
│   │   ├── salary/                # 工资预览
│   │   └── admin/
│   │       ├── employees/         # 员工管理
│   │       ├── attendance/        # 考勤记录
│   │       ├── config/            # 配置中心
│   │       └── logs/              # 操作日志
│   ├── components/                # 公共组件
│   ├── utils/
│   │   ├── util.js                # 工具函数
│   │   ├── db.js                  # 数据库操作封装
│   │   ├── salary-engine.js       # 工资计算引擎
│   │   └── salary-engine.test.js  # 引擎单元测试
│   ├── images/                    # 图标资源
│   └── styles/                    # 额外样式
├── cloudfunctions/                # 云函数
│   ├── login/                     # 获取 openid
│   ├── checkin-sync/              # 离线打卡同步
│   ├── salary-report/             # 生成工资报表
│   └── send-email/                # 发送报表邮件
├── docs/
│   └── database-schema.md         # 数据库 Schema 文档
└── project.config.json            # 项目配置
```

## 快速开始

### 1. 环境准备

- 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 注册微信小程序账号，获取 AppID
- 开通微信云开发

### 2. 导入项目

1. 打开微信开发者工具
2. 选择「导入项目」
3. 项目目录选择 `attendance-miniapp`
4. AppID 填入你的小程序 AppID
5. 点击确定

### 3. 配置云开发

1. 在微信开发者工具中点击「云开发」按钮
2. 创建云开发环境（选择基础版即可）
3. 记录环境 ID

4. 在 `miniprogram/app.js` 中修改云开发初始化：
```javascript
wx.cloud.init({
  env: 'your-env-id',  // 替换为你的云开发环境 ID
  traceUser: true
})
```

5. 在 `project.config.json` 中设置你的 AppID：
```json
{
  "appid": "your-appid-here"
}
```

### 4. 创建数据库集合

在云开发控制台中创建以下集合：

| 集合名 | 说明 |
|--------|------|
| companies | 公司表 |
| employees | 员工表 |
| checkinRecords | 打卡记录表 |
| salaryConfig | 工资配置表 |
| salaryRecords | 工资记录表 |
| operationLogs | 操作日志表 |

详细的 Schema 设计见 `docs/database-schema.md`。

### 5. 设置安全规则

在每个集合的「安全规则」中配置访问权限。建议：

- `companies`：所有用户可读，仅创建者可写
- `employees`：同公司用户可读，管理员可写
- `checkinRecords`：同公司用户可读，本人可写自己的记录
- `salaryConfig`：同公司用户可读，仅云函数可写
- `salaryRecords`：本人可读，仅云函数可写
- `operationLogs`：管理员可读

### 6. 部署云函数

右键点击每个云函数目录，选择「上传并部署：云端安装依赖」：

- `login`：获取用户 openid
- `checkin-sync`：同步离线打卡记录
- `salary-report`：生成月度工资报表
- `send-email`：发送报表邮件

### 7. 配置定时触发器

为 `salary-report` 云函数配置定时触发器，每月 2 号自动执行：

在 `salary-report` 目录下创建 `config.json`：
```json
{
  "triggers": [
    {
      "name": "salaryReportTimer",
      "type": "timer",
      "config": "0 2 2 * * * *"
    }
  ]
}
```

### 8. 配置权限

在 `app.json` 中已配置以下权限声明：
- `scope.userLocation`：获取位置信息（打卡验证）

## 环境变量

如需配置邮件发送功能，需在云函数环境变量中设置：

| 变量名 | 说明 |
|--------|------|
| MAIL_SERVICE | 邮件服务商（如 ses、sendgrid） |
| MAIL_API_KEY | 邮件服务 API Key |
| MAIL_FROM | 发件人邮箱 |

## 工资计算引擎测试

在项目目录下运行：

```bash
cd miniprogram/utils
node salary-engine.test.js
```

应看到所有 26 个测试通过。

## 注意事项

1. **AppID 配置**：必须在 `project.config.json` 中填入有效的小程序 AppID
2. **云开发环境**：需开通微信云开发，并在 `app.js` 中配置环境 ID
3. **定位权限**：打卡功能需要用户授权位置权限
4. **Wi-Fi 获取**：`wx.getConnectedWifi` 需要用户授权，且 iOS 上可能获取不到
5. **金额精度**：所有金额使用"分"为单位存储，前端展示时转换为元
6. **多公司切换**：用户可属于多个公司，登录时自动选择或手动切换
7. **离线打卡**：记录保存在本地存储，网络恢复后自动同步
8. **邮件服务**：`send-email` 云函数需要额外配置邮件服务商 API
9. **TabBar 图标**：需要替换 `miniprogram/images/` 下的占位图标文件
10. **安全规则**：生产环境务必配置正确的数据库安全规则

## 技术栈

- **前端**：微信小程序原生开发
- **后端**：微信云开发（云函数 + 云数据库 + 云存储）
- **数据库**：微信云开发 NoSQL 数据库
- **计算引擎**：独立 JavaScript 模块，可脱离小程序运行和测试

## 许可证

MIT
