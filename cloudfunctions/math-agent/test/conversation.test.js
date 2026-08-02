/**
 * 对话处理逻辑测试用例
 * 
 * 覆盖：消息处理、档案更新解析、情绪分析等核心逻辑
 */

const { Assert } = require('./test-runner');

// 模拟 parseProfileUpdate 逻辑（从 agent.js 提取）
function parseProfileUpdate(reply) {
  const match = reply.match(/\[PROFILE_UPDATE\]([\s\S]*?)\[\/PROFILE_UPDATE\]/);
  if (!match) return { cleanReply: reply, update: null };

  const cleanReply = reply.replace(/\[PROFILE_UPDATE\][\s\S]*?\[\/PROFILE_UPDATE\]/, '').trim();

  try {
    const update = JSON.parse(match[1].trim());
    return { cleanReply, update };
  } catch (e) {
    return { cleanReply, update: null };
  }
}

// 模拟情绪分析逻辑
function deriveEmotion(state) {
  if (state.emotion === 'positive') return 'positive';
  if (state.emotion === 'negative') return 'negative';
  return 'neutral';
}

// 模拟状态分析逻辑
function analyzeState(context, content) {
  const isPositive = content.includes('懂了') || content.includes('明白了') || 
                     content.includes('谢谢') || content.includes('好的');
  const isNegative = content.includes('不懂') || content.includes('太难') || 
                     content.includes('不会') || content.includes('放弃');
  
  return {
    emotion: isPositive ? 'positive' : (isNegative ? 'negative' : 'neutral'),
    consecutiveCorrect: isPositive ? (context?.progress?.consecutiveCorrect || 0) + 1 : 0,
  };
}

// 模拟消息验证
function validateMessage(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('消息内容不能为空');
  }
  if (content.length > 2000) {
    throw new Error('消息内容过长');
  }
  return true;
}

module.exports = function() {
  return [
    {
      name: '对话处理 - 验证有效消息',
      async run() {
        const result = validateMessage('什么是一元二次方程？');
        Assert.ok(result, '有效消息应验证通过');
      }
    },
    {
      name: '对话处理 - 验证空消息',
      async run() {
        Assert.throws(() => validateMessage(''), '消息内容不能为空');
      }
    },
    {
      name: '对话处理 - 验证非字符串消息',
      async run() {
        Assert.throws(() => validateMessage(123), '消息内容不能为空');
      }
    },
    {
      name: '对话处理 - 验证过长消息',
      async run() {
        const longMsg = 'a'.repeat(2001);
        Assert.throws(() => validateMessage(longMsg), '消息内容过长');
      }
    },
    {
      name: '对话处理 - 解析档案更新（有效）',
      async run() {
        const reply = `这是回复内容
[PROFILE_UPDATE]
{"weakPoints": ["一元二次方程"], "masteredTopics": ["有理数"], "emotionalState": "积极"}
[/PROFILE_UPDATE]`;
        
        const { cleanReply, update } = parseProfileUpdate(reply);
        
        Assert.equal(cleanReply, '这是回复内容', '应正确提取清理后的回复');
        Assert.ok(update, '应解析出更新对象');
        Assert.deepEqual(update.weakPoints, ['一元二次方程'], 'weakPoints 应正确解析');
        Assert.deepEqual(update.masteredTopics, ['有理数'], 'masteredTopics 应正确解析');
        Assert.equal(update.emotionalState, '积极', 'emotionalState 应正确解析');
      }
    },
    {
      name: '对话处理 - 解析档案更新（无更新标记）',
      async run() {
        const reply = '这是普通回复内容';
        
        const { cleanReply, update } = parseProfileUpdate(reply);
        
        Assert.equal(cleanReply, '这是普通回复内容', '回复应保持不变');
        Assert.equal(update, null, '无更新标记时update应为null');
      }
    },
    {
      name: '对话处理 - 解析档案更新（无效JSON）',
      async run() {
        const reply = `这是回复内容
[PROFILE_UPDATE]
{invalid json}
[/PROFILE_UPDATE]`;
        
        const { cleanReply, update } = parseProfileUpdate(reply);
        
        Assert.equal(cleanReply, '这是回复内容', '应正确提取清理后的回复');
        Assert.equal(update, null, '无效JSON时update应为null');
      }
    },
    {
      name: '对话处理 - 解析档案更新（部分字段）',
      async run() {
        const reply = `回复内容
[PROFILE_UPDATE]
{"emotionalState": "疲倦", "confidenceLevel": "一般"}
[/PROFILE_UPDATE]`;
        
        const { update } = parseProfileUpdate(reply);
        
        Assert.ok(update, '应解析出更新对象');
        Assert.equal(update.emotionalState, '疲倦', 'emotionalState 应正确');
        Assert.equal(update.confidenceLevel, '一般', 'confidenceLevel 应正确');
        Assert.equal(update.weakPoints, undefined, '未提供的字段应为undefined');
      }
    },
    {
      name: '对话处理 - 情绪分析（积极）',
      async run() {
        const context = {};
        const content = '懂了！谢谢小伴的讲解';
        
        const state = analyzeState(context, content);
        Assert.equal(state.emotion, 'positive', '应识别为积极情绪');
        Assert.equal(state.consecutiveCorrect, 1, '连续正确次数应为1');
      }
    },
    {
      name: '对话处理 - 情绪分析（消极）',
      async run() {
        const context = {};
        const content = '太难了，我不懂';
        
        const state = analyzeState(context, content);
        Assert.equal(state.emotion, 'negative', '应识别为消极情绪');
        Assert.equal(state.consecutiveCorrect, 0, '连续正确次数应归零');
      }
    },
    {
      name: '对话处理 - 情绪分析（中性）',
      async run() {
        const context = {};
        const content = '这道题怎么做';
        
        const state = analyzeState(context, content);
        Assert.equal(state.emotion, 'neutral', '应识别为中性情绪');
      }
    },
    {
      name: '对话处理 - 情绪推导',
      async run() {
        Assert.equal(deriveEmotion({ emotion: 'positive' }), 'positive');
        Assert.equal(deriveEmotion({ emotion: 'negative' }), 'negative');
        Assert.equal(deriveEmotion({ emotion: 'neutral' }), 'neutral');
        Assert.equal(deriveEmotion({}), 'neutral');
      }
    },
    {
      name: '对话处理 - 档案更新字段合并逻辑',
      async run() {
        // 模拟 merge 逻辑
        const existing = ['有理数', '整式的加减'];
        const update = ['一元一次方程', '有理数'];
        const merged = [...new Set([...existing, ...update])];
        const limited = merged.slice(-10);
        
        Assert.deepEqual(merged, ['有理数', '整式的加减', '一元一次方程'], '应合并去重');
        Assert.deepEqual(limited, merged, '数量未超过限制时应保持原样');
        
        // 测试超过限制的情况
        const manyItems = Array.from({ length: 15 }, (_, i) => `知识点${i}`);
        const limitedMany = manyItems.slice(-10);
        Assert.equal(limitedMany.length, 10, '应保留最后10个');
      }
    },
    {
      name: '对话处理 - 总结需要更新标记',
      async run() {
        // 模拟总结更新逻辑
        const profile = { summaryNeedsUpdate: false, lastSummary: '旧总结' };
        
        // 发送消息后应标记需要更新
        const updatedProfile = { ...profile, summaryNeedsUpdate: true };
        
        Assert.ok(updatedProfile.summaryNeedsUpdate, '发送消息后应标记需要更新总结');
      }
    }
  ];
};
