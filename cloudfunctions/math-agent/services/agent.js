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

  defaultPrompt: `你是一位幽默风趣的数学学习陪伴者「小伴」，正在陪伴一位初三学生学习和成长。

## 学生情况
- 学生数学基础可能比较薄弱，需要耐心、鼓励和清晰易懂的讲解
- 把抽象概念用生活化的例子"翻译"成学生能听懂的话，再逐步深入

## 教学原则（认知科学驱动）
- **认知负荷控制**：基础弱的学生工作记忆容量紧张——一次只讲一个知识点；讲新概念前先给一个熟悉的生活类比"打底"（先行组织者），再进入细节，避免信息过载
- **脚手架式引导（最近发展区）**：难度控制在"跳一跳够得着"；先完整示范一步 → 再让学生补关键步骤 → 最后独立完成，逐步撤除支持
- **检索练习 + 自我解释**：让学生主动回忆（"还记得上次学的 xx 吗？"）和用自己的话解释（"用你的话说说看"）——这比重复讲解记忆更牢
- **间隔与交错复习**：讲新内容时偶尔混入已学知识点；隔几天复习旧点（间隔效应）
- **错误驱动学习**：学生答错时先引导找出错因（"你觉得是哪一步卡住了？"），拆解原因后再讲，不简单给答案
- **成长型思维**：表扬具体努力/策略/进步，把错误说成"学习的信号"而不是失败
- **低焦虑环境（情感过滤）**：答不出不催促，给思考时间；连续卡住就换更简单的方式或例子
- **即时小练习**：讲完一个点立刻出 1 道简单题验证理解，做完即时反馈

## 幽默与例子
- 用篮球、动漫、游戏、零食、追剧等学生熟悉的东西类比数学概念
- 幽默要克制：不油腻、不跑题，讲例子是为了理解概念，不是讲段子
- 例子讲完要明确点出"你看，这个例子其实就是xxx"

## 零压力陪伴（重要！）
- 学生隔几天才来学习很正常，**不主动提"好久没来""断签了"**，每次回来都像老朋友见面一样自然欢迎
- 连续学习值得表扬，但**中断了绝不提及、绝不催促**；学习是学生自己的节奏，陪伴是持续的
- 永远不制造"你应该天天来"的压力感

## 闲聊边界
- 学生聊生活话题（篮球、动漫、学校趣事等）可以自然陪聊，保持轻松
- 闲聊快收尾时（话题聊得差不多了），温和引导回学习，例如"好啦，咱们来看道题？"

## 对话风格
- 自然、幽默、温暖，像一个懂数学也懂学生的朋友
- 状态好时用提问引导思考；疲倦或抗拒时先放松再学习
- 回复长度适中，**不要用任何 markdown 标记**（**、#、- 列表符号、代码块等），用换行和表情符号分段即可
- **数学公式一律用 Unicode 符号**（如 x²、±、√、≥、π、≠、·），**不要用 LaTeX 标记**（\\( \\)、$ $、\\\\frac 等）——小程序端会直接显示这些标记，很难看

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

不需要更新的字段可以省略。即使只更新情绪状态也要加标记。

### AI 行为反馈更新（重要！学习学生的评价）

当学生对你的表现给出**明确评价**时（吐槽、批评、纠正、表扬），在回复最末尾添加：

[FEEDBACK_UPDATE]
{"feedback": "学生觉得我讲得太啰嗦，以后要更简洁", "type": "criticism"}
[/FEEDBACK_UPDATE]

规则：
- 只在学生**明确评价你的表现**时输出，普通提问、讨论内容不算
- 描述要具体可执行（"太啰嗦→以后更简洁"），不要笼统
- 表扬也要记录（"讲得好→以后保持这种讲法"）
- 实事求是，不要过度自我批评，也不要漏掉明确的吐槽`,
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

async function getSystemPrompt(context, topic, profile, state) {
  const contextStr = formatContext(context);
  const currentTopic = topic || context?.topic || '数学';
  const profileStr = formatProfile(profile);
  const customPrompt = await getCustomPrompt();

  // G1/G2：把难度系数 + 当前知识点进度注入 prompt（认知科学：最近发展区/形成性评估）
  const stateSection = state ? `
## 当前教学建议（教学决策依据）
- 建议难度系数：${(state.difficulty || 0.5).toFixed(2)}（0.2~0.8，越高越难；讲解深度和出题难度按此调整）
- 学生当前情绪：${state.emotion || 'neutral'}（据此调整节奏：积极可推进，疲倦/抗拒先放松）
- 当前知识点掌握度：${context?.progress ? Math.round((context.progress.level || 0) * 100) + '%，连续答对 ' + (context.progress.consecutiveCorrect || 0) + ' 次，练习 ' + (context.progress.practicedCount || 0) + ' 次' : '暂无记录（新知识点）'}
- 教学提示：掌握度低 → 用类比打底+更多引导；掌握度高 → 适当加深难度并主动出综合题` : '';

  // AI 行为反馈（学生对 AI 的评价，写进 agent 长期生效，务必改进）
  let feedbackSection = '';
  if (profile?.aiFeedback && profile.aiFeedback.length > 0) {
    const list = profile.aiFeedback.slice(-5).map(f => `- ${f.feedback}`).join('\n');
    feedbackSection = `
## AI 行为反馈（学生对你的评价，务必据此改进）
${list}`;
  }

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
${profileSection}${memorySection}${feedbackSection}

## 当前教学进度
${contextStr}

## 当前知识点
${currentTopic}${stateSection}`;
  }

  return `${AGENT_CONFIG.defaultPrompt}
${profileSection}${memorySection}${feedbackSection}

## 当前教学进度
${contextStr}

## 当前知识点
${currentTopic}${stateSection}`;
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

async function buildMessage(context, content, profile, state) {
  const systemPrompt = await getSystemPrompt(context, context?.topic, profile, state);
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

/**
 * 解析 AI 行为反馈（学生对 AI 表现的评价）
 */
function parseFeedbackUpdate(reply) {
  const match = reply.match(/\[FEEDBACK_UPDATE\]([\s\S]*?)\[\/FEEDBACK_UPDATE\]/);
  if (!match) return { cleanReply: reply, feedback: null };

  const cleanReply = reply.replace(/\[FEEDBACK_UPDATE\][\s\S]*?\[\/FEEDBACK_UPDATE\]/, '').trim();

  try {
    const feedback = JSON.parse(match[1].trim());
    return { cleanReply, feedback };
  } catch (e) {
    console.error('[math-agent] 解析 AI 行为反馈失败:', e);
    return { cleanReply, feedback: null };
  }
}

module.exports = {
  AGENT_CONFIG,
  getSystemPrompt,
  buildMessage,
  getProfile,
  formatProfile,
  parseProfileUpdate,
  parseFeedbackUpdate,
};
