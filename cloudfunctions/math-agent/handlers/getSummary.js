/**
 * getSummary — 学习总结处理器
 *
 * 生成学习历程总结，返回给小程序展示。
 */
const { generateSummary } = require('../services/conversation');

/**
 * 处理学习总结请求
 * @param {object} data - 请求数据 { scope: 'all' | 'recent' }
 * @returns {Promise<object>} { summary, topicsCovered, totalSessions }
 */
async function getSummary(data, context) {
  try {
    const result = await generateSummary({
      scope: data?.scope || 'recent',
    });

    return {
      code: 0,
      data: result,
    };
  } catch (err) {
    console.error('[math-agent] getSummary 失败:', err.message);
    return { code: 500, error: '生成总结失败，请稍后再试' };
  }
}

module.exports = { getSummary };
