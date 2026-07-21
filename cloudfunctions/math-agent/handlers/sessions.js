/**
 * sessions — 会话管理处理器
 *
 * 统一处理会话的增删改查。
 */
const memory = require('../services/memory');

/**
 * 获取会话列表（过滤软删除，按更新时间倒序）
 */
async function getSessions() {
  try {
    const sessions = await memory.getRecentSessions(50);
    return { code: 0, data: sessions };
  } catch (e) {
    console.error('[math-agent] getSessions 失败:', e.message);
    return { code: 500, error: '获取会话列表失败' };
  }
}

/**
 * 手动创建新会话
 * @param {object} data - { title?: string }
 */
async function createSession(data) {
  try {
    const sessionId = await memory.createSessionManual(data?.title);
    return { code: 0, data: { sessionId } };
  } catch (e) {
    console.error('[math-agent] createSession 失败:', e.message);
    return { code: 500, error: '创建会话失败' };
  }
}

/**
 * 删除会话（软删除）
 * @param {object} data - { sessionId }
 */
async function deleteSession(data) {
  if (!data?.sessionId) {
    return { code: 400, error: 'sessionId 不能为空' };
  }

  try {
    const ok = await memory.softDeleteSession(data.sessionId);
    return { code: 0, data: { success: ok } };
  } catch (e) {
    console.error('[math-agent] deleteSession 失败:', e.message);
    return { code: 500, error: '删除会话失败' };
  }
}

/**
 * 重命名会话
 * @param {object} data - { sessionId, title }
 */
async function renameSession(data) {
  if (!data?.sessionId || !data?.title) {
    return { code: 400, error: '参数不完整' };
  }

  try {
    const ok = await memory.renameSession(data.sessionId, data.title);
    return { code: 0, data: { success: ok } };
  } catch (e) {
    console.error('[math-agent] renameSession 失败:', e.message);
    return { code: 500, error: '重命名失败' };
  }
}

module.exports = { getSessions, createSession, deleteSession, renameSession };
