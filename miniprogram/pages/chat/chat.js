/**
 * 数学小伴 — 对话页逻辑
 *
 * 核心交互：消息收发、打字机效果、语音输入、状态管理、会话切换
 */
const chatService = require('../../services/chat-service');
const { formatTime } = require('../../utils/util');

Page({
  data: {
    // 会话状态
    sessionId: null,
    sessionTitle: '',
    messages: [],
    msgCounter: 0,

    // 输入状态
    inputValue: '',
    isLoading: false,
    isTyping: false,
    deepThink: false,

    // AI 状态
    currentEmotion: 'happy',

    // 语音
    isRecording: false,

    // 滚动定位
    lastMsgId: '',
    showScrollToBottom: false,

    // 输入自动聚焦
    inputFocus: false,

    // 会话切换
    sessions: [],

    // 空状态推荐问题
    suggestions: [
      { icon: '📐', content: '帮我理解一元二次方程' },
      { icon: '📊', content: '讲一个数学小故事' },
      { icon: '🧮', content: '怎么解几何证明题' },
    ],
  },

  // ============================================================
  // 生命周期
  // ============================================================

  onLoad() {
    // 冷启动小程序 → 默认新对话
    this.loadSessionFromCloud();
  },

  onShow() {
    // 从知识点地图"开始学习"跳转：自动发起该知识点学习
    const studyTopic = wx.getStorageSync('study_topic');
    if (studyTopic) {
      wx.removeStorageSync('study_topic');
      // 仅当当前是空会话（无消息）时自动发起，避免打断已有对话
      if (this.data.messages.length === 0 && !this.data.isLoading) {
        this.setData({
          inputValue: `我们来学习「${studyTopic}」，先从基础概念开始讲起吧`,
        });
        setTimeout(() => {
          this.onSendMessage();
        }, 400);
      }
    }

    // 单元水平测试：自动发起测试对话
    const unitTest = wx.getStorageSync('unit_test');
    if (unitTest) {
      const testMaterial = wx.getStorageSync('test_material') || '';
      wx.removeStorageSync('unit_test');
      wx.removeStorageSync('test_material');
      if (this.data.messages.length === 0 && !this.data.isLoading) {
        this._testMaterial = testMaterial; // 传给本次发送
        this.setData({
          inputValue: `请对我进行「${unitTest}」单元的水平测试。按人教版教材，从基础概念开始逐个提问，我答完一道再进入下一道；如果我能答对大部分就说明这个单元已经会了，测试结束给我一个总结。`,
        });
        setTimeout(() => {
          this.onSendMessage();
        }, 400);
      }
    }

    // Tab 切换回来时，检查是否有从记忆页跳转的会话
    const pendingId = wx.getStorageSync('view_session_id');
    if (pendingId) {
      this.loadSessionFromCloud();
    }
  },

  /**
   * 从云端加载指定会话的历史消息
   */
  async loadSessionFromCloud() {
    const targetSessionId = wx.getStorageSync('view_session_id');

    // Tab 切换回来但没有指定会话 → 保持当前会话不动
    if (!targetSessionId && this.data.sessionId) {
      return;
    }

    if (targetSessionId) {
      wx.removeStorageSync('view_session_id');
      this.setData({ isLoading: true });

      try {
        const msgResult = await chatService.getMessages(targetSessionId);
        // 独立加载会话列表，失败不影响消息展示
        this.fetchSessionList().catch(() => {});

        const messages = (msgResult.messages || []).map((msg, i) => ({
          msgId: 'msg-' + i,
          role: msg.role,
          content: msg.content,
          time: formatTime(new Date(msg.createdAt)),
        }));

        this.setData({
          sessionId: targetSessionId,
          sessionTitle: '对话',
          messages: messages,
          msgCounter: messages.length,
          isLoading: false,
        });

        setTimeout(() => {
          this.scrollToBottom();
        }, 300);

        return;
      } catch (e) {
        console.error('[chat] 云端加载失败:', e);
        this.setData({ isLoading: false });
        return;
      }
    }

    // 没有指定会话 → 默认新对话
    this.setData({
      sessionId: null,
      sessionTitle: '',
      messages: [],
      msgCounter: 0,
    });

    this.addMessage('assistant', '你好呀~我是小伴🐰 有什么数学问题想问我吗？我们可以一起讨论哦！');

    this.setData({ inputFocus: true });
    this.fetchSessionList();
  },

  // ============================================================
  // 会话切换
  // ============================================================

  async fetchSessionList() {
    try {
      const data = await chatService.getSessions();
      const sessions = (data || []).map(s => ({
        sessionId: s.sessionId,
        title: s.title || '未命名对话',
        msgCount: s.totalMessages || 0,
      }));
      this.setData({ sessions });

      // 同步更新当前会话标题（后端自动设了标题后刷新）
      const current = sessions.find(s => s.sessionId === this.data.sessionId);
      if (current && current.title !== this.data.sessionTitle) {
        this.setData({ sessionTitle: current.title });
      }

      return data || [];
    } catch (e) {
      console.error('[chat] 加载会话列表失败:', e);
      return [];
    }
  },

  onSuggestionTap(e) {
    const content = e.currentTarget.dataset.content;
    this.setData({ inputValue: content });
    this.onSendMessage();
  },

  async onSwitchSession(e) {
    const targetId = e.currentTarget.dataset.id;
    if (targetId === this.data.sessionId) {
      return;
    }

    this.setData({ isLoading: true });

    try {
      const msgResult = await chatService.getMessages(targetId);

      const messages = (msgResult.messages || []).map((msg, i) => ({
        msgId: 'msg-' + i,
        role: msg.role,
        content: msg.content,
        time: formatTime(new Date(msg.createdAt)),
      }));

      const targetSession = this.data.sessions.find(s => s.sessionId === targetId);

      this.setData({
        sessionId: targetId,
        sessionTitle: targetSession?.title || '对话',
        messages: messages,
        msgCounter: messages.length,
        isLoading: false,
      });

      setTimeout(() => {
        this.scrollToBottom();
      }, 300);
    } catch (e) {
      console.error('[chat] 切换会话失败:', e);
      this.setData({ isLoading: false });
      this.showToast('切换会话失败');
    }
  },

  async onNewSessionFromChat() {
    try {
      const result = await chatService.createSession('新对话');
      this.setData({
        sessionId: result.sessionId,
        sessionTitle: '新对话',
        messages: [],
        msgCounter: 0,
      });
      this.addMessage('assistant', '你好呀~我是小伴🐰 有什么数学问题想问我吗？');
      this.fetchSessionList();
    } catch (e) {
      console.error('[chat] 新建会话失败:', e);
      this.showToast('创建失败');
    }
  },

  async retryLoadMessages(msgId) {
    try {
      const msgResult = await chatService.getMessages(this.data.sessionId);
      const messages = (msgResult.messages || []).map((msg, i) => ({
        msgId: 'msg-' + i,
        role: msg.role,
        content: msg.content,
        time: formatTime(new Date(msg.createdAt)),
      }));

      this.setData({
        messages: messages,
        msgCounter: messages.length,
        lastMsgId: messages.length > 0 ? 'msg-' + (messages.length - 1) : '',
      });

      setTimeout(() => {
        this.scrollToBottom();
      }, 300);
    } catch (e) {
      console.error('[chat] 重试加载消息失败:', e);
      const msgs = this.data.messages.filter(m => m.msgId !== msgId);
      this.setData({ messages: msgs });
      this.showToast('网络开小差了~');
    }
  },

  // ============================================================
  // 消息发送
  // ============================================================

  onInputChange(e) {
    this.setData({ inputValue: e.detail.value });
  },

  onInputFocus() {
    setTimeout(() => {
      this.scrollToBottom();
    }, 300);
  },

  async onSendMessage() {
    const content = this.data.inputValue.trim();
    if (!content) return;
    if (this.data.isLoading) {
      this.showToast('小伴还在思考中~');
      return;
    }
    
    wx.vibrateShort({ type: 'light' });

    setTimeout(() => {
      this.setData({ inputFocus: true });
    }, 100);

    const nextCounter = this.data.msgCounter + 1;

    this.addMessageWithCounter('user', content, nextCounter);

    this.setData({
      inputValue: '',
      isLoading: true,
      isTyping: true,
      msgCounter: nextCounter,
    });

    setTimeout(() => {
      this.scrollToBottom();
    }, 50);

    const msgId = 'msg-' + (nextCounter + 1);
    const aiMsg = {
      msgId,
      role: 'assistant',
      content: '',
      time: formatTime(new Date()),
    };
    this.setData({
      messages: [...this.data.messages, aiMsg],
      msgCounter: nextCounter + 1,
      lastMsgId: msgId,
    });

    setTimeout(() => {
      this.scrollToBottom();
    }, 50);

    try {
      // 新会话先创建会话，确保有 sessionId
      if (!this.data.sessionId) {
        const createResult = await chatService.createSession('新对话');
        this.setData({ sessionId: createResult.sessionId });
      }

      const result = await chatService.sendMessage(
        this.data.sessionId,
        content,
        null,
        this.data.deepThink,
        this._testMaterial || null
      );
      this._testMaterial = null; // 测试材料只注入首次

      const updateData = {};
      if (result.sessionId) {
        updateData.sessionId = result.sessionId;
      }

      this.setData(updateData);

      await this.typewriterEffect(result.reply || '');

      // 刷新会话列表（后台更新标题等）
      this.fetchSessionList();

      this.scrollToBottom();
    } catch (err) {
      console.error('[chat] 发送消息失败:', err);

      // 尝试重新加载消息（可能云函数已成功执行但超时）
      if (this.data.sessionId) {
        this.retryLoadMessages(msgId);
      } else {
        const msgs = this.data.messages.filter(m => m.msgId !== msgId);
        this.setData({ messages: msgs });
        this.showToast('网络开小差了~');
      }
    } finally {
      this.setData({
        isLoading: false,
        isTyping: false,
      });
    }
  },

  // 深度思考开关
  onToggleDeepThink() {
    const deepThink = !this.data.deepThink;
    this.setData({ deepThink });
    wx.vibrateShort({ type: 'light' });
    this.showToast(deepThink ? '⚡ 已开启深度思考，回答更详细' : '已关闭深度思考');
  },

  // ============================================================
  // 打字机效果（优化版）
  // ============================================================

  typewriterEffect(fullText) {
    return new Promise((resolve) => {
      const msgs = [...this.data.messages];
      const lastMsgIndex = msgs.length - 1;
      const lastMsg = msgs[lastMsgIndex];
      if (!lastMsg || lastMsg.role !== 'assistant') {
        resolve();
        return;
      }

      const totalLength = fullText.length;
      let index = 0;
      const baseStep = totalLength > 500 ? 12 : (totalLength > 200 ? 8 : 4);

      let animationFrameId = null;

      const render = () => {
        if (index >= totalLength) {
          this.setData({
            messages: msgs.map((m, i) => 
              i === lastMsgIndex ? { ...m, content: fullText } : m
            ),
            lastMsgId: lastMsg.msgId,
          });
          resolve();
          return;
        }

        const step = Math.min(baseStep, totalLength - index);
        index += step;
        const displayText = fullText.substring(0, index);

        msgs[lastMsgIndex] = { ...msgs[lastMsgIndex], content: displayText };

        // 打字机期间不设置 lastMsgId：避免强制滚动打断用户上翻阅读
        this.setData({
          messages: [...msgs],
        });

        const speed = totalLength > 500 ? 25 : (totalLength > 200 ? 35 : 45);
        animationFrameId = setTimeout(() => render(), speed);
      };

      render();
    });
  },

  addMessageWithCounter(role, content, counter) {
    const msgId = 'msg-' + counter;
    const msg = {
      msgId,
      role,
      content,
      time: formatTime(new Date()),
    };

    this.setData({
      messages: [...this.data.messages, msg],
      lastMsgId: msgId,
    });
  },

  addMessage(role, content) {
    const newCounter = this.data.msgCounter + 1;
    this.addMessageWithCounter(role, content, newCounter);
    this.setData({ msgCounter: newCounter });
  },

  // ============================================================
  // 语音输入（占位实现）
  // ============================================================

  onVoiceInput() {
    this.showToast('语音功能正在开发中~请先使用文字输入');
  },

  copyMessage(e) {
    const content = e.currentTarget.dataset.content;
    wx.setClipboardData({
      data: content,
      success: () => {
        this.showToast('已复制');
      },
    });
  },

  // ============================================================
  // 滚动 / Toast
  // ============================================================

  scrollToBottom() {
    this.setData({ lastMsgId: 'scroll-bottom', showScrollToBottom: false });
  },

  onMsgScroll(e) {
    const { scrollTop, scrollHeight, windowHeight } = e.detail;
    const distanceToBottom = scrollHeight - scrollTop - windowHeight;
    this.setData({
      showScrollToBottom: distanceToBottom > 300,
    });
  },

  showToast(text) {
    wx.showToast({
      title: text,
      icon: 'none',
      duration: 2500,
    });
  },

});
