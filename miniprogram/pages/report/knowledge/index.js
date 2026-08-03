const chatService = require('../../../services/chat-service');

// 初一到初三全部单元知识点（知识地图）
const GRADE_GROUPS = [
  { grade: '初一上册', topics: ['有理数', '整式的加减', '一元一次方程', '几何图形初步'] },
  { grade: '初一下册', topics: ['相交线与平行线', '实数', '平面直角坐标系', '二元一次方程组', '不等式与不等式组', '数据的收集整理与描述'] },
  { grade: '初二上册', topics: ['三角形', '全等三角形', '轴对称', '整式的乘法与因式分解', '分式'] },
  { grade: '初二下册', topics: ['二次根式', '勾股定理', '平行四边形', '一次函数', '数据的分析'] },
  { grade: '初三上册', topics: ['一元二次方程', '二次函数', '旋转', '圆', '概率初步'] },
  { grade: '初三下册', topics: ['反比例函数', '相似三角形', '锐角三角函数', '投影与视图'] },
];

Page({
  data: {
    loading: true,
    groups: [],
    recommendTopic: '',
    empty: false,
  },

  onLoad() {
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const data = await chatService.getSummary('recent');
      // progress 映射（knowledgeReport 覆盖全部知识点）
      const progressMap = {};
      (data.knowledgeReport || []).forEach(r => {
        progressMap[r.topic] = r;
      });

      const groups = GRADE_GROUPS.map(g => {
        let practicedCount = 0;
        const topics = g.topics.map(t => {
          const p = progressMap[t] || {};
          const level = p.level || 0;
          if (level > 0) practicedCount++;
          return {
            topic: t,
            level,
            percent: Math.round((level || 0) * 100),
            levelDesc: p.levelDesc || '未开始',
            // 等级徽章样式（WXML 不支持嵌套三元，JS 预计算）
            levelClass: p.levelDesc === '掌握' || p.levelDesc === '熟练' || p.levelDesc === '精通' ? 'good'
              : p.levelDesc === '初识' ? 'start'
              : p.levelDesc === '未开始' ? 'none' : 'mid',
            practicedCount: p.practicedCount || 0,
            consecutiveCorrect: p.consecutiveCorrect || 0,
            comment: p.comment || '',
            nextStep: p.nextStep || '',
            lastPracticedAt: p.lastPracticedAt || null,
          };
        });
        // 单元状态：全未开始=未学习；全部掌握=已掌握；否则学习中
        const masteredCount = topics.filter(t => t.level >= 0.5).length;
        let unitStatus = '未学习';
        let unitClass = 'none';
        if (topics.length > 0 && masteredCount === topics.length) {
          unitStatus = '已掌握';
          unitClass = 'good';
        } else if (practicedCount > 0) {
          unitStatus = '学习中';
          unitClass = 'mid';
        }
        return { ...g, topics, practicedCount, unitStatus, unitClass };
      });

      // 单元排序：未学习 > 学习中 > 已掌握（优先弹没学过的和掌握度低的）
      const unitOrder = { '未学习': 0, '学习中': 1, '已掌握': 2 };
      groups.sort((a, b) => (unitOrder[a.unitStatus] ?? 1) - (unitOrder[b.unitStatus] ?? 1));

      // 单元内知识点排序：未开始优先，然后按掌握度升序（低的在前）
      groups.forEach(g => {
        g.topics.sort((a, b) => {
          if (a.level === 0 && b.level === 0) return 0;
          if (a.level === 0) return -1;
          if (b.level === 0) return 1;
          return a.level - b.level;
        });
      });

      // 推荐知识点：第一个未开始或掌握度 < 0.3 的
      let recommendTopic = '';
      for (const g of groups) {
        const first = g.topics.find(t => t.level === 0 || t.level < 0.3);
        if (first) { recommendTopic = first.topic; break; }
      }

      this.setData({ groups, recommendTopic, loading: false, empty: data.totalSessions === 0 });
    } catch (e) {
      console.error('[knowledge] 加载失败:', e);
      this.setData({ loading: false, empty: true });
    }
  },

  retry() {
    this.load();
  },

  // 开始学习某个知识点：跳到对话页并自动发起学习
  onStartStudy(e) {
    const topic = e.currentTarget.dataset.topic;
    wx.setStorageSync('study_topic', topic);
    // 分包页跳 tab 用 reLaunch（switchTab 在分包+tab 组合下偶发 webviewId 路由 bug）
    wx.reLaunch({ url: '/pages/chat/chat' });
  },

  // 单元水平测试：先拉取教材参考材料，再跳对话让 AI 测试
  async onTestUnit(e) {
    const unit = e.currentTarget.dataset.unit;
    wx.showLoading({ title: '准备测试...', mask: true });
    try {
      const result = await chatService.getUnitMaterial(unit);
      const material = (result && result.material) || '';
      wx.setStorageSync('unit_test', unit);
      wx.setStorageSync('test_material', material);
      wx.hideLoading();
      wx.reLaunch({ url: '/pages/chat/chat' });
    } catch (err) {
      console.error('[knowledge] 获取测试材料失败:', err);
      wx.hideLoading();
      // 失败也允许测试（AI 用自带知识）
      wx.setStorageSync('unit_test', unit);
      wx.setStorageSync('test_material', '');
      wx.reLaunch({ url: '/pages/chat/chat' });
    }
  },
});
