const https = require('https');

const apiKey = process.env.DEEPSEEK_API_KEY || '';

if (!apiKey) {
  console.error('未配置 DEEPSEEK_API_KEY，请先执行: export DEEPSEEK_API_KEY=sk-你的key');
  process.exit(1);
}

const baseUrl = 'https://api.deepseek.com';
const model = 'deepseek-chat';

async function callDeepSeek(userMessage) {
  const urlObj = new URL(`${baseUrl}/chat/completions`);
  
  const systemPrompt = `你是一位数学辅导老师，正在辅导一位初三学生。

## 教学原则
- 用提问引导学生自己推导出答案，不直接给结果
- 把复杂问题拆解成简单的小步骤
- 用生活中的例子帮助理解抽象概念
- 学生卡住时给提示，不替学生做题
- 表扬学生的思考过程和具体努力，不说"你真聪明"
- 如果连续引导2次仍答不出，建议换种方式讲解
- 学生说不想学时，先聊聊别的放松一下

## 对话风格
- 自然、专业、温暖
- 当学生理解有困难时，可以讲故事或生活例子
- 学生状态好时用提问引导思考
- 学生疲倦或抗拒时先聊天放松
- 根据对话上下文自然调整节奏

## 当前教学进度
（新会话，暂无历史记录）

## 当前知识点
数学`;

  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `学生问：${userMessage}` },
    ],
    temperature: 0.7,
    max_tokens: 1024,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`API 返回 ${res.statusCode}: ${data}`));
          return;
        }
        try {
          const result = JSON.parse(data);
          const reply = result.choices?.[0]?.message?.content || '';
          if (!reply) {
            reject(new Error('API 返回空回复'));
            return;
          }
          resolve(reply);
        } catch (e) {
          reject(new Error(`解析响应失败: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`网络请求失败: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.write(body);
    req.end();
  });
}

async function test() {
  console.log('=== 测试 DeepSeek API ===\n');
  
  const testMessages = ['测试消息', '你好', '什么是一元二次方程'];
  
  for (const msg of testMessages) {
    console.log(`测试消息: "${msg}"`);
    console.log('--------------------------');
    try {
      const startTime = Date.now();
      const reply = await callDeepSeek(msg);
      const duration = Date.now() - startTime;
      console.log(`响应时间: ${duration}ms`);
      console.log(`回复内容:\n${reply}`);
      console.log('');
    } catch (err) {
      console.log(`错误: ${err.message}`);
      console.log('');
    }
  }
}

test().catch(console.error);