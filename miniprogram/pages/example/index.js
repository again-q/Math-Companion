Page({
  data: {
    examples: [
      {
        id: 1,
        icon: '📐',
        title: '几何题讲解',
        desc: '辅助线怎么画？一步步教你解题思路',
        question: '一个三角形的底是10cm，高是6cm，面积是多少？',
      },
      {
        id: 2,
        icon: '📊',
        title: '应用题分析',
        desc: '生活中的数学问题，帮你理清思路',
        question: '小明买了3支铅笔花了9元，每支铅笔多少钱？',
      },
      {
        id: 3,
        icon: '🧮',
        title: '代数方程求解',
        desc: '未知数怎么解？教你解方程的技巧',
        question: '解方程：2x + 5 = 15，x等于多少？',
      },
      {
        id: 4,
        icon: '📈',
        title: '函数图像解读',
        desc: '理解函数的变化规律',
        question: '一次函数 y = 2x + 1 的图像是什么样的？',
      },
    ],
    selectedExample: null,
    showDetail: false,
  },

  selectExample(e) {
    const index = e.currentTarget.dataset.index;
    const example = this.data.examples[index];
    this.setData({
      selectedExample: example,
      showDetail: true,
    });
  },

  closeDetail() {
    this.setData({ showDetail: false });
  },

  copyQuestion(e) {
    const question = e.currentTarget.dataset.question;
    wx.setClipboardData({
      data: question,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
      },
    });
  },

  goToChat() {
    wx.switchTab({ url: '/pages/chat/chat' });
  },
});