/**
 * 单元水平测试相关 handler
 * getUnitMaterial：搜索人教版教材资料，供 AI 出题参考
 */
const { searchWeb } = require('../lib/search');

/**
 * 获取单元教材参考材料（DuckDuckGo 搜索，失败返回空）
 * @param {object} data - { unit: '初一上册' }
 */
async function getUnitMaterial(data) {
  const unit = (data && data.unit || '').trim();
  if (!unit) {
    return { code: 400, error: '缺少单元名' };
  }

  try {
    // 搜该知识点的定义/公式（人教版），搜索词更具体有助于返回概念本身
    const q1 = `${unit} 定义 公式 人教版 初中数学`;
    const material = await searchWeb(q1, 8000);

    // 结果太短则补充搜索
    let extra = '';
    if (material.length < 300) {
      const q2 = `初一 ${unit} 数学 主要知识点 重点`;
      extra = await searchWeb(q2, 8000);
    }

    const result = [material, extra].filter(Boolean).join('\n').trim();
    return { code: 0, data: { unit, material: result } };
  } catch (e) {
    console.error('[math-agent] 获取单元材料失败:', e.message);
    return { code: 0, data: { unit, material: '' } }; // 失败不阻断测试
  }
}

module.exports = { getUnitMaterial };
