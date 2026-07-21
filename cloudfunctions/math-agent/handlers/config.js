const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 获取配置（system prompt 等）
 */
async function getConfig() {
  try {
    const res = await db.collection('mt_config').where({ key: 'systemPrompt' }).limit(1).get();
    const systemPrompt = res.data.length > 0 ? res.data[0].value : '';
    return { code: 0, data: { systemPrompt } };
  } catch (e) {
    return { code: 0, data: { systemPrompt: '' } };
  }
}

/**
 * 保存配置
 */
async function setConfig(data) {
  if (!data || !data.systemPrompt) {
    return { code: 400, error: '提示词不能为空' };
  }
  try {
    const existing = await db.collection('mt_config').where({ key: 'systemPrompt' }).limit(1).get();
    if (existing.data.length > 0) {
      await db.collection('mt_config').doc(existing.data[0]._id).update({
        data: { value: data.systemPrompt, updatedAt: db.serverDate() },
      });
    } else {
      await db.collection('mt_config').add({
        data: { key: 'systemPrompt', value: data.systemPrompt, createdAt: db.serverDate() },
      });
    }
    return { code: 0, message: '保存成功' };
  } catch (e) {
    return { code: 500, error: '保存失败: ' + e.message };
  }
}

module.exports = { getConfig, setConfig };
