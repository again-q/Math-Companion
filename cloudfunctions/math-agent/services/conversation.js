/**
 * 数学小伴 — 对话业务逻辑
 *
 * 串联记忆模块、策略引擎和 DeepSeek API，
 * 实现完整的消息处理和总结生成。
 */
const memory = require('./memory');
const strategy = require('./strategy');
const { callDeepSeek } = require('../lib/deepseek');
const { buildMessage, getProfile, formatProfile, parseProfileUpdate, parseFeedbackUpdate } = require('./agent');
const { db, _ } = require('../lib/dbHelper');

/**
 * 从用户消息中识别知识点话题（原设计：topic 驱动知识进度；
 * 前端未显式传 topic 时按 defaultTopics 兜底识别）
 */
function detectTopic(content) {
  if (!content) return null;
  const config = require('../config/index');
  for (const topic of config.defaultTopics) {
    if (content.includes(topic)) return topic;
  }
  return null;
}

async function handleMessage({ sessionId, content, topic, deepThink, material }) {
  console.log(`[math-agent] handleMessage session=${sessionId} len=${content.length}`);

  if (!content || typeof content !== 'string') {
    throw new Error('消息内容不能为空');
  }
  if (content.length > 2000) {
    throw new Error('消息内容过长');
  }

  // 原设计：topic 决定会话归属的知识点；前端没传时从消息内容识别
  const resolvedTopic = topic || detectTopic(content);

  let currentSessionId = sessionId;
  if (!currentSessionId) {
    currentSessionId = await memory.createSession(resolvedTopic);
    console.log(`[math-agent] 创建新会话: ${currentSessionId}`);
  }

  if (resolvedTopic) {
    await db.collection('mt_sessions')
      .where({ sessionId: currentSessionId })
      .update({ data: { topic: resolvedTopic } });
  }

  const context = await memory.loadContext(currentSessionId);
  const state = strategy.analyzeState(context, content);

  const profile = await getProfile();

  await memory.saveMessage(currentSessionId, 'user', content);

  // 完整历史 → API 原生多轮（不人工截断）
  const history = (context?.lastMessages || []).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const { systemPrompt, userMessage, history: fullHistory } = await buildMessage(context, content, profile, state, history, material);

  const rawReply = await callDeepSeek({ systemPrompt, userMessage, history: fullHistory }, { timeout: 25000, maxRetries: 0, deepThink: !!deepThink });

  const { cleanReply, update } = parseProfileUpdate(rawReply);
  const { cleanReply: finalReply, feedback } = parseFeedbackUpdate(cleanReply);
  const emotion = strategy.deriveEmotion(state);

  await memory.saveMessage(currentSessionId, 'assistant', finalReply, { emotion });

  // 原设计：对话后更新档案/标记总结/更新知识进度。
  // 必须 await 保证云函数返回前执行完成（fire-and-forget 在云函数环境中不保证执行）。
  // memory 全量重建由定时任务 dailyMemoryRebuild + 总结页刷新触发，不在此阻塞。
  const tasks = [];
  if (update) {
    tasks.push(updateProfileFromAI(update).then(() => {
      console.log('[math-agent] 档案已更新:', JSON.stringify(update));
    }));
  }
  tasks.push(
    db.collection('mt_profile').where({ isDeleted: _.neq(true) }).limit(1).update({
      data: { summaryNeedsUpdate: true, updatedAt: db.serverDate() },
    }).catch(() => {})
  );
  tasks.push(updateStudyStreak());
  if (feedback && feedback.feedback) {
    tasks.push(updateFeedback(feedback));
  }
  if (resolvedTopic) {
    tasks.push(
      (async () => {
        // AI 独立判断掌握度（用户选择：对话后自动判断，更准）
        const judge = await aiMasteryJudge(resolvedTopic, content, finalReply);
        if (judge) {
          await memory.updateKnowledgeProgress(resolvedTopic, {
            correct: judge.correct,
            consecutiveCorrect: judge.correct ? (state.consecutiveCorrect + 1) : 0,
            levelDelta: judge.levelDelta,
          });
          console.log(`[math-agent] AI 判断掌握度 ${resolvedTopic}: ${judge.correct ? '掌握' : '未掌握'} Δ${judge.levelDelta}`);
        } else {
          // AI 判断失败 → 回退关键词判断
          await memory.updateKnowledgeProgress(resolvedTopic, {
            correct: strategy.isCorrectAnswer(content),
            consecutiveCorrect: state.consecutiveCorrect,
          });
        }
      })().catch(err => console.error('[math-agent] 更新知识进度失败:', err))
    );
  }
  await Promise.all(tasks).catch(err => console.error('[math-agent] 异步操作失败:', err));

  console.log(`[math-agent] 完成 emotion=${emotion}`);

  return {
    reply: cleanReply,
    sessionId: currentSessionId,
    emotion,
  };
}

/**
 * AI 独立判断掌握度：结合对话内容判断学生对知识点的真实掌握变化
 * @returns {Promise<{correct: boolean, levelDelta: number, comment: string}|null>}
 */
async function aiMasteryJudge(topic, userContent, aiReply) {
  try {
    const systemPrompt = '你是数学学情分析助手。根据对话，判断学生对指定知识点的掌握情况。只返回 JSON，不要其他文字：{"correct": true/false, "levelDelta": 0到0.15的浮点数, "comment": "一句话点评"}。correct 表示学生这次是否真正掌握（能独立运用）；levelDelta 表示掌握度变化（掌握了涨 0.05~0.15，未掌握可为 0 或小负数）。';
    const userMessage = `知识点：${topic}\n学生消息：${String(userContent).slice(0, 300)}\n小伴回答：${String(aiReply).slice(0, 500)}\n\n判断并返回 JSON。`;
    const reply = await callDeepSeek(
      { systemPrompt, userMessage },
      { timeout: 15000, maxRetries: 0, json: true }
    );
    const parsed = JSON.parse(reply);
    return {
      correct: parsed.correct !== false,
      levelDelta: Math.min(0.15, Math.max(-0.05, Number(parsed.levelDelta) || 0)),
      comment: parsed.comment || '',
    };
  } catch (e) {
    console.warn('[math-agent] AI 掌握度判断失败，回退关键词:', e.message);
    return null;
  }
}

/**
 * 记录 AI 行为反馈（学生对 AI 表现的评价，写进 agent 长期生效）
 */
async function updateFeedback(feedback) {
  try {
    const profile = await getProfile();
    if (!profile || !profile._id) return;
    const existing = profile.aiFeedback || [];
    const item = {
      feedback: String(feedback.feedback || '').slice(0, 100),
      type: feedback.type || 'criticism',
      at: new Date(),
    };
    if (!item.feedback) return;
    const next = [...existing, item].slice(-10); // 保留最近 10 条
    await db.collection('mt_profile').doc(profile._id).update({
      data: { aiFeedback: next, updatedAt: db.serverDate() },
    });
    console.log('[math-agent] AI 行为反馈已记录:', item.feedback);
  } catch (e) {
    console.error('[math-agent] 记录 AI 行为反馈失败:', e);
  }
}

/**
 * 更新连续学习天数（streak）：
 * 今天首次对话时更新 lastStudyDate；昨天学过则 streak+1，中断则重置为 1，今天已学过则保持不变。
 */
async function updateStudyStreak() {
  try {
    const profile = await getProfile();
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    let streak = 1;
    if (profile && profile.lastStudyDate) {
      const last = new Date(profile.lastStudyDate);
      const lastStart = new Date(last.getFullYear(), last.getMonth(), last.getDate());
      const diffDays = Math.round((todayStart - lastStart) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        streak = profile.streak || 1; // 今天已学过，保持
      } else if (diffDays === 1) {
        streak = (profile.streak || 0) + 1; // 昨天学过，连续 +1
      } else {
        streak = 1; // 中断，重置
      }
    }

    await db.collection('mt_profile').where({ isDeleted: _.neq(true) }).limit(1).update({
      data: { lastStudyDate: today, streak, updatedAt: db.serverDate() },
    });
  } catch (e) {
    console.error('[math-agent] 更新连续学习天数失败:', e);
  }
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

  const _ = db.command;

  // === 缓存检查 ===
  const profile = await getProfile();
  const cached = profile?.lastSummary;
  const needsUpdate = profile?.summaryNeedsUpdate !== false || forceUpdate;

  // 结果变量（缓存路径与生成路径共用）
  let summary = '';
  let suggestions = [];
  let knowledgeReport = null;
  let detailedSuggestions = null;
  let fromCache = false;

  if (cached && !needsUpdate && scope === 'recent') {
    console.log('[math-agent] 使用缓存的总结');
    const sessions = await memory.getRecentSessions(10);
    if (sessions.length > 0) {
      const stats = await buildStats(sessions, profile);
      knowledgeReport = profile.lastKnowledgeReport || null;
      detailedSuggestions = profile.lastDetailedSuggestions || null;
      return { ...stats, summary: cached, knowledgeReport, detailedSuggestions, lastUpdatedAt: profile?.memoryUpdatedAt || profile?.lastSummaryUpdatedAt || null };
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

  // 全部基础知识点（初一到初三，含未开始的）——知识地图用
  const topicList = [...config.defaultTopics];
  if (topicList.length === 0) {
    topicList.push('数学');
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
      lastPracticedAt: progress?.lastPracticedAt || null,
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

  if (profile?.lastSummary && profile?.summaryNeedsUpdate === false) {
    fromCache = true;
    summary = profile.lastSummary;
    suggestions = profile.lastSuggestions || [];
    knowledgeReport = profile.lastKnowledgeReport || null;
    detailedSuggestions = profile.lastDetailedSuggestions || null;
    console.log('[math-agent] 使用缓存的 AI 总结');
  } else {
    if (profile?.lastSummary) {
      try {
        const topicsStr = topicsCovered.map(t =>
          `  - ${t.topic}: ${t.levelDesc}（练习${t.practicedCount}次）`
        ).join('\n');

        const systemPrompt = `你是一个温暖贴心的学习陪伴者「数学小伴」。根据学生档案和学习数据，生成学习总结。

只返回纯文本 Markdown 格式，不要 JSON，不要代码块围栏：
【总结】
用 Markdown 组织，包含以下小节（用 ## 标题分隔，列表用 - 或 1.，关键处用 **加粗**）：
## 📅 学习概况（1~2句：天数/次数/消息数/整体状态）
## ✅ 掌握的知识点（列表，每个知识点1句）
## ⚠️ 薄弱环节（列表，说明原因和解决方向）
## 🎯 下一步计划（列表，2~3条具体做法）
## 💪 小伴的话（1~2句鼓励，引用名字和兴趣）
总 300~450字，语气温暖。

数学公式一律用 Unicode 数学符号（如 x²、±、√、≥、π、≠、·），不要用 LaTeX 标记（\\( \\)、$ $、\\\\frac 等）。

【建议】
（3条，Markdown 无序列表，每条一行）
- **标题**：简短做法（20~40字）

【知识点点评】
（只点评有练习记录的知识点，Markdown 无序列表，每个一行）
- **知识点名**：点评（20~40字，结合练习次数和掌握情况）`;

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
          setTimeout(() => reject(new Error('AI summary timeout')), 25000)
        );

        // 用 Promise.race：AI 先完成就用 AI 结果，超时才走兜底（不能用 Promise.all，否则要等 timeoutPromise 反而丢弃 AI 结果）
        const reply = await Promise.race([
          callDeepSeek({ systemPrompt, userMessage }, { timeout: 25000, maxRetries: 0 }),
          timeoutPromise
        ]);

        // 解析分隔符文本：总结 / 建议 / 知识点点评
        const report = parseAiReport(reply);
        if (report.summary) {
          summary = report.summary;
          suggestions = [];
          if (masteredTopics.length > 0) suggestions.push(`🎉 你已经熟练掌握了 ${masteredTopics.length} 个知识点，太棒了！`);
          if (learningTopics.length > 0) suggestions.push(`📚 正在学习 ${learningTopics.length} 个知识点，继续加油哦~`);
          if (learningDays >= 7) suggestions.push('⏰ 坚持学习一周啦，保持这个好习惯！');
          if (totalMessages >= 50) suggestions.push('💬 你和小伴已经聊了很多了，数学思维越来越活跃！');
          if (profile && profile.streak >= 3) suggestions.push(`🔥 连续学习 ${profile.streak} 天，太自律了！`);
          // AI 生成的建议与知识点评（解析失败回退程序模板）
          detailedSuggestions = report.suggestions.length > 0 ? report.suggestions : normalizeDetailedSuggestions(null);
          knowledgeReport = normalizeKnowledgeReport(report.reviews, topicsCovered);
          await db.collection('mt_profile').where({ isDeleted: _.neq(true) }).limit(1).update({
            data: {
              lastSummary: summary,
              lastSuggestions: suggestions,
              lastKnowledgeReport: knowledgeReport,
              lastDetailedSuggestions: detailedSuggestions,
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
        // 零压力：只有真正连续（≥3天）才给鼓励，中断绝不提醒
        if (profile && profile.streak >= 3) suggestions.push(`🔥 连续学习 ${profile.streak} 天，太自律了！`);
        // 程序生成兜底（AI 失败时）
        knowledgeReport = normalizeKnowledgeReport(null, topicsCovered);
        detailedSuggestions = normalizeDetailedSuggestions(null);
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
      // 零压力：只有真正连续（≥3天）才给鼓励，中断绝不提醒
      if (profile && profile.streak >= 3) suggestions.push(`🔥 连续学习 ${profile.streak} 天，太自律了！`);
      // 程序生成兜底
      knowledgeReport = normalizeKnowledgeReport(null, topicsCovered);
      detailedSuggestions = normalizeDetailedSuggestions(null);
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
    knowledgeReport,
    detailedSuggestions,
    lastUpdatedAt: profile?.memoryUpdatedAt || profile?.lastSummaryUpdatedAt || null,
  };

  // === 缓存新生成的总结 ===
  if (scope === 'recent') {
    try {
      await db.collection('mt_profile').where({ isDeleted: _.neq(true) }).limit(1).update({
        data: {
          lastSummary: summary,
          lastSuggestions: suggestions,
          lastKnowledgeReport: knowledgeReport,
          lastDetailedSuggestions: detailedSuggestions,
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
 * 解析 AI 生成的分隔符文本（总结/建议/知识点点评）
 * 格式：
 * 【总结】...【建议】1. 标题：做法...【知识点点评】知识点名：点评
 */
function parseAiReport(reply) {
  const result = { summary: '', suggestions: [], reviews: [] };

  const summaryMatch = reply.match(/【总结】([\s\S]*?)(?=【建议】|【知识点点评】|$)/);
  const sugMatch = reply.match(/【建议】([\s\S]*?)(?=【知识点点评】|$)/);
  const revMatch = reply.match(/【知识点点评】([\s\S]*?)$/);

  if (summaryMatch && summaryMatch[1].trim()) {
    result.summary = summaryMatch[1].trim();
  } else {
    // 回退：AI 可能没输出【总结】标记，取主体内容（去掉其他分隔符段）
    result.summary = reply
      .replace(/【建议】[\s\S]*$/, '')
      .replace(/【知识点点评】[\s\S]*$/, '')
      .replace(/【总结】/, '')
      .trim();
  }

  if (sugMatch && sugMatch[1].trim()) {
    const lines = sugMatch[1].split('\n').map(s => s.trim()).filter(Boolean);
    result.suggestions = lines.map(line => {
      // 清理 markdown 符号：- **标题**：做法 → 标题：做法
      const clean = line
        .replace(/^[-*+]\s+/, '')
        .replace(/^\d+\s*[.、)）]\s*/, '')
        .replace(/\*\*/g, '')
        .trim();
      const idx = clean.search(/[：:]/);
      if (idx > 0) {
        return { title: clean.slice(0, idx).slice(0, 50), reason: clean.slice(idx + 1).slice(0, 120), action: '' };
      }
      return { title: clean.slice(0, 50), reason: '', action: '' };
    }).filter(s => s.title);
  }

  if (revMatch && revMatch[1].trim()) {
    const lines = revMatch[1].split('\n').map(s => s.trim()).filter(Boolean);
    for (const line of lines) {
      const clean = line.replace(/^[-*+]\s+/, '').replace(/\*\*/g, '').trim();
      const idx = clean.indexOf('：');
      if (idx > 0) {
        const topic = clean.slice(0, idx).trim();
        const comment = clean.slice(idx + 1).trim();
        if (topic && comment) result.reviews.push({ topic, comment });
      }
    }
  }

  return result;
}

/**
 * 规范化知识点报告（AI 生成优先，缺失时程序兜底）
 * @param {Array|null} aiReport - AI 返回的 knowledgeReport（[{topic, comment, nextStep?}]）
 * @param {Array} topicsCovered - 知识点列表（含 level/practicedCount 等）
 */
function normalizeKnowledgeReport(aiReport, topicsCovered) {
  // 全部知识点（含未开始）——知识地图
  return topicsCovered.map(t => {
    const ai = Array.isArray(aiReport) ? aiReport.find(r => r && r.topic === t.topic) : null;
    const practiced = t.level > 0;
    return {
      topic: t.topic,
      level: t.level,
      practicedCount: t.practicedCount,
      consecutiveCorrect: t.consecutiveCorrect,
      lastPracticedAt: t.lastPracticedAt || null,
      levelDesc: t.levelDesc,
      comment: practiced ? ((ai && ai.comment) || programKnowledgeComment(t)) : '',
      nextStep: practiced ? ((ai && ai.nextStep) || programKnowledgeNextStep(t)) : '',
    };
  });
}

function programKnowledgeComment(t) {
  const l = t.level;
  if (l >= 0.7) return `${t.topic}掌握得不错，练习了 ${t.practicedCount} 次，已达到「${t.levelDesc}」水平，可以考虑挑战综合应用题了。`;
  if (l >= 0.3) return `${t.topic}正在稳步掌握中，练习了 ${t.practicedCount} 次。继续保持，重点突破易错题型。`;
  return `${t.topic}还在起步阶段，练习了 ${t.practicedCount} 次，${t.consecutiveCorrect > 0 ? '最近连续答对 ' + t.consecutiveCorrect + ' 次，有好转趋势' : '还需要多练几道巩固基础'}。`;
}

function programKnowledgeNextStep(t) {
  const l = t.level;
  if (l >= 0.7) return '尝试综合应用题，保持手感。';
  if (l >= 0.3) return '每天练 2-3 道，重点攻克易错题型。';
  return '先用生活例子理解概念，再做基础题。';
}

/**
 * 规范化结构化建议（AI 生成优先，缺失时程序兜底）
 */
function normalizeDetailedSuggestions(aiSuggestions) {
  if (Array.isArray(aiSuggestions) && aiSuggestions.length > 0 && typeof aiSuggestions[0] === 'object' && aiSuggestions[0].title) {
    return aiSuggestions.map(s => ({
      title: String(s.title || '建议').slice(0, 50),
      reason: String(s.reason || '').slice(0, 120),
      action: String(s.action || '').slice(0, 120),
    }));
  }
  return [
    { title: '巩固已掌握知识点', reason: '掌握不错的知识点需要定期回顾，才能形成长期记忆', action: '每周抽时间快速过一遍已学内容' },
    { title: '攻克薄弱环节', reason: '薄弱知识点需要更多针对性练习才能突破', action: '每天安排 2-3 道薄弱知识点的题目' },
    { title: '保持学习节奏', reason: '规律的学习比突击更有效果', action: '尽量保持隔天学习一次的节奏' },
  ];
}

/**
 * 构建统计数据（缓存命中时复用）
 */
async function buildStats(sessions, profile) {
  const totalSessions = sessions.length;
  const totalMessages = sessions.reduce((sum, s) => sum + (s.totalMessages || 0), 0);

  const firstSession = sessions[sessions.length - 1];
  const now = new Date();
  const firstDate = new Date(firstSession.createdAt);
  const learningDays = Math.floor((now - firstDate) / (1000 * 60 * 60 * 24)) + 1;

  const config = require('../config/index');

  // 全部基础知识点（初一到初三，含未开始）——知识地图用
  const topicList = config.defaultTopics.length > 0 ? config.defaultTopics : ['数学'];

  const topicsCovered = [];
  for (const topic of topicList) {
    const progress = await memory.getTopicProgress(topic);
    const level = progress?.level || 0;
    topicsCovered.push({
      topic,
      level,
      practicedCount: progress?.practicedCount || 0,
      consecutiveCorrect: progress?.consecutiveCorrect || 0,
      lastPracticedAt: progress?.lastPracticedAt || null,
      levelDesc: level === 0 ? '未开始' : level < 0.3 ? '初识' : level < 0.5 ? '了解' : level < 0.7 ? '掌握' : level < 0.9 ? '熟练' : '精通',
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
  // 零压力：只有真正连续（≥3天）才给鼓励，中断绝不提醒
  if (profile && profile.streak >= 3) {
    suggestions.push(`🔥 连续学习 ${profile.streak} 天，太自律了！`);
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
