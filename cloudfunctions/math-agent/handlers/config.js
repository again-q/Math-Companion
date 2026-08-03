const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 获取配置（system prompt 等）
 */
async function getConfig() {
  try {
    const res = await db.collection('mt_config').where({ key: 'systemPrompt', _openid: getOpenId() || '__anon__' }).limit(1).get();
    const systemPrompt = res.data.length > 0 ? res.data[0].value : '';
    return { code: 0, data: { systemPrompt } };
  } catch (e) {
    return { code: 0, data: { systemPrompt: '' } };
  }
}

/**
 * 保存配置
 * 原设计：systemPrompt 留空 = 使用默认人设（agent.js 里 getCustomPrompt 为空时回退默认）
 */
async function setConfig(data) {
  if (!data || typeof data.systemPrompt !== 'string') {
    return { code: 400, error: '参数不完整' };
  }
  if (data.systemPrompt.length > 5000) {
    return { code: 400, error: '提示词过长（最多 5000 字）' };
  }
  try {
    const existing = await db.collection('mt_config').where({ key: 'systemPrompt', _openid: getOpenId() || '__anon__' }).limit(1).get();
    if (existing.data.length > 0) {
      await db.collection('mt_config').doc(existing.data[0]._id).update({
        data: { value: data.systemPrompt, updatedAt: db.serverDate() },
      });
    } else {
      await db.collection('mt_config').add({
        data: { key: 'systemPrompt', _openid: getOpenId() || '__anon__', value: data.systemPrompt, createdAt: db.serverDate() },
      });
    }
    return { code: 0, message: '保存成功' };
  } catch (e) {
    return { code: 500, error: '保存失败: ' + ((e && (e.message || e.errMsg)) || '未知错误') };
  }
}

module.exports = { getConfig, setConfig };
