/**
 * 简单网页搜索（必应中国版 cn.bing.com，大陆可达、免费无需 key）
 * 用于单元测试时获取教材参考资料，辅助 AI 出题
 */
const https = require('https');

/**
 * 从必应搜索结果 HTML 中提取标题与摘要文本
 */
function parseBingHtml(html) {
  const parts = [];
  // 提取 b_algo 结果块
  const blockRe = /<li class="b_algo"[\s\S]*?<\/li>/g;
  let match;
  let count = 0;
  while ((match = blockRe.exec(html)) !== null && count < 5) {
    const block = match[0];
    const titleM = /<h2[\s\S]*?<\/h2>/.exec(block);
    if (titleM) {
      const title = titleM[0].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim();
      if (title) parts.push(title);
    }
    const pM = /<p[^>]*>[\s\S]*?<\/p>/.exec(block);
    if (pM) {
      const desc = pM[0].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
      if (desc && desc.length > 15) parts.push(desc);
    }
    count++;
  }
  return parts.join('\n').slice(0, 2000);
}

/**
 * 搜索并返回简要文本结果
 * @param {string} query - 搜索词
 * @param {number} timeout - 超时（毫秒）
 * @returns {Promise<string>} 搜索结果文本（失败返回空字符串）
 */
function searchWeb(query, timeout = 8000) {
  return new Promise((resolve) => {
    const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}`;
    const req = https.get(url, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        resolve(parseBingHtml(data));
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(''); });
    req.on('error', (e) => {
      console.warn('[search] 搜索失败:', e.message);
      resolve('');
    });
    req.end();
  });
}

module.exports = { searchWeb };
