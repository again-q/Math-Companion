/**
 * getMessages — 获取会话消息列表
 *
 * 供记忆页点击历史会话后，对话页拉取云端历史消息。
 */
const { getMessages } = require('../services/memory');

/**
 * 获取指定会话的消息列表
 * @param {object} data - { sessionId, page?, pageSize? }
 * @returns {Promise<object>} { messages, total, hasMore }
 */
async function handleGetMessages(data) {
  const { sessionId, page, pageSize } = data || {};

  if (!sessionId || typeof sessionId !== 'string') {
    return { code: 400, error: 'sessionId 不能为空' };
  }

  try {
    const result = await getMessages(
      sessionId,
      page || 1,
      Math.min(pageSize || 50, 100)
    );

    return {
      code: 0,
      data: result,
    };
  } catch (err) {
    console.error('[math-agent] getMessages 失败:', err.message);
    return { code: 500, error: '获取消息失败' };
  }
}

module.exports = { handleGetMessages };
