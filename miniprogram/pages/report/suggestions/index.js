const chatService = require('../../../services/chat-service');

Page({
  data: {
    loading: true,
    suggestions: [],
    empty: false,
  },

  onLoad() {
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const data = await chatService.getSummary('recent');
      let suggestions = data.detailedSuggestions || [];
      if (!suggestions.length) {
        // 兜底：字符串建议转结构化
        suggestions = (data.suggestions || []).map(s => ({
          title: String(s).replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, ''),
          reason: '',
          action: '',
        }));
      }
      this.setData({ suggestions, empty: suggestions.length === 0, loading: false });
    } catch (e) {
      console.error('[suggestions] 加载失败:', e);
      this.setData({ loading: false, empty: true });
    }
  },

  retry() {
    this.load();
  },
});
