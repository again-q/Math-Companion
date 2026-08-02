const chatService = require('../../../services/chat-service');
const { formatDateTime } = require('../../../utils/util');

Page({
  data: {
    loading: true,
    summary: '',
    updatedText: '',
    empty: false,
  },

  onLoad() {
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const data = await chatService.getSummary('recent');
      this.setData({
        summary: data.summary || '',
        updatedText: data.lastUpdatedAt ? formatDateTime(data.lastUpdatedAt) : '',
        empty: !data.summary,
        loading: false,
      });
    } catch (e) {
      console.error('[summary-detail] 加载失败:', e);
      this.setData({ loading: false, empty: true });
    }
  },

  retry() {
    this.load();
  },
});
