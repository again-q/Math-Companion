/**
 * DeepSeek 超时问题定位脚本
 * 用法：export DEEPSEEK_API_KEY=sk-你的key && node test-deepseek-timeout.js
 * 对比：对话续写 vs 学习总结 两种请求的响应耗时
 */
const https = require('https');

const apiKey = process.env.DEEPSEEK_API_KEY || '';
if (!apiKey) {
  console.error('请先设置环境变量: export DEEPSEEK_API_KEY=sk-你的key');
  process.exit(1);
}

function call(prompt, userMsg, maxTokens = 2048) {
  const body = JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: userMsg },
    ],
    temperature: 0.7,
    max_tokens: maxTokens,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 60000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
        try {
          const json = JSON.parse(data);
          resolve(json.choices[0].message.content.length);
        } catch (e) {
          reject(new Error('解析失败: ' + e.message));
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('60s 超时')); });
    req.on('error', (e) => reject(new Error(e.message)));
    req.write(body);
    req.end();
  });
}

async function main() {
  // 测试1：对话续写（模拟 sendMessage）
  console.log('=== 测试1: 对话续写（sendMessage 风格） ===');
  const t1 = Date.now();
  try {
    const len1 = await call('你是一位幽默的数学老师，用生活例子讲解，先引导再讲解。', '一元二次方程怎么解？用篮球例子讲讲，顺便出道题');
    console.log(`✅ ${Date.now() - t1}ms，回复 ${len1} 字符`);
  } catch (e) {
    console.log(`❌ ${Date.now() - t1}ms，失败: ${e.message}`);
  }

  // 测试2：学习总结（getSummary 风格）
  console.log('\n=== 测试2: 学习总结（getSummary 风格） ===');
  const t2 = Date.now();
  try {
    const len2 = await call(
      '你是一个温暖贴心的学习陪伴者「数学小伴」。根据学生档案和学习数据，生成一段完整的学习总结。要求：纯文本，不要 JSON，300~500字，自然分段，覆盖学习概况/掌握的知识点/薄弱环节/进步亮点/下一步建议/鼓励的话，引用学生名字兴趣，语气温暖鼓励。',
      '## 学生档案\n- 昵称：小明\n- 年级：初三\n- 薄弱点：二次函数、圆\n- 兴趣：篮球、动漫\n- 学习偏好：喜欢例子和故事\n\n## 学习数据\n学习天数：14天 | 学习次数：8次 | 消息数：76条\n\n## 知识点\n- 一元二次方程: 掌握（练习6次）\n- 二次函数: 了解（练习5次）\n- 圆: 初识（练习4次）\n- 反比例函数: 熟练（练习3次）'
    );
    console.log(`✅ ${Date.now() - t2}ms，回复 ${len2} 字符`);
  } catch (e) {
    console.log(`❌ ${Date.now() - t2}ms，失败: ${e.message}`);
  }
}

main();
