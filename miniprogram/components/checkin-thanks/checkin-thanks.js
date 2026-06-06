// components/checkin-thanks/checkin-thanks.js
// 全屏打卡感谢页 - 黑白简约超写实主义
Component({
  properties: {
    // 是否显示
    visible: {
      type: Boolean,
      value: false
    },
    // 公司名称
    companyName: {
      type: String,
      value: ''
    },
    // 打卡类型: 'in' | 'out'
    checkType: {
      type: String,
      value: 'in'
    },
    // 当前时间文字
    currentTime: {
      type: String,
      value: ''
    }
  },

  data: {
    animating: false
  },

  observers: {
    'visible': function (val) {
      if (val) {
        this.setData({ animating: true })
        // 1.5秒后自动关闭
        this._autoHideTimer = setTimeout(() => {
          this.dismiss()
        }, 1500)
      }
    }
  },

  lifetimes: {
    detached() {
      if (this._autoHideTimer) {
        clearTimeout(this._autoHideTimer)
      }
    }
  },

  methods: {
    // 触摸退出
    onTapDismiss() {
      this.dismiss()
    },

    // 关闭
    dismiss() {
      if (this._autoHideTimer) {
        clearTimeout(this._autoHideTimer)
        this._autoHideTimer = null
      }
      this.triggerEvent('dismiss')
      // 等待动画结束后移除
      setTimeout(() => {
        this.setData({ animating: false })
      }, 600)
    }
  }
})
