/**
 * 数学小伴 — 对话业务逻辑
 *
 * 串联记忆模块、策略引擎和 DeepSeek API，
 * 实现完整的消息处理和总结生成。
 */
const memory = require('./memory');
const strategy = require('./strategy');
const { callDeepSeek } = require('../lib/deepseek');
const { buildMessage, getProfile, formatProfile, parseProfileUpdate } = require('./agent');
const { db } = require('../lib/dbHelper');
const { buildMemory } = require('./memory-builder');

async function handleMessage({ sessionId, content, topic }) {
  console.log(`[math-agent] handleMessage session=${sessionId} len=${content.length}`);

  if (!content || typeof content !== 'string') {
    throw new Error('消息内容不能为空');
  }
  if (content.length > 2000) {
    throw new Error('消息内容过长');
  }

  let currentSessionId = sessionId;
  if (!currentSessionId) {
    currentSessionId = await memory.createSession(topic);
    console.log(`[math-agent] 创建新会话: ${currentSessionId}`);
  }

  if (topic) {
    await db.collection('mt_sessions')
      .where({ sessionId: currentSessionId })
      .update({ data: { topic } });
  }

  const context = await memory.loadContext(currentSessionId);
  const state = strategy.analyzeState(context, content);

  const profile = await getProfile();

  await memory.saveMessage(currentSessionId, 'user', content);

  const { systemPrompt, userMessage } = await buildMessage(context, content, profile);

  const rawReply = await callDeepSeek({ systemPrompt, userMessage }, { timeout: 25000, maxRetries: 0 });

  const { cleanReply, update } = parseProfileUpdate(rawReply);
  const emotion = strategy.deriveEmotion(state);

  await memory.saveMessage(currentSessionId, 'assistant', cleanReply, { emotion, systemPrompt });

  Promise.all([
    (async () => {
      if (update) {
        await updateProfileFromAI(update);
        console.log('[math-agent] 档案已更新:', JSON.stringify(update));
      }
    })(),
    (async () => {
      try {
        await db.collection('mt_profile').where({ isDeleted: _.neq(true) }).limit(1).update({
          data: { summaryNeedsUpdate: true, updatedAt: db.serverDate() },
        });
      } catch (e) {}
    })(),
    (async () => {
      if (topic) {
        await memory.updateKnowledgeProgress(topic, {
          correct: state.emotion === 'positive',
          consecutiveCorrect: state.consecutiveCorrect,
        });
      }
    })(),
    rebuildMemory(),
  ]).catch(err => console.error('[math-agent] 异步操作失败:', err));

  console.log(`[math-agent] 完成 emotion=${emotion}`);

  return {
    reply: cleanReply,
    sessionId: currentSessionId,
    emotion,
  };
}

async function updateProfileFromAI(update) {
  try {
    const _ = db.command;
    const res = await db.collection('mt_profile').where({ isDeleted: _.neq(true) }).limit(1).get();

    if (res.data.length === 0) {
      return;
    }

    const profile = res.data[0];
    const updateData = { updatedAt: db.serverDate() };

    // 学习类字段
    if (update.weakPoints && Array.isArray(update.weakPoints)) {
      const existing = profile.weakPoints || [];
      const merged = [...new Set([...existing, ...update.weakPoints])];
      updateData.weakPoints = merged.slice(-10);
    }

    if (update.masteredTopics && Array.isArray(update.masteredTopics)) {
      const existing = profile.masteredTopics || [];
      const merged = [...new Set([...existing, ...update.masteredTopics])];
      updateData.masteredTopics = merged.slice(-10);
    }

    if (update.learningTopics && Array.isArray(update.learningTopics)) {
      const existing = profile.learningTopics || [];
      const merged = [...new Set([...existing, ...update.learningTopics])];
      updateData.learningTopics = merged.slice(-10);
    }

    if (update.learningStyle) {
      updateData.learningStyle = update.learningStyle;
    }

    if (update.learningGoals) {
      updateData.learningGoals = update.learningGoals;
    }

    if (update.grade) {
      updateData.grade = update.grade;
    }

    // 情绪与状态类字段（每次都覆盖最新值）
    if (update.emotionalState) {
      updateData.emotionalState = update.emotionalState;
    }

    if (update.confidenceLevel) {
      updateData.confidenceLevel = update.confidenceLevel;
    }

    if (update.energyLevel) {
      updateData.energyLevel = update.energyLevel;
    }

    if (update.recentMood) {
      updateData.recentMood = update.recentMood;
    }

    // 个性与兴趣类字段
    if (update.personality) {
      updateData.personality = update.personality;
    }

    if (update.interests && Array.isArray(update.interests)) {
      const existing = profile.interests || [];
      const merged = [...new Set([...existing, ...update.interests])];
      updateData.interests = merged.slice(-10);
    }

    if (update.favoriteTopics && Array.isArray(update.favoriteTopics)) {
      const existing = profile.favoriteTopics || [];
      const merged = [...new Set([...existing, ...update.favoriteTopics])];
      updateData.favoriteTopics = merged.slice(-10);
    }

    await db.collection('mt_profile').doc(profile._id).update({ data: updateData });
  } catch (e) {
    console.error('[math-agent] 更新档案失败:', e);
  }
}

/**
 * 生成学习总结（AI 个性化生成）
 */
async function generateSummary({ scope = 'recent', forceUpdate = false } = {}) {
  console.log(`[math-agent] generateSummary scope=${scope} forceUpdate=${forceUpdate}`);

  // === 异步更新 memory（不阻塞总结生成） ===
  buildMemory().catch(err => console.error('[math-agent] 异步更新 memory 失败:', err));

  // === 缓存检查 ===
  const profile = await getProfile();
  const cached = profile?.lastSummary;
  const needsUpdate = profile?.summaryNeedsUpdate !== false || forceUpdate;

  if (cached && !needsUpdate && scope === 'recent') {
    console.log('[math-agent] 使用缓存的总结');
    const sessions = await memory.getRecentSessions(10);
    if (sessions.length > 0) {
      const stats = await buildStats(sessions);
      return { ...stats, summary: cached };
    }
  }

  // === 拉取原始数据 ===
  const sessions = await memory.getRecentSessions(scope === 'all' ? 100 : 10);

  if (sessions.length === 0) {
    const config = require('../config/index');
    const defaultTopics = config.defaultTopics.map(topic => ({
      topic,
      level: 0,
      practicedCount: 0,
      consecutiveCorrect: 0,
      levelDesc: '未开始',
    }));

    return {
      summary: '小伴还没和你一起学习过呢~ 快来开始我们的第一次数学之旅吧！🐰',
      topicsCovered: defaultTopics,
      totalSessions: 0,
      totalMessages: 0,
      learningDays: 0,
      stats: { masteredCount: 0, learningCount: 0, newCount: 0, avgLevel: 0 },
      suggestions: ['🎯 先选择一个知识点开始学习吧！'],
    };
  }

  const totalSessions = sessions.length;
  const totalMessages = sessions.reduce((sum, s) => sum + (s.totalMessages || 0), 0);

  const firstSession = sessions[sessions.length - 1];
  const now = new Date();
  const firstDate = new Date(firstSession.createdAt);
  const learningDays = Math.floor((now - firstDate) / (1000 * 60 * 60 * 24)) + 1;

  const topics = new Set();
  for (const session of sessions) {
    if (session.topic) topics.add(session.topic);
  }

  const config = require('../config/index');

  let topicList = [...topics];
  if (topicList.length === 0) {
    topicList = [...config.defaultTopics];
  }

  const topicsCovered = [];
  for (const topic of topicList) {
    const progress = await memory.getTopicProgress(topic);
    const level = progress?.level || 0;
    topicsCovered.push({
      topic,
      level,
      practicedCount: progress?.practicedCount || 0,
      consecutiveCorrect: progress?.consecutiveCorrect || 0,
      levelDesc: level === 0 ? '未开始' : level < 0.3 ? '初识' : level < 0.5 ? '了解' : level < 0.7 ? '掌握' : level < 0.9 ? '熟练' : '精通',
    });
  }

  const topicOrder = {};
  config.defaultTopics.forEach((topic, index) => {
    topicOrder[topic] = index;
  });

  topicsCovered.sort((a, b) => {
    const orderA = topicOrder[a.topic] !== undefined ? topicOrder[a.topic] : 999;
    const orderB = topicOrder[b.topic] !== undefined ? topicOrder[b.topic] : 999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    if (a.level > 0 && b.level === 0) return -1;
    if (a.level === 0 && b.level > 0) return 1;
    return b.level - a.level;
  });

  const practicedTopics = topicsCovered.filter(t => t.level > 0);
  const avgLevel = practicedTopics.length > 0
    ? practicedTopics.reduce((sum, t) => sum + t.level, 0) / practicedTopics.length
    : 0;

  const masteredTopics = topicsCovered.filter(t => t.level >= 0.7);
  const learningTopics = topicsCovered.filter(t => t.level >= 0.3 && t.level < 0.7);
  const newTopics = topicsCovered.filter(t => t.level > 0 && t.level < 0.3);

  const profileStr = formatProfile(profile);
  let summary = '';
  let suggestions = [];
  let fromCache = false;

  if (profile?.lastSummary && profile?.summaryNeedsUpdate === false) {
    fromCache = true;
    summary = profile.lastSummary;
    suggestions = profile.lastSuggestions || [];
    console.log('[math-agent] 使用缓存的 AI 总结');
  } else {
    if (profile?.lastSummary) {
      try {
        const topicsStr = topicsCovered.map(t =>
          `  - ${t.topic}: ${t.levelDesc}（练习${t.practicedCount}次）`
        ).join('\n');

        const systemPrompt = `你是一个温暖贴心的学习陪伴者「数学小伴」。根据学生档案和学习数据，生成个性化学习总结。
只返回纯 JSON：{"summary":"总结文字","suggestions":["建议1","建议2"]}
- summary 引用学生个人信息（名字、薄弱点、兴趣等），自然亲切
- 必须提到学习天数、消息数、哪些知识点掌握好、哪些需要加强
- suggestions 2~3条，针对薄弱点和学习状态给建议
- 语气温暖鼓励，200字以内`;

        const userMessage = `## 学生档案
${profileStr || '（暂无详细档案）'}

## 学习数据
学习天数：${learningDays}天 | 学习次数：${totalSessions}次 | 消息数：${totalMessages}条

## 知识点
${topicsStr || '（暂无）'}
${masteredTopics.length > 0 ? '\n掌握：' + masteredTopics.map(t => t.topic).join('、') : ''}
${learningTopics.length > 0 ? '\n在学：' + learningTopics.map(t => t.topic).join('、') : ''}
${newTopics.length > 0 ? '\n薄弱：' + newTopics.map(t => t.topic).join('、') : ''}`;

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI summary timeout')), 8000)
        );

        const [reply] = await Promise.all([
          callDeepSeek({ systemPrompt, userMessage }, { timeout: 8000, maxRetries: 0 }),
          timeoutPromise
        ]);

        const parsed = JSON.parse(reply);
        if (parsed.summary) {
          summary = parsed.summary;
          suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
          const _ = db.command;
          await db.collection('mt_profile').where({ isDeleted: _.neq(true) }).limit(1).update({
            data: {
              lastSummary: summary,
              lastSuggestions: suggestions,
              summaryNeedsUpdate: false,
              lastSummaryUpdatedAt: db.serverDate(),
              updatedAt: db.serverDate(),
            },
          });
        }
      } catch (err) {
        console.error('[math-agent] AI 总结超时或失败，使用程序生成:', err.message);
        fromCache = true;

        const levelDesc = avgLevel < 0.3 ? '刚刚开始' : avgLevel < 0.5 ? '稳步前进中' : avgLevel < 0.7 ? '掌握不错' : avgLevel < 0.9 ? '非常熟练' : '大师级';
        summary = `🌟 学习周报来啦！

📅 你已经坚持学习 ${learningDays} 天了
💬 累计对话 ${totalMessages} 条消息
${practicedTopics.length > 0 ? `📚 学习了 ${practicedTopics.length} 个知识点` : ''}

${masteredTopics.length > 0 ? `✅ 熟练掌握: ${masteredTopics.map(t => t.topic).join('、')}` : ''}
${learningTopics.length > 0 ? `🔄 正在学习: ${learningTopics.map(t => t.topic).join('、')}` : ''}
${newTopics.length > 0 ? `🌱 初识阶段: ${newTopics.map(t => t.topic).join('、')}` : ''}

你的整体掌握程度：${levelDesc}~ 继续加油，数学会越来越有趣的！💪`;

        suggestions = [];
        if (masteredTopics.length > 0) suggestions.push(`🎉 你已经熟练掌握了 ${masteredTopics.length} 个知识点，太棒了！`);
        if (learningTopics.length > 0) suggestions.push(`📚 正在学习 ${learningTopics.length} 个知识点，继续加油哦~`);
        if (learningDays >= 7) suggestions.push('⏰ 坚持学习一周啦，保持这个好习惯！');
        if (totalMessages >= 50) suggestions.push('💬 你和小伴已经聊了很多了，数学思维越来越活跃！');
      }
    } else {
      const levelDesc = avgLevel < 0.3 ? '刚刚开始' : avgLevel < 0.5 ? '稳步前进中' : avgLevel < 0.7 ? '掌握不错' : avgLevel < 0.9 ? '非常熟练' : '大师级';
      summary = `🌟 学习周报来啦！

📅 你已经坚持学习 ${learningDays} 天了
💬 累计对话 ${totalMessages} 条消息
${practicedTopics.length > 0 ? `📚 学习了 ${practicedTopics.length} 个知识点` : ''}

${masteredTopics.length > 0 ? `✅ 熟练掌握: ${masteredTopics.map(t => t.topic).join('、')}` : ''}
${learningTopics.length > 0 ? `🔄 正在学习: ${learningTopics.map(t => t.topic).join('、')}` : ''}
${newTopics.length > 0 ? `🌱 初识阶段: ${newTopics.map(t => t.topic).join('、')}` : ''}

你的整体掌握程度：${levelDesc}~ 继续加油，数学会越来越有趣的！💪`;

      suggestions = [];
      if (masteredTopics.length > 0) suggestions.push(`🎉 你已经熟练掌握了 ${masteredTopics.length} 个知识点，太棒了！`);
      if (learningTopics.length > 0) suggestions.push(`📚 正在学习 ${learningTopics.length} 个知识点，继续加油哦~`);
      if (learningDays >= 7) suggestions.push('⏰ 坚持学习一周啦，保持这个好习惯！');
      if (totalMessages >= 50) suggestions.push('💬 你和小伴已经聊了很多了，数学思维越来越活跃！');
    }
  }

  // === 组装结果 ===
  const result = {
    summary,
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
    fromCache,
  };

  // === 缓存新生成的总结 ===
  if (scope === 'recent') {
    try {
      await db.collection('mt_profile').where({ isDeleted: _.neq(true) }).limit(1).update({
        data: {
          lastSummary: summary,
          summaryNeedsUpdate: false,
          lastSummaryUpdatedAt: db.serverDate(),
          updatedAt: db.serverDate(),
        },
      });
    } catch (e) {
      // 缓存写入失败不影响返回
    }
  }

  return result;
}

/**
 * 构建统计数据（缓存命中时复用）
 */
async function buildStats(sessions) {
  const totalSessions = sessions.length;
  const totalMessages = sessions.reduce((sum, s) => sum + (s.totalMessages || 0), 0);

  const firstSession = sessions[sessions.length - 1];
  const now = new Date();
  const firstDate = new Date(firstSession.createdAt);
  const learningDays = Math.floor((now - firstDate) / (1000 * 60 * 60 * 24)) + 1;

  const topics = new Set();
  for (const session of sessions) {
    if (session.topic) topics.add(session.topic);
  }

  const topicsCovered = [];
  for (const topic of topics) {
    const progress = await memory.getTopicProgress(topic);
    const level = progress?.level || 0;
    topicsCovered.push({
      topic,
      level,
      practicedCount: progress?.practicedCount || 0,
      consecutiveCorrect: progress?.consecutiveCorrect || 0,
      levelDesc: level === 0 ? '未开始' : level < 0.3 ? '初识' : level < 0.5 ? '了解' : level < 0.7 ? '掌握' : level < 0.9 ? '熟练' : '精通',
    });
  }

  topicsCovered.sort((a, b) => a.level - b.level);

  const avgLevel = topicsCovered.length > 0
    ? topicsCovered.reduce((sum, t) => sum + t.level, 0) / topicsCovered.length
    : 0;

  const masteredTopics = topicsCovered.filter(t => t.level >= 0.7);
  const learningTopics = topicsCovered.filter(t => t.level >= 0.3 && t.level < 0.7);
  const newTopics = topicsCovered.filter(t => t.level < 0.3);

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

module.exports = { handleMessage, generateSummary };
