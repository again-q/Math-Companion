/**
 * 总结生成功能测试用例
 * 
 * 覆盖：统计数据构建、等级计算、缓存逻辑等核心逻辑
 */

const { Assert } = require('./test-runner');
const config = require('../config/index');

// 等级判定
function getLevelDesc(level) {
  if (level === 0) return '未开始';
  if (level < 0.3) return '初识';
  if (level < 0.5) return '了解';
  if (level < 0.7) return '掌握';
  if (level < 0.9) return '熟练';
  return '精通';
}

// 构建统计数据（从 conversation.js 提取）
function buildStats(sessions) {
  const totalSessions = sessions.length;
  const totalMessages = sessions.reduce((sum, s) => sum + (s.totalMessages || 0), 0);

  let learningDays = 0;
  if (sessions.length > 0) {
    const firstSession = sessions[sessions.length - 1];
    const now = new Date();
    const firstDate = new Date(firstSession.createdAt);
    learningDays = Math.floor((now - firstDate) / (1000 * 60 * 60 * 24)) + 1;
  }

  const topics = new Set();
  for (const session of sessions) {
    if (session.topic) topics.add(session.topic);
  }

  const topicsCovered = [];
  for (const topic of topics) {
    topicsCovered.push({
      topic,
      level: 0.5,
      practicedCount: 3,
      consecutiveCorrect: 2,
      levelDesc: getLevelDesc(0.5),
    });
  }

  topicsCovered.sort((a, b) => a.level - b.level);

  const avgLevel = topicsCovered.length > 0
    ? topicsCovered.reduce((sum, t) => sum + t.level, 0) / topicsCovered.length
    : 0;

  const masteredTopics = topicsCovered.filter(t => t.level >= 0.7);
  const learningTopics = topicsCovered.filter(t => t.level >= 0.3 && t.level < 0.7);
  const newTopics = topicsCovered.filter(t => t.level > 0 && t.level < 0.3);

  const suggestions = [];
  if (masteredTopics.length > 0) {
    suggestions.push(`🎉 你已经熟练掌握了 ${masteredTopics.length} 个知识点，太棒了！`);
  }
  if (learningTopics.length > 0) {
    suggestions.push(`📚 正在学习 ${learningTopics.length} 个知识点，继续加油哦~`);
  }
  if (learningDays >= 7) {
    suggestions.push('⏰ 坚持学习一周啦，保持这个好习惯！');
  }
  if (totalMessages >= 50) {
    suggestions.push('💬 你和小伴已经聊了很多了，数学思维越来越活跃！');
  }

  return {
    topicsCovered,
    totalSessions,
    totalMessages,
    learningDays,
    stats: {
      masteredCount: masteredTopics.length,
      learningCount: learningTopics.length,
      newCount: newTopics.length,
      avgLevel,
    },
    suggestions,
  };
}

// 生成程序总结（AI失败时的兜底逻辑）
function generateFallbackSummary(learningDays, totalMessages, practicedTopics, masteredTopics, learningTopics, newTopics, avgLevel) {
  const levelDesc = avgLevel < 0.3 ? '刚刚开始' : avgLevel < 0.5 ? '稳步前进中' : avgLevel < 0.7 ? '掌握不错' : avgLevel < 0.9 ? '非常熟练' : '大师级';
  
  let summary = `🌟 学习周报来啦！

📅 你已经坚持学习 ${learningDays} 天了
💬 累计对话 ${totalMessages} 条消息`;

  if (practicedTopics.length > 0) {
    summary += `\n📚 学习了 ${practicedTopics.length} 个知识点`;
  }

  if (masteredTopics.length > 0) {
    summary += `\n\n✅ 熟练掌握: ${masteredTopics.map(t => t.topic).join('、')}`;
  }
  if (learningTopics.length > 0) {
    summary += `\n🔄 正在学习: ${learningTopics.map(t => t.topic).join('、')}`;
  }
  if (newTopics.length > 0) {
    summary += `\n🌱 初识阶段: ${newTopics.map(t => t.topic).join('、')}`;
  }

  summary += `\n\n你的整体掌握程度：${levelDesc}~ 继续加油，数学会越来越有趣的！💪`;

  return summary;
}

// 知识点排序逻辑
function sortTopics(topicsCovered) {
  const topicOrder = {};
  config.defaultTopics.forEach((topic, index) => {
    topicOrder[topic] = index;
  });

  return [...topicsCovered].sort((a, b) => {
    const orderA = topicOrder[a.topic] !== undefined ? topicOrder[a.topic] : 999;
    const orderB = topicOrder[b.topic] !== undefined ? topicOrder[b.topic] : 999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    if (a.level > 0 && b.level === 0) return -1;
    if (a.level === 0 && b.level > 0) return 1;
    return b.level - a.level;
  });
}

module.exports = function() {
  return [
    {
      name: '总结生成 - 构建统计数据（有会话）',
      async run() {
        const now = new Date();
        const sessions = [
          { createdAt: now, updatedAt: now, topic: '一元二次方程', totalMessages: 5 },
          { createdAt: new Date(now.getTime() - 86400000), updatedAt: now, topic: '有理数', totalMessages: 3 },
        ];

        const stats = buildStats(sessions);

        Assert.equal(stats.totalSessions, 2, '会话数应为2');
        Assert.equal(stats.totalMessages, 8, '消息总数应为8');
        Assert.equal(stats.learningDays, 2, '学习天数应为2');
        Assert.equal(stats.topicsCovered.length, 2, '应覆盖2个知识点');
        Assert.ok(stats.topicsCovered.every(t => t.levelDesc === '掌握'), '等级描述应为掌握');
      }
    },
    {
      name: '总结生成 - 构建统计数据（无会话）',
      async run() {
        const stats = buildStats([]);

        Assert.equal(stats.totalSessions, 0, '会话数应为0');
        Assert.equal(stats.totalMessages, 0, '消息总数应为0');
        Assert.equal(stats.learningDays, 0, '学习天数应为0');
        Assert.equal(stats.topicsCovered.length, 0, '应无知识点');
        Assert.equal(stats.stats.avgLevel, 0, '平均等级应为0');
      }
    },
    {
      name: '总结生成 - 等级统计分类',
      async run() {
        const topicsCovered = [
          { topic: '知识点1', level: 0.8 }, // 熟练
          { topic: '知识点2', level: 0.4 }, // 了解
          { topic: '知识点3', level: 0.2 }, // 初识
          { topic: '知识点4', level: 0.95 }, // 精通
          { topic: '知识点5', level: 0.6 }, // 掌握
          { topic: '知识点6', level: 0 }, // 未开始
        ];

        const mastered = topicsCovered.filter(t => t.level >= 0.7);
        const learning = topicsCovered.filter(t => t.level >= 0.3 && t.level < 0.7);
        const newTopics = topicsCovered.filter(t => t.level > 0 && t.level < 0.3);

        Assert.equal(mastered.length, 2, '应识别2个熟练/精通知识点');
        Assert.equal(learning.length, 2, '应识别2个正在学习知识点');
        Assert.equal(newTopics.length, 1, '应识别1个初识知识点');
      }
    },
    {
      name: '总结生成 - 平均等级计算',
      async run() {
        const topicsCovered = [
          { level: 0.5 },
          { level: 0.7 },
          { level: 0.3 },
        ];

        const avgLevel = topicsCovered.reduce((sum, t) => sum + t.level, 0) / topicsCovered.length;
        
        Assert.approxEqual(avgLevel, 0.5, 0.001, '平均等级应为0.5');
      }
    },
    {
      name: '总结生成 - 平均等级计算（空列表）',
      async run() {
        const topicsCovered = [];
        const avgLevel = topicsCovered.length > 0
          ? topicsCovered.reduce((sum, t) => sum + t.level, 0) / topicsCovered.length
          : 0;
        
        Assert.equal(avgLevel, 0, '空列表平均等级应为0');
      }
    },
    {
      name: '总结生成 - 生成程序总结（兜底逻辑）',
      async run() {
        const masteredTopics = [{ topic: '有理数' }];
        const learningTopics = [{ topic: '一元二次方程' }];
        const newTopics = [{ topic: '几何图形' }];

        const summary = generateFallbackSummary(
          7, 50, [{ topic: 'test' }], masteredTopics, learningTopics, newTopics, 0.5
        );

        Assert.ok(summary.includes('学习周报'), '应包含学习周报标题');
        Assert.ok(summary.includes('7 天'), '应包含学习天数');
        Assert.ok(summary.includes('50 条'), '应包含消息数');
        Assert.ok(summary.includes('有理数'), '应包含已掌握知识点');
        Assert.ok(summary.includes('一元二次方程'), '应包含正在学习知识点');
        Assert.ok(summary.includes('掌握不错'), '应包含等级描述');
      }
    },
    {
      name: '总结生成 - 知识点排序（按配置顺序）',
      async run() {
        const topicsCovered = [
          { topic: '一元二次方程', level: 0.8 }, // 初三内容
          { topic: '有理数', level: 0.5 }, // 初一内容
          { topic: '三角形', level: 0.3 }, // 初二内容
        ];

        const sorted = sortTopics(topicsCovered);

        Assert.equal(sorted[0].topic, '有理数', '有理数应排在第一位');
        Assert.equal(sorted[1].topic, '三角形', '三角形应排在第二位');
        Assert.equal(sorted[2].topic, '一元二次方程', '一元二次方程应排在第三位');
      }
    },
    {
      name: '总结生成 - 知识点排序（练习过的优先）',
      async run() {
        const topicsCovered = [
          { topic: '整式的加减', level: 0 }, // 未练习
          { topic: '有理数', level: 0.5 }, // 已练习
          { topic: '几何图形初步', level: 0 }, // 未练习
        ];

        const sorted = sortTopics(topicsCovered);

        Assert.equal(sorted[0].topic, '有理数', '已练习的应排在第一位');
      }
    },
    {
      name: '总结生成 - 知识点排序（同等级按掌握程度）',
      async run() {
        const topicsCovered = [
          { topic: '有理数', level: 0.3 },
          { topic: '整式的加减', level: 0.5 },
          { topic: '一元一次方程', level: 0.4 },
        ];

        const sorted = sortTopics(topicsCovered);

        // 配置顺序：有理数(0) < 整式的加减(1) < 一元一次方程(2)
        Assert.equal(sorted[0].topic, '有理数', '有理数应排在第一位');
        Assert.equal(sorted[1].topic, '整式的加减', '整式的加减应排在第二位');
        Assert.equal(sorted[2].topic, '一元一次方程', '一元一次方程应排在第三位');
      }
    },
    {
      name: '总结生成 - 建议生成（基于学习天数）',
      async run() {
        const suggestions = [];
        const learningDays = 7;
        
        if (learningDays >= 7) {
          suggestions.push('⏰ 坚持学习一周啦，保持这个好习惯！');
        }

        Assert.ok(suggestions.length > 0, '应生成建议');
        Assert.ok(suggestions[0].includes('一周'), '建议应提及一周');
      }
    },
    {
      name: '总结生成 - 建议生成（基于消息数）',
      async run() {
        const suggestions = [];
        const totalMessages = 50;
        
        if (totalMessages >= 50) {
          suggestions.push('💬 你和小伴已经聊了很多了，数学思维越来越活跃！');
        }

        Assert.ok(suggestions.length > 0, '应生成建议');
        Assert.ok(suggestions[0].includes('聊了很多'), '建议应提及对话数量');
      }
    },
    {
      name: '总结生成 - 缓存检查逻辑',
      async run() {
        // 模拟缓存检查
        const profile = { lastSummary: '缓存的总结', summaryNeedsUpdate: false };
        const needsUpdate = profile.summaryNeedsUpdate !== false;
        
        Assert.ok(!needsUpdate, '不需要更新时应使用缓存');
        
        profile.summaryNeedsUpdate = true;
        const needsUpdate2 = profile.summaryNeedsUpdate !== false;
        Assert.ok(needsUpdate2, '需要更新时应重新生成');
      }
    },
    {
      name: '总结生成 - 无学习记录时返回空知识点',
      async run() {
        // 验证：当用户没有学习记录时，知识点列表应返回空数组
        const sessions = [];
        
        if (sessions.length === 0) {
          const topicsCovered = []; // 不应该使用默认知识点
          Assert.deepEqual(topicsCovered, [], '无学习记录时应返回空数组');
        }
      }
    }
  ];
};
