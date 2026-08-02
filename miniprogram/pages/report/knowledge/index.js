const chatService = require('../../../services/chat-service');

Page({
  data: {
    loading: true,
    report: [],
    empty: false,
  },

  onLoad() {
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const data = await chatService.getSummary('recent');
      let report = data.knowledgeReport || [];
      if (!report.length) {
        // 兜底：从 topicsCovered 组装（后端未生成 AI 点评时）
        report = (data.topicsCovered || [])
          .filter(t => t.level > 0)
          .map(t => ({ ...t, comment: '', nextStep: '' }));
      }
      report = report.map(r => ({
        ...r,
        percent: Math.round((r.level || 0) * 100),
        // 等级徽章颜色（WXML 不支持嵌套三元，JS 预计算）
        levelBg: r.level >= 0.7 ? 'rgba(52,199,89,0.15)' : r.level >= 0.3 ? 'rgba(255,149,0,0.15)' : 'rgba(255,59,48,0.1)',
        levelColor: r.level >= 0.7 ? '#2E7D32' : r.level >= 0.3 ? '#B26A00' : '#C62828',
      }));
      this.setData({ report, empty: report.length === 0, loading: false });
    } catch (e) {
      console.error('[knowledge] 加载失败:', e);
      this.setData({ loading: false, empty: true });
    }
  },

  retry() {
    this.load();
  },
});
