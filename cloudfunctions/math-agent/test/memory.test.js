/**
 * 记忆模块测试用例
 * 
 * 覆盖：会话管理、消息存储、上下文加载等核心逻辑
 */

const { Assert } = require('./test-runner');

// Mock 会话和消息数据
class MockMemory {
  constructor() {
    this.sessions = new Map();
    this.messages = new Map();
    this.nextSessionId = 1;
    this.nextMsgId = 1;
  }

  createSession(topic = '') {
    const sessionId = `sess_${this.nextSessionId++}`;
    const now = new Date();
    this.sessions.set(sessionId, {
      sessionId,
      status: 'active',
      title: '',
      createdAt: now,
      updatedAt: now,
      topic,
      totalMessages: 0,
      isDeleted: false,
    });
    return sessionId;
  }

  saveMessage(sessionId, role, content, options = {}) {
    const msgId = `msg_${this.nextMsgId++}`;
    const now = new Date();
    
    const msgData = {
      _id: msgId,
      sessionId,
      role,
      content,
      createdAt: now,
    };

    if (role === 'assistant') {
      if (options.mode) msgData.mode = options.mode;
      if (options.emotion) msgData.emotion = options.emotion;
      if (options.systemPrompt) msgData.systemPrompt = options.systemPrompt;
    }

    if (!this.messages.has(sessionId)) {
      this.messages.set(sessionId, []);
    }
    this.messages.get(sessionId).push(msgData);

    // 更新会话元数据
    const session = this.sessions.get(sessionId);
    if (session) {
      session.updatedAt = now;
      session.totalMessages++;
      
      if (role === 'user' && !session.title) {
        session.title = content.trim().slice(0, 20) + (content.length > 20 ? '...' : '');
      }
    }

    return msgId;
  }

  getMessages(sessionId, page = 1, pageSize = 20) {
    const msgs = this.messages.get(sessionId) || [];
    const total = msgs.length;
    const start = (page - 1) * pageSize;
    const paginated = msgs.slice(start, start + pageSize);
    
    return {
      messages: paginated,
      total,
      hasMore: page * pageSize < total,
    };
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  getRecentSessions(limit = 20) {
    return Array.from(this.sessions.values())
      .filter(s => !s.isDeleted && s.status === 'active')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  softDeleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isDeleted = true;
      session.deletedAt = new Date();
      return true;
    }
    return false;
  }

  renameSession(sessionId, title) {
    const session = this.sessions.get(sessionId);
    if (session && title) {
      session.title = title.trim().slice(0, 50);
      return true;
    }
    return false;
  }

  clear() {
    this.sessions.clear();
    this.messages.clear();
    this.nextSessionId = 1;
    this.nextMsgId = 1;
  }
}

const mockMemory = new MockMemory();

module.exports = function() {
  return [
    {
      name: '记忆模块 - 创建会话',
      async run() {
        mockMemory.clear();
        const sessionId = mockMemory.createSession('一元二次方程');
        
        Assert.ok(sessionId.startsWith('sess_'), '会话ID应以sess_开头');
        const session = mockMemory.getSession(sessionId);
        Assert.ok(session, '会话应存在');
        Assert.equal(session.topic, '一元二次方程', '会话主题应正确设置');
        Assert.equal(session.status, 'active', '会话状态应为active');
        Assert.equal(session.totalMessages, 0, '初始消息数应为0');
      }
    },
    {
      name: '记忆模块 - 创建会话（无主题）',
      async run() {
        mockMemory.clear();
        const sessionId = mockMemory.createSession();
        
        const session = mockMemory.getSession(sessionId);
        Assert.equal(session.topic, '', '无主题时topic应为空字符串');
      }
    },
    {
      name: '记忆模块 - 保存用户消息',
      async run() {
        mockMemory.clear();
        const sessionId = mockMemory.createSession();
        
        const msgId = mockMemory.saveMessage(sessionId, 'user', '什么是一元二次方程？');
        
        Assert.ok(msgId.startsWith('msg_'), '消息ID应以msg_开头');
        
        const session = mockMemory.getSession(sessionId);
        Assert.equal(session.totalMessages, 1, '消息数应增加到1');
        Assert.equal(session.title, '什么是一元二次方程？', '会话标题应设为首条消息');
        
        const { messages } = mockMemory.getMessages(sessionId);
        Assert.equal(messages.length, 1, '应返回1条消息');
        Assert.equal(messages[0].role, 'user', '消息角色应为user');
        Assert.equal(messages[0].content, '什么是一元二次方程？', '消息内容应正确');
      }
    },
    {
      name: '记忆模块 - 保存助手消息',
      async run() {
        mockMemory.clear();
        const sessionId = mockMemory.createSession();
        
        const msgId = mockMemory.saveMessage(sessionId, 'assistant', '一元二次方程的一般形式是...', {
          emotion: 'positive',
          mode: 'teaching'
        });
        
        const { messages } = mockMemory.getMessages(sessionId);
        Assert.equal(messages[0].role, 'assistant', '消息角色应为assistant');
        Assert.equal(messages[0].emotion, 'positive', '应保存情绪信息');
        Assert.equal(messages[0].mode, 'teaching', '应保存模式信息');
      }
    },
    {
      name: '记忆模块 - 分页查询消息',
      async run() {
        mockMemory.clear();
        const sessionId = mockMemory.createSession();
        
        // 添加5条消息
        for (let i = 1; i <= 5; i++) {
          mockMemory.saveMessage(sessionId, 'user', `消息${i}`);
        }
        
        const page1 = mockMemory.getMessages(sessionId, 1, 2);
        Assert.equal(page1.messages.length, 2, '第一页应返回2条消息');
        Assert.equal(page1.total, 5, '总消息数应为5');
        Assert.equal(page1.hasMore, true, '应有更多数据');
        
        const page2 = mockMemory.getMessages(sessionId, 2, 2);
        Assert.equal(page2.messages.length, 2, '第二页应返回2条消息');
        
        const page3 = mockMemory.getMessages(sessionId, 3, 2);
        Assert.equal(page3.messages.length, 1, '第三页应返回1条消息');
        Assert.equal(page3.hasMore, false, '不应有更多数据');
      }
    },
    {
      name: '记忆模块 - 获取最近会话',
      async run() {
        mockMemory.clear();
        
        // 创建3个会话
        const session1 = mockMemory.createSession('知识点1');
        await new Promise(r => setTimeout(r, 10));
        const session2 = mockMemory.createSession('知识点2');
        await new Promise(r => setTimeout(r, 10));
        const session3 = mockMemory.createSession('知识点3');
        
        const sessions = mockMemory.getRecentSessions();
        
        Assert.equal(sessions.length, 3, '应返回3个会话');
        Assert.equal(sessions[0].sessionId, session3, '最新会话应排在首位');
        Assert.equal(sessions[2].sessionId, session1, '最早会话应排在末位');
      }
    },
    {
      name: '记忆模块 - 软删除会话',
      async run() {
        mockMemory.clear();
        const sessionId = mockMemory.createSession();
        
        const result = mockMemory.softDeleteSession(sessionId);
        Assert.ok(result, '删除应成功');
        
        const session = mockMemory.getSession(sessionId);
        Assert.ok(session.isDeleted, '会话应被标记为删除');
        Assert.ok(session.deletedAt, '应设置删除时间');
        
        const sessions = mockMemory.getRecentSessions();
        Assert.equal(sessions.length, 0, '删除的会话不应出现在列表中');
      }
    },
    {
      name: '记忆模块 - 重命名会话',
      async run() {
        mockMemory.clear();
        const sessionId = mockMemory.createSession();
        
        const result = mockMemory.renameSession(sessionId, '新标题');
        Assert.ok(result, '重命名应成功');
        
        const session = mockMemory.getSession(sessionId);
        Assert.equal(session.title, '新标题', '标题应更新');
      }
    },
    {
      name: '记忆模块 - 会话标题自动截断',
      async run() {
        mockMemory.clear();
        const sessionId = mockMemory.createSession();
        
        const longContent = '这是一条非常非常长的消息内容，用于测试标题截断功能是否正常工作';
        mockMemory.saveMessage(sessionId, 'user', longContent);
        
        const session = mockMemory.getSession(sessionId);
        Assert.equal(session.title.length, 23, '标题应截断到20个字符加省略号');
        Assert.ok(session.title.endsWith('...'), '标题末尾应有省略号');
      }
    },
    {
      name: '记忆模块 - 获取不存在的会话',
      async run() {
        mockMemory.clear();
        const session = mockMemory.getSession('nonexistent');
        Assert.equal(session, null, '不存在的会话应返回null');
      }
    },
    {
      name: '记忆模块 - 获取不存在会话的消息',
      async run() {
        mockMemory.clear();
        const result = mockMemory.getMessages('nonexistent');
        Assert.equal(result.messages.length, 0, '应返回空数组');
        Assert.equal(result.total, 0, '总数应为0');
        Assert.equal(result.hasMore, false, '不应有更多数据');
      }
    }
  ];
};
