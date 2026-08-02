/**
 * 数学小伴 — 记忆页
 *
 * 会话管理中心：查看、删除、重命名、新建会话
 */
const chatService = require('../../services/chat-service');
const { formatDateTime } = require('../../utils/util');

Page({
  data: {
    sessions: [],
    loading: true,

    // 重命名弹窗
    showRenameModal: false,
    renameSessionId: '',
    renameValue: '',

    // 左滑状态
    swipedSessionId: null,
  },

  onShow() {
    this.loadSessions();
  },

  onPullDownRefresh() {
    this.loadSessions().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadSessions() {
    this.setData({ loading: true });
    try {
      const data = await chatService.getSessions();
      const sessions = (data || []).map(s => ({
        ...s,
        time: formatDateTime(s.updatedAt || s.createdAt),
        msgCount: s.totalMessages || 0,
        title: s.title || '未命名对话',
      }));
      this.setData({ sessions, loading: false, swipedSessionId: null });
    } catch (e) {
      this.setData({ loading: false });
      console.error('[memory] 加载失败:', e);
    }
  },

  // ============================================================
  // 新建会话
  // ============================================================

  async onNewSession() {
    wx.vibrateShort({ type: 'light' });
    try {
      const result = await chatService.createSession('新对话');
      wx.setStorageSync('view_session_id', result.sessionId);
      wx.switchTab({ url: '/pages/chat/chat' });
    } catch (e) {
      console.error('[memory] 新建失败:', e);
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
  },

  // ============================================================
  // 左滑删除（优化版）
  // ============================================================

  onTouchStart(e) {
    const sessionId = e.currentTarget.dataset.id;
    this._touchStartX = e.touches[0].clientX;
    this._touchSessionId = sessionId;
    this._touchStartTime = Date.now();
  },

  onTouchMove(e) {
    const diffX = e.touches[0].clientX - this._touchStartX;
    if (diffX < 0 && this._touchSessionId) {
      const translate = Math.max(diffX, -this.deleteBtnPx());
      const sessionId = this._touchSessionId;
      const sessions = this.data.sessions.map(s => ({
        ...s,
        translateX: s.sessionId === sessionId ? translate : 0,
      }));
      this.setData({ sessions });
    }
  },

  onTouchEnd(e) {
    const diffX = e.changedTouches[0].clientX - this._touchStartX;
    const duration = Date.now() - this._touchStartTime;
    
    let shouldOpen = false;
    
    if (duration < 300) {
      shouldOpen = diffX < -30;
    } else {
      shouldOpen = diffX < -70;
    }
    
    const sessionId = this._touchSessionId;
    const sessions = this.data.sessions.map(s => ({
      ...s,
      translateX: s.sessionId === sessionId ? (shouldOpen ? -this.deleteBtnPx() : 0) : 0,
    }));
    
    this.setData({ 
      sessions,
      swipedSessionId: shouldOpen ? sessionId : null,
    });
  },

  // 删除按钮宽度（140rpx 换算成 px，适配不同屏宽，保证滑动跟手且完整露出）
  deleteBtnPx() {
    if (!this._deleteBtnPx) {
      const windowWidth = (wx.getSystemInfoSync && wx.getSystemInfoSync().windowWidth) || 375;
      this._deleteBtnPx = Math.round(140 * windowWidth / 750);
    }
    return this._deleteBtnPx;
  },

  async onDeleteSession(e) {
    wx.vibrateShort({ type: 'medium' });
    const sessionId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除对话',
      content: '确定要删除这个对话吗？删除后不可恢复。',
      success: async (res) => {
        if (res.confirm) {
          try {
            await chatService.deleteSession(sessionId);
            this.loadSessions();
            wx.showToast({ title: '已删除', icon: 'success' });
          } catch (err) {
            console.error('[memory] 删除失败:', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      },
    });
  },

  // ============================================================
  // 重命名
  // ============================================================

  onRenameTap(e) {
    const sessionId = e.currentTarget.dataset.id;
    const sessions = this.data.sessions;
    const session = sessions.find(s => s.sessionId === sessionId);
    this.setData({
      showRenameModal: true,
      renameSessionId: sessionId,
      renameValue: session ? session.title : '',
    });
  },

  onRenameInput(e) {
    this.setData({ renameValue: e.detail.value });
  },

  async onRenameConfirm() {
    const title = this.data.renameValue.trim();
    if (!title) {
      wx.showToast({ title: '标题不能为空', icon: 'none' });
      return;
    }
    try {
      await chatService.renameSession(this.data.renameSessionId, title);
      this.setData({ showRenameModal: false });
      this.loadSessions();
    } catch (err) {
      console.error('[memory] 重命名失败:', err);
      wx.showToast({ title: '重命名失败', icon: 'none' });
    }
  },

  onRenameCancel() {
    this.setData({ showRenameModal: false });
  },

  // ============================================================
  // 查看会话
  // ============================================================

  viewSession(e) {
    wx.vibrateShort({ type: 'light' });
    const sessionId = e.currentTarget.dataset.id;
    wx.setStorageSync('view_session_id', sessionId);
    wx.switchTab({ url: '/pages/chat/chat' });
  },

  // ============================================================
  // 学习总结
  // ============================================================

  async showSummary() {
    try {
      const data = await chatService.getSummary('all');
      if (data?.summary) {
        wx.showModal({
          title: '📊 学习总结',
          content: data.summary,
          showCancel: false,
        });
      }
    } catch (e) {
      console.error('[memory] 总结失败:', e);
    }
  },
});
