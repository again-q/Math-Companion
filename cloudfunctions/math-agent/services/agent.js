/**
 * 数学小伴 — Agent 配置
 *
 * 集中管理 AI 人设、教学原则和对话风格。
 * 通过 Prompt 限制业务规则，无需代码判断。
 */

const { db } = require('../lib/dbHelper');

const AGENT_CONFIG = {
  name: '数学小伴',
  role: '数学学习陪伴者',
  targetStudent: '初三学生',

  defaultPrompt: `你是一位数学学习陪伴者，正陪伴一位初三学生学习和成长。

## 陪伴原则
- 既是老师也是朋友，学习时耐心引导，闲聊时自然亲切
- 用提问引导学生自己推导出答案，不直接给结果
- 把复杂问题拆解成简单的小步骤
- 用生活中的例子帮助理解抽象概念
- 学生卡住时给提示，不替学生做题
- 表扬学生的思考过程和具体努力，不说"你真聪明"
- 如果连续引导2次仍答不出，建议换种方式讲解
- 学生说不想学时，先聊聊别的放松一下
- 可以在问答中出题让学生练习

## 对话风格
- 自然、专业、温暖，像一个了解你的老朋友
- 记住学生之前提过的兴趣和经历，适时提起
- 当学生理解有困难时，可以讲故事或生活例子
- 学生状态好时用提问引导思考
- 学生疲倦或抗拒时先聊天放松
- 根据对话上下文自然调整节奏

## 个人档案更新原则（重要！每次对话都要更新）

你需要在每次对话中观察学生，并在回复时更新个人档案。
即使没有明显的学习内容，也要更新情绪和状态。

### 每次必更新的维度：
1. **学习状态**：涉及哪些知识点？掌握程度如何？
2. **情绪状态**：学生今天的心情如何？积极/疲倦/烦躁/好奇？
3. **个人兴趣**：学生提到的生活内容、爱好、学校趣事
4. **目标与意愿**：学生的学习目标、动力水平
5. **行为模式**：喜欢什么学习方式？什么情况下学得最好？

### 更新内容：
- weakPoints: 学生反复出错或理解困难的知识点
- masteredTopics: 学生已掌握的知识点
- learningTopics: 正在学习中的知识点
- learningStyle: 学生偏好的学习方式（如：喜欢例子/喜欢推导/喜欢故事）
- learningGoals: 学生的学习目标（如："中考数学满分"、"想搞懂几何证明"）
- interests: 学生的兴趣方向（如："喜欢生活应用题"、"喜欢竞赛题"）
- grade: 学生的年级（如："初一"、"初三"）
- emotionalState: 当前情绪状态（如："积极"、"疲倦"、"焦虑"、"好奇"）
- confidenceLevel: 自信心水平（"自信" / "一般" / "需要鼓励"）
- recentMood: 近期整体状态描述（如："最近有点急躁"、"状态不错"）
- personality: 性格特点（如："好胜心强"、"容易放弃"、"细心"）
- favoriteTopics: 学生喜欢的闲聊话题（如："篮球"、"动漫"）
- energyLevel: 精力水平（"充沛" / "一般" / "疲惫"）

### 更新格式（重要！）
当需要更新档案时，在回复的最末尾添加：

[PROFILE_UPDATE]
{"weakPoints": ["知识点1"], "masteredTopics": ["知识点2"], "learningTopics": ["知识点3"], "learningStyle": "描述", "emotionalState": "积极", "confidenceLevel": "自信", "interests": ["篮球"], "energyLevel": "充沛"}
[/PROFILE_UPDATE]

不需要更新的字段可以省略。即使只更新情绪状态也要加标记。`,
};

async function getCustomPrompt() {
  try {
    const res = await db.collection('mt_config').where({ key: 'systemPrompt' }).limit(1).get();
    return res.data.length > 0 ? res.data[0].value : '';
  } catch (e) {
    return '';
  }
}

async function getProfile() {
  try {
    const res = await db.collection('mt_profile').where({ isDeleted: db.command.neq(true) }).limit(1).get();
    return res.data.length > 0 ? res.data[0] : null;
  } catch (e) {
    return null;
  }
}

function formatProfile(profile) {
  if (!profile) return '（新用户，暂无档案）';

  const parts = [];
  if (profile.nickName) parts.push(`昵称：${profile.nickName}`);
  if (profile.grade) parts.push(`年级：${profile.grade}`);
  if (profile.learningGoals) parts.push(`学习目标：${profile.learningGoals}`);
  if (profile.totalExp) parts.push(`累计经验：${profile.totalExp}`);
  if (profile.personality) parts.push(`性格特点：${profile.personality}`);
  if (profile.confidenceLevel) parts.push(`自信心：${profile.confidenceLevel}`);
  if (profile.emotionalState) parts.push(`当前情绪：${profile.emotionalState}`);
  if (profile.energyLevel) parts.push(`精力状态：${profile.energyLevel}`);
  if (profile.recentMood) parts.push(`近期状态：${profile.recentMood}`);
  if (profile.weakPoints && profile.weakPoints.length > 0) {
    parts.push(`薄弱知识点：${profile.weakPoints.join('、')}`);
  }
  if (profile.masteredTopics && profile.masteredTopics.length > 0) {
    parts.push(`已掌握知识点：${profile.masteredTopics.join('、')}`);
  }
  if (profile.learningTopics && profile.learningTopics.length > 0) {
    parts.push(`正在学习：${profile.learningTopics.join('、')}`);
  }
  if (profile.learningStyle) parts.push(`学习偏好：${profile.learningStyle}`);
  if (profile.interests && profile.interests.length > 0) {
    parts.push(`兴趣爱好：${profile.interests.join('、')}`);
  }
  if (profile.favoriteTopics && profile.favoriteTopics.length > 0) {
    parts.push(`喜欢聊：${profile.favoriteTopics.join('、')}`);
  }

  return parts.length > 0 ? parts.join('\n') : '（暂无学习记录）';
}

async function getSystemPrompt(context, topic, profile) {
  const contextStr = formatContext(context);
  const currentTopic = topic || context?.topic || '数学';
  const profileStr = formatProfile(profile);
  const customPrompt = await getCustomPrompt();

  let memorySection = '';
  if (profile?.memory) {
    memorySection = `

## 学生记忆档案（AI 专用，每次对话必须参考）
${profile.memory}`;
  }

  const profileSection = `
## 学生档案（你的记忆，仅你可见）
${profileStr}

请根据学生档案个性化教学：
- 针对薄弱点多给引导和练习
- 已掌握的知识点可以适当提高难度
- 根据学习偏好调整教学方式`;

  if (customPrompt) {
    return `${customPrompt}
${profileSection}${memorySection}

## 当前教学进度
${contextStr}

## 当前知识点
${currentTopic}`;
  }

  return `${AGENT_CONFIG.defaultPrompt}
${profileSection}${memorySection}

## 当前教学进度
${contextStr}

## 当前知识点
${currentTopic}`;
}

function formatContext(context) {
  if (!context?.lastMessages || context.lastMessages.length === 0) {
    return '（新会话，暂无历史记录）';
  }

  return context.lastMessages
    .slice(-5)
    .map(msg => {
      const role = msg.role === 'user' ? '学生' : AGENT_CONFIG.name;
      return `${role}: ${msg.content}`;
    })
    .join('\n');
}

async function buildMessage(context, content, profile) {
  const systemPrompt = await getSystemPrompt(context, context?.topic, profile);
  const userMessage = `学生问：${content}`;

  return { systemPrompt, userMessage };
}

function parseProfileUpdate(reply) {
  const match = reply.match(/\[PROFILE_UPDATE\]([\s\S]*?)\[\/PROFILE_UPDATE\]/);
  if (!match) return { cleanReply: reply, update: null };

  const cleanReply = reply.replace(/\[PROFILE_UPDATE\][\s\S]*?\[\/PROFILE_UPDATE\]/, '').trim();

  try {
    const update = JSON.parse(match[1].trim());
    return { cleanReply, update };
  } catch (e) {
    console.error('[math-agent] 解析档案更新失败:', e);
    return { cleanReply, update: null };
  }
}

module.exports = {
  AGENT_CONFIG,
  getSystemPrompt,
  buildMessage,
  getProfile,
  formatProfile,
  parseProfileUpdate,
};
