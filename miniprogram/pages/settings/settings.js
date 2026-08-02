const chatService = require('../../services/chat-service');

Page({
  data: {
    systemPrompt: '',
    originalPrompt: '',
    changed: false,
    promptLength: 0,
    saveSuccess: false,
    saveButtonText: '已保存',
  },

  onLoad() {
    this.loadPrompt();
  },

  async loadPrompt() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'math-agent',
        data: { type: 'getConfig' },
      });
      const prompt = res.result?.data?.systemPrompt || '';
      this.setData({
        systemPrompt: prompt,
        originalPrompt: prompt,
        promptLength: prompt.length,
      });
    } catch (e) {
      this.showToast('加载失败，请检查云函数');
    }
  },

  onPromptChange(e) {
    const value = e.detail.value;
    this.setData({
      systemPrompt: value,
      promptLength: value.length,
      changed: value !== this.data.originalPrompt,
      saveButtonText: value !== this.data.originalPrompt ? '保存设置' : '已保存',
    });
  },

  async savePrompt() {
    if (!this.data.changed) {
      this.showToast('没有改动');
      return;
    }
    wx.vibrateShort({ type: 'light' });
    try {
      await wx.cloud.callFunction({
        name: 'math-agent',
        data: {
          type: 'setConfig',
          data: { systemPrompt: this.data.systemPrompt },
        },
      });
      this.setData({
        originalPrompt: this.data.systemPrompt,
        changed: false,
        saveSuccess: true,
        saveButtonText: '保存成功',
      });
      setTimeout(() => {
        this.setData({ saveSuccess: false, saveButtonText: '已保存' });
      }, 1500);
    } catch (e) {
      const errMsg = (e && (e.message || e.errMsg)) || '未知错误';
      this.showToast('保存失败: ' + errMsg);
    }
  },

  resetPrompt() {
    wx.showModal({
      title: '恢复默认',
      content: '确定恢复默认提示词？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            systemPrompt: '',
            promptLength: 0,
            changed: true,
            saveButtonText: '保存设置',
          });
        }
      },
    });
  },

  showToast(text) {
    wx.showToast({
      title: text,
      icon: 'none',
      duration: 2000,
    });
  },
});
