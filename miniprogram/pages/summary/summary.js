const chatService = require('../../services/chat-service');
const { formatDateTime } = require('../../utils/util');

const TOPIC_GROUPS = {
  '初一上册': ['有理数', '整式的加减', '一元一次方程', '几何图形初步'],
  '初一下册': ['相交线与平行线', '实数', '平面直角坐标系', '二元一次方程组', '不等式与不等式组', '数据的收集整理与描述'],
  '初二上册': ['三角形', '全等三角形', '轴对称', '整式的乘法与因式分解', '分式'],
  '初二下册': ['二次根式', '勾股定理', '平行四边形', '一次函数', '数据的分析'],
  '初三上册': ['一元二次方程', '二次函数', '旋转', '圆', '概率初步'],
  '初三下册': ['反比例函数', '相似三角形', '锐角三角函数', '投影与视图'],
};

function groupTopicsByGrade(topics) {
  const topicToGrade = {};
  Object.keys(TOPIC_GROUPS).forEach(grade => {
    TOPIC_GROUPS[grade].forEach(topic => {
      topicToGrade[topic] = grade;
    });
  });

  const grouped = {};
  Object.keys(TOPIC_GROUPS).forEach(grade => {
    grouped[grade] = [];
  });

  topics.forEach(topic => {
    const grade = topicToGrade[topic.topic] || '其他';
    if (!grouped[grade]) grouped[grade] = [];
    grouped[grade].push(topic);
  });

  return Object.keys(TOPIC_GROUPS)
    .filter(grade => grouped[grade].length > 0)
    .map(grade => ({
      grade,
      topics: grouped[grade].sort((a, b) => {
        if (a.level > 0 && b.level === 0) return -1;
        if (a.level === 0 && b.level > 0) return 1;
        return b.level - a.level;
      }),
    }));
}

Page({
  data: {
    loading: true,
    summary: '',
    topicsCovered: [],
    groupedTopics: [],
    stats: {},
    suggestions: [],
    totalSessions: 0,
    totalMessages: 0,
    learningDays: 0,
    empty: false,
    scope: 'recent',
    fromCache: false,
    refreshing: false,
    topicsExpanded: true,
    lastUpdatedText: '',
    topicsCount: 0,
    knowledgeCount: 0,
    suggestionsCount: 0,
  },

  onShow() {
    this.loadSummary();
  },

  async loadSummary() {
    this.setData({ loading: true });
    try {
      const data = await chatService.getSummary(this.data.scope);
      if (data) {
        const topicsCovered = (data.topicsCovered || []).map(t => ({
          ...t,
          percent: Math.round((t.level || 0) * 100),
        }));
        const groupedTopics = groupTopicsByGrade(topicsCovered);
        const knowledgeCount = (data.knowledgeReport && data.knowledgeReport.length) ? data.knowledgeReport.length : topicsCovered.filter(t => t.level > 0).length;
        const suggestionsCount = (data.detailedSuggestions && data.detailedSuggestions.length) ? data.detailedSuggestions.length : (data.suggestions || []).length;
        this.setData({
          summary: data.summary || '',
          topicsCovered,
          groupedTopics,
          stats: data.stats || {},
          suggestions: data.suggestions || [],
          totalSessions: data.totalSessions || 0,
          totalMessages: data.totalMessages || 0,
          learningDays: data.learningDays || 0,
          topicsCount: topicsCovered.length,
          knowledgeCount,
          suggestionsCount,
          empty: data.totalSessions === 0,
          fromCache: data.fromCache || false,
          lastUpdatedText: data.lastUpdatedAt ? formatDateTime(data.lastUpdatedAt) : '',
        });
        this.animateNumbers(data);
      }
    } catch (e) {
      console.error('[summary] 加载失败:', e);
      this.setData({ empty: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 数据范围切换
  switchScope(e) {
    const scope = e.currentTarget.dataset.scope;
    if (scope === this.data.scope) return;
    this.setData({ scope }, () => {
      this.loadSummary();
    });
  },

  // 数字动画：从 0 增长到目标值
  animateNumbers(data) {
    const targets = {
      totalSessions: data.totalSessions || 0,
      totalMessages: data.totalMessages || 0,
      learningDays: data.learningDays || 0,
    };
    const keys = Object.keys(targets);
    const duration = 800; // 动画时长 ms
    const interval = 16;  // ~60fps
    const steps = Math.ceil(duration / interval);
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = Math.min(currentStep / steps, 1);
      // easeOut 缓动
      const eased = 1 - Math.pow(1 - progress, 3);

      const update = {};
      for (const key of keys) {
        update[key] = Math.round(targets[key] * eased);
      }
      this.setData(update);

      if (progress >= 1) {
        clearInterval(timer);
      }
    }, interval);
  },

  async refreshSummary() {
    this.setData({ refreshing: true });
    try {
      // 第一步：先更新 memory（AI 的记忆档案）
      await wx.cloud.callFunction({
        name: 'math-agent',
        data: { type: 'rebuildMemory' },
      });
      // 第二步：标记总结需要更新
      await wx.cloud.callFunction({
        name: 'math-agent',
        data: { type: 'updateProfile', data: { summaryNeedsUpdate: true } },
      });
      // 第三步：重新加载总结
      await this.loadSummary();
    } catch (e) {
      console.error('[summary] 刷新失败:', e);
    } finally {
      this.setData({ refreshing: false });
    }
  },

  goToChat() {
    wx.switchTab({ url: '/pages/chat/chat' });
  },

  goKnowledge() {
    wx.navigateTo({ url: '/pages/report/knowledge/index' });
  },

  goSuggestions() {
    wx.navigateTo({ url: '/pages/report/suggestions/index' });
  },

  goSummaryDetail() {
    wx.navigateTo({ url: '/pages/report/summary/index' });
  },

  toggleTopics() {
    this.setData({
      topicsExpanded: !this.data.topicsExpanded,
    });
  },
});
