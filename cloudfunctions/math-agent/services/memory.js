/**
 * 数学小伴 — 记忆模块
 *
 * 全量记忆的存储与检索：
 * - 会话管理（sessions 集合）
 * - 消息持久化（messages 集合）
 * - 知识点进度跟踪（knowledge_progress 集合）
 *
 * 所有操作通过 wx-server-sdk 云数据库 API 完成。
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const config = require('../config/index');

const _ = db.command;

// ============================================================
// 自动建集合（首次启动时）
// ============================================================
const REQUIRED_COLLECTIONS = ['mt_sessions', 'mt_messages', 'mt_knowledge_progress'];

async function ensureCollections() {
  for (const name of REQUIRED_COLLECTIONS) {
    try {
      await db.createCollection(name);
      console.log(`[math-agent] 已创建集合: ${name}`);
    } catch (e) {
      // 集合已存在，忽略
    }
  }
}
ensureCollections();

// ============================================================
// 1. 会话管理
// ============================================================

/**
 * 获取会话
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<object|null>} 会话文档或 null
 */
async function getSession(sessionId) {
  if (!sessionId) return null;

  const res = await db.collection('mt_sessions')
    .where({ sessionId, status: 'active', isDeleted: _.neq(true) })
    .limit(1)
    .get();

  return res.data.length > 0 ? res.data[0] : null;
}

/**
 * 创建新会话
 * @param {string} [topic] - 知识点话题（可选）
 * @returns {Promise<string>} 新会话 ID
 */
async function createSession(topic) {
  const { nanoid } = require('nanoid');
  const sessionId = 'sess_' + nanoid(16);
  const now = new Date();

  await db.collection('mt_sessions').add({
    data: {
      sessionId,
      status: 'active',
      // 会话标题 = 知识点名 或 闲聊
      title: topic || '闲聊',
      createdAt: now,
      updatedAt: now,
      topic: topic || '',
      totalMessages: 0,
      isDeleted: false,
    },
  });

  return sessionId;
}

/**
 * 手动创建空白会话（从记忆页新建）
 * @param {string} [title] - 会话标题
 * @returns {Promise<string>} 新会话 ID
 */
async function createSessionManual(title) {
  const { nanoid } = require('nanoid');
  const sessionId = 'sess_' + nanoid(16);
  const now = new Date();

  await db.collection('mt_sessions').add({
    data: {
      sessionId,
      status: 'active',
      title: title || '新对话',
      createdAt: now,
      updatedAt: now,
      topic: '',
      totalMessages: 0,
      isDeleted: false,
    },
  });

  return sessionId;
}

/**
 * 软删除会话
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<boolean>} 是否成功
 */
async function softDeleteSession(sessionId) {
  if (!sessionId) return false;

  const res = await db.collection('mt_sessions')
    .where({ sessionId })
    .update({
      data: {
        isDeleted: true,
        deletedAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    });

  return res.stats.updated > 0;
}

/**
 * 重命名会话
 * @param {string} sessionId - 会话 ID
 * @param {string} title - 新标题
 * @returns {Promise<boolean>} 是否成功
 */
async function renameSession(sessionId, title) {
  if (!sessionId || !title) return false;

  const res = await db.collection('mt_sessions')
    .where({ sessionId })
    .update({
      data: {
        title: title.trim().slice(0, 50),
        updatedAt: db.serverDate(),
      },
    });

  return res.stats.updated > 0;
}

/**
 * 获取最近活跃会话列表（过滤软删除）
 * @param {number} [limit=20] - 返回数量
 * @returns {Promise<Array>} 会话列表
 */
async function getRecentSessions(limit = 20) {
  const res = await db.collection('mt_sessions')
    .where({ isDeleted: _.neq(true), status: 'active' })
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get();

  return res.data;
}

// ============================================================
// 2. 消息管理
// ============================================================

/**
 * 保存消息
 * @param {string} sessionId - 会话 ID
 * @param {string} role - 'user' | 'assistant'
 * @param {string} content - 消息内容
 * @param {object} [options] - 可选参数 { mode?, emotion? }
 * @returns {Promise<string>} 消息 ID
 */
async function saveMessage(sessionId, role, content, options = {}) {
  const now = new Date();

  const msgData = {
    sessionId,
    role,
    content,
    createdAt: now,
  };

  if (role === 'assistant') {
    if (options.mode) msgData.mode = options.mode;
    if (options.emotion) msgData.emotion = options.emotion;
  }

  const res = await db.collection('mt_messages').add({ data: msgData });

  // 更新会话元数据
  // 1) 总是更新时间 + 递增计数
  await db.collection('mt_sessions')
    .where({ sessionId })
    .update({
      data: {
        updatedAt: now,
        totalMessages: _.inc(1),
      },
    });

  // 2) 首条用户消息自动设置标题
  if (role === 'user') {
    await db.collection('mt_sessions')
      .where({ sessionId, title: '' })
      .update({
        data: {
          title: content.trim().slice(0, 20) + (content.length > 20 ? '...' : ''),
        },
      });
  }

  return res._id;
}

/**
 * 分页查询消息
 * @param {string} sessionId - 会话 ID
 * @param {number} [page=1] - 页码（从 1 开始）
 * @param {number} [pageSize=20] - 每页条数
 * @returns {Promise<{messages: Array, total: number, hasMore: boolean}>}
 */
async function getMessages(sessionId, page = 1, pageSize = 20) {
  // 限制 pageSize 最大 50
  const size = Math.min(pageSize, 50);

  const countRes = await db.collection('mt_messages')
    .where({ sessionId })
    .count();
  const total = countRes.total;

  const res = await db.collection('mt_messages')
    .where({ sessionId })
    .orderBy('createdAt', 'asc')
    .skip((page - 1) * size)
    .limit(size)
    .get();

  return {
    messages: res.data,
    total,
    hasMore: page * size < total,
  };
}

// ============================================================
// 3. 知识点进度管理
// ============================================================

/**
 * 获取知识点进度
 * @param {string} topic - 知识点名称
 * @returns {Promise<object|null>} 进度文档或 null
 */
async function getTopicProgress(topic) {
  if (!topic) return null;

  const res = await db.collection('mt_knowledge_progress')
    .where({ topic })
    .limit(1)
    .get();

  return res.data.length > 0 ? res.data[0] : null;
}

/**
 * 更新知识点进度
 * @param {string} topic - 知识点名称
 * @param {object} delta - { correct?: boolean, consecutiveCorrect?: number }
 * @returns {Promise<object>} 更新后的进度文档
 */
async function updateKnowledgeProgress(topic, delta) {
  if (!topic) return null;

  const now = new Date();
  const kConfig = config.knowledge;
  const existing = await getTopicProgress(topic);

  if (!existing) {
    // 初始化
    const newDoc = {
      topic,
      level: kConfig.initialLevel,
      practicedCount: 1,
      lastPracticedAt: now,
      consecutiveCorrect: delta.consecutiveCorrect || 0,
      difficulty: 0.3,
    };

    const res = await db.collection('mt_knowledge_progress').add({ data: newDoc });
    newDoc._id = res._id;

    return newDoc;
  }

  // 更新
  const updateData = {
    practicedCount: _.inc(1),
    lastPracticedAt: now,
    consecutiveCorrect: delta.consecutiveCorrect ?? existing.consecutiveCorrect,
  };

  // 掌握程度调整：优先用 AI 判断的 levelDelta，否则按答对/答错默认增减
  if (typeof delta.levelDelta === 'number') {
    updateData.level = _.inc(delta.levelDelta);
  } else if (delta.correct === true) {
    updateData.level = _.inc(kConfig.correctIncrement);
  } else if (delta.correct === false) {
    updateData.level = _.inc(-kConfig.wrongDecrement);
  }

  // 重算难度
  const newConsecutive = delta.consecutiveCorrect ?? existing.consecutiveCorrect;
  updateData.difficulty = recalculateDifficulty(existing, newConsecutive);

  await db.collection('mt_knowledge_progress')
    .where({ topic })
    .update({ data: updateData });

  // 返回最新数据
  return await getTopicProgress(topic);
}

/**
 * 重算难度系数
 * @param {object} progress - 当前进度文档
 * @param {number} consecutiveCorrect - 连续答对次数
 * @returns {number} 新的难度系数
 */
function recalculateDifficulty(progress, consecutiveCorrect) {
  // baseDifficulty：初一=0.3, 初二=0.5, 初三=0.7（简化实现）
  const baseDifficulty = 0.5;

  // 掌握程度越好，难度越高
  const levelBoost = (progress.level || 0) * 0.3;

  // 连续答对越多，难度越高
  const correctBoost = Math.min((consecutiveCorrect || 0) * 0.1, 0.3);

  const difficulty = baseDifficulty + levelBoost + correctBoost;

  // 限制范围 [0.2, 0.8]
  return Math.max(0.2, Math.min(0.8, difficulty));
}

// ============================================================
// 4. 上下文加载
// ============================================================

/**
 * 加载对话上下文
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<object|null>} 上下文对象
 */
async function loadContext(sessionId) {
  const session = await getSession(sessionId);
  if (!session) return null;

  // 完整历史交给 API 原生多轮处理，不人工截断（上限 500 防御异常海量）
  const msgResult = await getMessages(sessionId, 1, 500);

  let progress = null;
  if (session.topic) {
    progress = await getTopicProgress(session.topic);
  }

  return {
    sessionId: session.sessionId,
    topic: session.topic,
    lastMessages: msgResult.messages,
    progress,
    messageCount: session.totalMessages,
  };
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  // 会话管理
  getSession,
  createSession,
  createSessionManual,
  softDeleteSession,
  renameSession,
  getRecentSessions,
  // 消息管理
  saveMessage,
  getMessages,
  // 知识点进度
  getTopicProgress,
  updateKnowledgeProgress,
  recalculateDifficulty,
  // 上下文
  loadContext,
};
