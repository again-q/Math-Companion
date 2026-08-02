/**
 * 数学小伴 — Memory 文件生成器
 *
 * 将数据库中的学习数据转换成 AI 可读的 Markdown 格式记忆文件。
 * 内容来源：数据库汇总 + AI 分析补充。
 */

const memory = require('./memory');
const { getProfile } = require('./agent');
const { db } = require('../lib/dbHelper');
const config = require('../config/index');

async function buildMemory() {
  console.log('[math-agent] 开始构建 memory');

  const profile = await getProfile();
  const sessions = await memory.getRecentSessions(20);
  const knowledge = await getAllKnowledgeProgress();

  const basicSection = buildBasicSection(profile, sessions);
  const knowledgeSection = buildKnowledgeSection(knowledge);
  const statsSection = buildStatsSection(sessions);

  let analysisSection = '';
  if (sessions.length > 0) {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI analysis timeout')), 8000)
      );
      analysisSection = await Promise.race([
        analyzeWithAI(sessions, knowledge, profile),
        timeoutPromise
      ]);
    } catch (e) {
      console.warn('[math-agent] AI 分析超时或失败，跳过:', e.message);
      analysisSection = '';
    }
  }

  const memoryContent = assembleMemory({
    basicSection,
    knowledgeSection,
    statsSection,
    analysisSection,
  });

  await saveMemory(memoryContent);

  console.log('[math-agent] memory 构建完成');
  return memoryContent;
}

function buildBasicSection(profile, sessions) {
  const now = new Date();
  let learningDays = 0;
  let streak = 0;

  if (sessions.length > 0) {
    const firstSession = sessions[sessions.length - 1];
    const firstDate = new Date(firstSession.createdAt);
    learningDays = Math.floor((now - firstDate) / (1000 * 60 * 60 * 24)) + 1;

    const lastStudyDate = profile?.lastStudyDate;
    if (lastStudyDate) {
      const lastDate = new Date(lastStudyDate);
      const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
      streak = diffDays === 0 ? (profile?.streak || 0) : (diffDays === 1 ? (profile?.streak || 0) + 1 : 0);
    }
  }

  const lines = [];
  lines.push(`- 昵称：${profile?.nickName || '数学小能手'}`);
  lines.push(`- 年级：${profile?.grade || '初三'}`);
  lines.push(`- 学习天数：${learningDays}天`);
  // 零压力：只有真正连续（≥2天）才展示，避免"0天/1天"造成催促感
  if (streak >= 2) lines.push(`- 连续学习：${streak}天`);

  return lines.join('\n');
}

function buildKnowledgeSection(knowledge) {
  if (knowledge.length === 0) {
    return '| 知识点 | 掌握程度 | 练习次数 | 连续正确 |\n|--------|---------|---------|---------|\n| 暂无 | - | - | - |';
  }

  let table = '| 知识点 | 掌握程度 | 练习次数 | 连续正确 |\n';
  table += '|--------|---------|---------|---------|\n';

  knowledge.forEach(k => {
    const levelDesc = k.level === 0 ? '未开始' : k.level < 0.3 ? '初识' : k.level < 0.5 ? '了解' : k.level < 0.7 ? '掌握' : k.level < 0.9 ? '熟练' : '精通';
    table += `| ${k.topic} | ${levelDesc} | ${k.practicedCount || 0} | ${k.consecutiveCorrect || 0} |\n`;
  });

  return table.trim();
}

function buildStatsSection(sessions) {
  const totalMessages = sessions.reduce((sum, s) => sum + (s.totalMessages || 0), 0);
  const learningDays = sessions.length > 0 ? Math.floor((new Date() - new Date(sessions[sessions.length - 1].createdAt)) / (1000 * 60 * 60 * 24)) + 1 : 0;
  const avgMessages = learningDays > 0 ? Math.round(totalMessages / learningDays) : 0;

  const lines = [];
  lines.push(`- 总消息数：${totalMessages}条`);
  lines.push(`- 平均每天消息：${avgMessages}条`);

  if (sessions.length > 0) {
    const lastSession = sessions[0];
    const lastDate = new Date(lastSession.updatedAt);
    lines.push(`- 最近活跃：${lastDate.getMonth() + 1}月${lastDate.getDate()}日`);
  }

  return lines.join('\n');
}

async function analyzeWithAI(sessions, knowledge, profile) {
  try {
    const knowledgeStr = knowledge.map(k => {
      const levelDesc = k.level === 0 ? '未开始' : k.level < 0.3 ? '初识' : k.level < 0.5 ? '了解' : k.level < 0.7 ? '掌握' : k.level < 0.9 ? '熟练' : '精通';
      return `  - ${k.topic}: ${levelDesc}（练习${k.practicedCount}次，连续正确${k.consecutiveCorrect}次）`;
    }).join('\n');

    const systemPrompt = `你是一个学习数据分析专家。根据学习数据，分析学生的学习偏好和薄弱点。
只返回纯 JSON：{"learningStyle":"学习偏好描述","weakPoints":["薄弱点1","薄弱点2"],"suggestions":["建议1","建议2"]}
- learningStyle 描述学生喜欢的学习方式（如：喜欢例子、喜欢推导、喜欢故事等）
- weakPoints 列出需要加强的知识点（基于练习次数少或连续正确低）
- suggestions 给出2-3条针对性学习建议`;

    const userMessage = `## 学生档案
${profile?.learningStyle || '（暂无）'}

## 知识点掌握情况
${knowledgeStr || '（暂无）'}

## 会话数据
最近${sessions.length}个会话，共${sessions.reduce((sum, s) => sum + (s.totalMessages || 0), 0)}条消息`;

    const { callDeepSeek } = require('../lib/deepseek');
    const reply = await callDeepSeek({ systemPrompt, userMessage }, { timeout: 15000, maxRetries: 1 });

    try {
      const parsed = JSON.parse(reply);

      const lines = [];

      if (parsed.learningStyle) {
        lines.push(`## 🎯 学习偏好`);
        lines.push(`- ${parsed.learningStyle}`);
      }

      if (parsed.weakPoints && parsed.weakPoints.length > 0) {
        lines.push(`## 🎯 薄弱点`);
        parsed.weakPoints.forEach(p => lines.push(`- ${p}`));
      }

      if (parsed.suggestions && parsed.suggestions.length > 0) {
        lines.push(`## 💡 学习建议`);
        parsed.suggestions.forEach(s => lines.push(`- ${s}`));
      }

      if (lines.length > 0) {
        await updateProfileAnalysis(parsed);
      }

      return lines.join('\n');
    } catch (e) {
      console.warn('[math-agent] 解析 AI 分析结果失败:', e);
      return '';
    }
  } catch (err) {
    console.error('[math-agent] AI 分析失败:', err);
    return '';
  }
}

function assembleMemory({ basicSection, knowledgeSection, statsSection, analysisSection }) {
  const parts = [];

  parts.push('# 学生学习档案');
  parts.push('');
  parts.push('## 📋 基础信息');
  parts.push(basicSection);
  parts.push('');
  parts.push('## 📚 知识点掌握');
  parts.push(knowledgeSection);
  parts.push('');
  parts.push('## 💬 学习行为统计');
  parts.push(statsSection);

  if (analysisSection) {
    parts.push('');
    parts.push(analysisSection);
  }

  return parts.join('\n');
}

async function saveMemory(memoryContent) {
  try {
    const _ = db.command;
    const res = await db.collection('mt_profile').where({ isDeleted: _.neq(true) }).limit(1).get();

    if (res.data.length === 0) {
      await db.collection('mt_profile').add({
        data: {
          memory: memoryContent,
          memoryUpdatedAt: db.serverDate(),
          isDeleted: false,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate(),
        },
      });
    } else {
      await db.collection('mt_profile').doc(res.data[0]._id).update({
        data: {
          memory: memoryContent,
          memoryUpdatedAt: db.serverDate(),
          updatedAt: db.serverDate(),
        },
      });
    }
  } catch (e) {
    console.error('[math-agent] 保存 memory 失败:', e);
  }
}

async function updateProfileAnalysis(analysis) {
  try {
    const _ = db.command;
    const updateData = { updatedAt: db.serverDate() };

    if (analysis.learningStyle) {
      updateData.learningStyle = analysis.learningStyle;
    }

    if (analysis.weakPoints && Array.isArray(analysis.weakPoints)) {
      updateData.weakPoints = analysis.weakPoints.slice(0, 5);
    }

    if (analysis.suggestions && Array.isArray(analysis.suggestions)) {
      updateData.lastSuggestions = analysis.suggestions.slice(0, 3);
    }

    await db.collection('mt_profile').where({ isDeleted: _.neq(true) }).limit(1).update({ data: updateData });
  } catch (e) {
    console.error('[math-agent] 更新分析结果失败:', e);
  }
}

async function getAllKnowledgeProgress() {
  try {
    // 分页拉取：云函数端单次 get 上限 100 条，循环取完（上限 1000 防御）
    const BATCH_SIZE = 100;
    const MAX_TOTAL = 1000;
    let progressList = [];
    for (let skip = 0; skip < MAX_TOTAL; skip += BATCH_SIZE) {
      const res = await db.collection('mt_knowledge_progress').skip(skip).limit(BATCH_SIZE).get();
      progressList = progressList.concat(res.data);
      if (res.data.length < BATCH_SIZE) break;
    }

    const defaultTopics = config.defaultTopics || [];
    const existingTopics = new Set(progressList.map(p => p.topic));

    defaultTopics.forEach(topic => {
      if (!existingTopics.has(topic)) {
        progressList.push({
          topic,
          level: 0,
          practicedCount: 0,
          consecutiveCorrect: 0,
        });
      }
    });

    progressList.sort((a, b) => (b.level || 0) - (a.level || 0));

    return progressList;
  } catch (e) {
    console.error('[math-agent] 获取知识点进度失败:', e);
    return [];
  }
}

async function rebuildMemory() {
  return await buildMemory();
}

module.exports = { buildMemory, rebuildMemory };
