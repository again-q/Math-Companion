/**
 * sendMessage — 发送消息处理器
 *
 * 接收小程序发来的用户消息，返回 AI 回复。
 */
const { handleMessage } = require('../services/conversation');
const { addExp } = require('./profile');

async function sendMessage(data, context) {
  if (!data || !data.content || typeof data.content !== 'string') {
    return { code: 400, error: '消息内容不能为空' };
  }
  if (data.content.length > 2000) {
    return { code: 400, error: '消息内容过长' };
  }

  try {
    const result = await handleMessage({
      sessionId: data.sessionId || null,
      content: data.content.trim(),
      topic: data.topic || null,
      deepThink: data.deepThink || false,
      material: data.material || null,
    });

    await addExp(10);

    return {
      code: 0,
      data: {
        reply: result.reply,
        sessionId: result.sessionId,
        emotion: result.emotion,
      },
    };
  } catch (err) {
    console.error('[math-agent] sendMessage 失败:', err.message, err.stack);

    if (err.message.includes('DeepSeek')) {
      return { code: 500, error: 'AI 服务暂时不可用，请稍后再试~' };
    }
    if (err.message.includes('collection')) {
      return { code: 500, error: '数据库集合不存在，请在云开发控制台创建 mt_sessions/mt_messages/mt_knowledge_progress' };
    }

    return { code: 500, error: '小伴有点累了，稍后再试~ 错误: ' + ((err && (err.message || err.errMsg)) || '未知错误') };
  }
}

module.exports = { sendMessage };
