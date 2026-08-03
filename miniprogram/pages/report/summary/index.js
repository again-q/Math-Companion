const chatService = require('../../../services/chat-service');
const { formatDateTime } = require('../../../utils/util');
// towxml：markdown → html → nodes
const md2html = require('../../../towxml/parse/markdown/index.js');
const parseHtml = require('../../../towxml/parse/index.js');

Page({
  data: {
    loading: true,
    summary: '',
    article: null,
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
      const summary = data.summary || '';
      let article = null;
      if (summary) {
        try {
          const html = md2html(summary);
          article = parseHtml(html, { theme: 'light' });
        } catch (e) {
          console.error('[summary-detail] markdown 解析失败:', e);
        }
      }
      this.setData({
        summary,
        article,
        updatedText: data.lastUpdatedAt ? formatDateTime(data.lastUpdatedAt) : '',
        empty: !summary,
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
