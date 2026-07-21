Page({
  data: {
    features: [
      {
        icon: '💡',
        title: '智能辅导',
        desc: '引导式教学，不直接给答案',
      },
      {
        icon: '📚',
        title: '知识追踪',
        desc: '记录学习进度，掌握程度可视化',
      },
      {
        icon: '🎭',
        title: '趣味互动',
        desc: '讲故事、举例子，轻松理解',
      },
      {
        icon: '📊',
        title: '学习总结',
        desc: '定期总结，见证成长轨迹',
      },
    ],
  },

  goToChat() {
    wx.switchTab({
      url: '/pages/chat/chat',
    });
  },

  goToExample() {
    wx.navigateTo({
      url: '/pages/example/index',
    });
  },
});