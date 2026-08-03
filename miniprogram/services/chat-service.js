/**
 * 数学小伴 — 对话服务层
 *
 * 封装对 math-agent 云函数的调用，
 * 提供简洁的接口供页面调用。
 */

const FUNCTION_NAME = 'math-agent';

/**
 * 发送消息并获取 AI 回复
 *
 * @param {string|null} sessionId - 会话 ID（新会话传 null）
 * @param {string} content - 用户消息
 * @param {string} [topic] - 知识点话题
 * @param {boolean} [deepThink] - 是否开启深度思考（更高质量回答）
 * @returns {Promise<{reply: string, sessionId: string, emotion: string}>}
 */
function sendMessage(sessionId, content, topic, deepThink) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: FUNCTION_NAME,
      data: {
        type: 'sendMessage',
        data: {
          sessionId: sessionId || null,
          content: content,
          topic: topic || null,
          deepThink: !!deepThink,
        },
      },
      success: (res) => {
        const result = res.result || {};

        if (result.code === 0) {
          resolve(result.data);
        } else {
          reject(new Error(result.error || '请求失败'));
        }
      },
      fail: (err) => {
        console.error('[chat-service] sendMessage 调用失败:', err);
        const errMsg = (err && err.errMsg) || (typeof err === 'string' ? err : JSON.stringify(err));
        reject(new Error('错误: ' + errMsg));
      },
    });
  });
}

/**
 * 获取学习总结
 *
 * @param {'all' | 'recent'} scope - 总结范围
 * @returns {Promise<{summary: string, topicsCovered: Array, totalSessions: number}>}
 */
function getSummary(scope = 'recent') {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: FUNCTION_NAME,
      data: {
        type: 'getSummary',
        data: { scope },
      },
      success: (res) => {
        const result = res.result || {};

        if (result.code === 0) {
          resolve(result.data);
        } else {
          reject(new Error(result.error || '请求失败'));
        }
      },
      fail: (err) => {
        console.error('[chat-service] getSummary 调用失败:', err);
        const errMsg = (err && err.errMsg) || (typeof err === 'string' ? err : JSON.stringify(err));
        reject(new Error('错误: ' + errMsg));
      },
    });
  });
}

/**
 * 获取指定会话的历史消息
 *
 * @param {string} sessionId - 会话 ID
 * @param {number} [page=1] - 页码
 * @param {number} [pageSize=50] - 每页条数
 * @returns {Promise<{messages: Array, total: number, hasMore: boolean}>}
 */
function getMessages(sessionId, page = 1, pageSize = 50) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: FUNCTION_NAME,
      data: {
        type: 'getMessages',
        data: { sessionId, page, pageSize },
      },
      success: (res) => {
        const result = res.result || {};
        if (result.code === 0) {
          resolve(result.data);
        } else {
          reject(new Error(result.error || '获取消息失败'));
        }
      },
      fail: (err) => {
        console.error('[chat-service] getMessages 调用失败:', err);
        reject(new Error('网络请求失败'));
      },
    });
  });
}

/**
 * 获取会话列表
 * @returns {Promise<Array>} 会话列表
 */
function getSessions() {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: FUNCTION_NAME,
      data: { type: 'getSessions' },
      success: (res) => {
        const result = res.result || {};
        if (result.code === 0) {
          resolve(result.data || []);
        } else {
          reject(new Error(result.error || '获取失败'));
        }
      },
      fail: (err) => {
        console.error('[chat-service] getSessions 调用失败:', err);
        reject(new Error('网络请求失败'));
      },
    });
  });
}

/**
 * 手动创建新会话
 * @param {string} [title] - 会话标题
 * @returns {Promise<{sessionId: string}>}
 */
function createSession(title) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: FUNCTION_NAME,
      data: {
        type: 'createSession',
        data: { title: title || null },
      },
      success: (res) => {
        const result = res.result || {};
        if (result.code === 0) {
          resolve(result.data);
        } else {
          reject(new Error(result.error || '创建失败'));
        }
      },
      fail: (err) => {
        console.error('[chat-service] createSession 调用失败:', err);
        reject(new Error('网络请求失败'));
      },
    });
  });
}

/**
 * 删除会话（软删除）
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<{success: boolean}>}
 */
function deleteSession(sessionId) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: FUNCTION_NAME,
      data: {
        type: 'deleteSession',
        data: { sessionId },
      },
      success: (res) => {
        const result = res.result || {};
        if (result.code === 0) {
          resolve(result.data);
        } else {
          reject(new Error(result.error || '删除失败'));
        }
      },
      fail: (err) => {
        console.error('[chat-service] deleteSession 调用失败:', err);
        reject(new Error('网络请求失败'));
      },
    });
  });
}

/**
 * 重命名会话
 * @param {string} sessionId - 会话 ID
 * @param {string} title - 新标题
 * @returns {Promise<{success: boolean}>}
 */
function renameSession(sessionId, title) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: FUNCTION_NAME,
      data: {
        type: 'renameSession',
        data: { sessionId, title },
      },
      success: (res) => {
        const result = res.result || {};
        if (result.code === 0) {
          resolve(result.data);
        } else {
          reject(new Error(result.error || '重命名失败'));
        }
      },
      fail: (err) => {
        console.error('[chat-service] renameSession 调用失败:', err);
        reject(new Error('网络请求失败'));
      },
    });
  });
}

function getProfile() {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: FUNCTION_NAME,
      data: { type: 'getProfile' },
      success: (res) => {
        const result = res.result || {};
        if (result.code === 0) {
          resolve(result.data);
        } else {
          reject(new Error(result.error || '获取档案失败'));
        }
      },
      fail: (err) => {
        console.error('[chat-service] getProfile 调用失败:', err);
        reject(new Error('网络请求失败'));
      },
    });
  });
}

function updateProfile(data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: FUNCTION_NAME,
      data: {
        type: 'updateProfile',
        data,
      },
      success: (res) => {
        const result = res.result || {};
        if (result.code === 0) {
          resolve(result.data);
        } else {
          reject(new Error(result.error || '更新失败'));
        }
      },
      fail: (err) => {
        console.error('[chat-service] updateProfile 调用失败:', err);
        reject(new Error('网络请求失败'));
      },
    });
  });
}

module.exports = { sendMessage, getSummary, getMessages, getSessions, createSession, deleteSession, renameSession, getProfile, updateProfile };
