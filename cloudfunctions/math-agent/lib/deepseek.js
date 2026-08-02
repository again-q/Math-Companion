/**
 * 数学小伴 — DeepSeek API 调用封装
 *
 * 封装对 DeepSeek Chat API 的 HTTP 调用，
 * 使用 Node.js https 模块（微信云函数环境兼容），
 * 支持超时、重试和错误处理。
 */
const https = require('https');
const config = require('../config/index');

/**
 * 调用 DeepSeek API
 *
 * @param {object} params - 调用参数
 * @param {string} params.systemPrompt - 系统提示词（完整人设+规则）
 * @param {string} params.userMessage - 用户消息（仅用户输入，不含指令）
 * @param {object} [options] - 可选参数
 * @param {number} [options.timeout] - 超时时间（毫秒）
 * @param {number} [options.maxRetries] - 最大重试次数
 * @returns {Promise<string>} AI 回复文本
 */
async function callDeepSeek({ systemPrompt, userMessage }, options = {}) {
  const { apiKey, baseUrl, model, timeout, maxRetries } = config.deepseek;
  const actualTimeout = options.timeout || timeout;
  const actualMaxRetries = options.maxRetries ?? maxRetries;

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY 未配置');
  }

  const urlObj = new URL(`${baseUrl}/chat/completions`);

  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 2048,
    // JSON 模式：强制结构化输出（如 AI 总结生成）
    ...(options.json ? { response_format: { type: 'json_object' } } : {}),
  });

  let lastError = null;

  for (let attempt = 0; attempt <= actualMaxRetries; attempt++) {
    try {
      const reply = await httpsRequest(urlObj, body, apiKey, actualTimeout);
      return reply.trim();
    } catch (err) {
      lastError = err;
      console.error(`[math-agent] DeepSeek 调用失败 (尝试 ${attempt + 1}/${actualMaxRetries + 1}):`, err.message);

      // 4xx 是请求本身的问题（如 key 无效、参数错误），重试无意义，直接抛出
      if (isNonRetryableError(err)) {
        break;
      }

      if (attempt < actualMaxRetries) {
        const waitMs = 1000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  }

  throw lastError || new Error('DeepSeek API 调用失败');
}

/**
 * 判断错误是否不可重试（4xx：key 无效、参数错误、频率限制之外的请求问题）
 */
function isNonRetryableError(err) {
  return /DeepSeek API 返回 (4\d\d)/.test(err && err.message || '');
}

/**
 * 基于 Node.js https 模块的 HTTP POST 请求
 */
function httpsRequest(urlObj, body, apiKey, timeout) {
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
      timeout,
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`DeepSeek API 返回 ${res.statusCode}: ${data}`));
          return;
        }

        try {
          const result = JSON.parse(data);
          const reply = result.choices?.[0]?.message?.content || '';

          if (!reply) {
            reject(new Error('DeepSeek 返回空回复'));
            return;
          }

          resolve(reply);
        } catch (e) {
          reject(new Error(`解析 DeepSeek 响应失败: ${e.message}`));
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

module.exports = { callDeepSeek };
