/**
 * 数学小伴 — 认知策略引擎
 *
 * 动态分析学习者状态，用于调整兔子表情和对话策略。
 * 基于认知科学策略：成长型思维、最近发展区、情感过滤等。
 * 注意：教学模式由 AI 根据上下文自然决定，不做硬编码切换。
 */

// 情绪关键词映射（用于检测用户情绪）
const EMOTION_KEYWORDS = {
  resistant: ['不想', '不要', '别学了', '没意思', '无聊', '烦', '讨厌'],
  tired: ['累了', '困了', '好难', '不会', '太难了', '不懂', '好累'],
  positive: ['懂了', '原来如此', '明白了', '会了', '有趣', '好玩', '简单'],
  curious: ['为什么', '怎么来的', '什么意思', '是啥', '好奇'],
};

// 用户情绪 → 兔子表情映射
const EMOTION_TO_RABBIT = {
  resistant: 'gentle',
  tired: 'gentle',
  positive: 'happy',
  curious: 'curious',
  neutral: 'happy',
};

/**
 * 分析用户状态
 * @param {object} context - 上下文对象（含 lastMessages, progress 等）
 * @param {string} content - 用户本次输入
 * @returns {object} { emotion, consecutiveCorrect, difficulty }
 */
function analyzeState(context, content) {
  const emotion = detectEmotion(content);
  const lastMessages = context?.lastMessages || [];
  const consecutiveCorrect = countConsecutiveCorrect(lastMessages);
  const difficulty = context?.progress?.difficulty || 0.5;

  return { emotion, consecutiveCorrect, difficulty };
}

/**
 * 检测情绪
 * @param {string} content - 用户输入
 * @returns {string} emotion 类型
 */
function detectEmotion(content) {
  if (!content) return 'neutral';

  const lower = content.toLowerCase();

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return emotion;
      }
    }
  }

  return 'neutral';
}

/**
 * 统计最近消息中的连续答对次数
 * @param {Array} messages - 最近消息列表
 * @returns {number} 连续答对次数
 */
// 明确的答对表达（避免把提问里的"等于/结果/对不对"误判为答对）
const CORRECT_PATTERNS = ['懂了', '明白了', '会了', '原来如此', '答对了', '做对了', '解出来了', '对了', '对呀', '对的'];

/**
 * 判断一条用户消息是否为"答对"信号
 * @param {string} content - 用户消息
 * @returns {boolean}
 */
function isCorrectAnswer(content) {
  if (!content) return false;
  const lower = content.toLowerCase();
  return CORRECT_PATTERNS.some(k => lower.includes(k));
}

function countConsecutiveCorrect(messages) {
  let count = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'user') continue;

    const isCorrect = isCorrectAnswer(msg.content);

    if (isCorrect) {
      count++;
    } else {
      break;
    }
  }

  return count;
}

/**
 * 根据用户情绪推导兔子表情
 * @param {object} state - 分析结果 { emotion }
 * @returns {string} 兔子表情: happy | curious | gentle | thinking
 */
function deriveEmotion(state) {
  return EMOTION_TO_RABBIT[state?.emotion] || 'happy';
}

/**
 * 计算难度系数
 * @param {string} topic - 知识点名称
 * @param {object} progress - 进度数据
 * @returns {number} 难度系数 [0.2, 0.8]
 */
function calculateDifficulty(topic, progress) {
  if (!progress) return 0.5;

  const baseDifficulty = 0.5;
  const levelBoost = (progress.level || 0) * 0.3;
  const consecutiveCorrect = progress.consecutiveCorrect || 0;
  const correctBoost = Math.min(consecutiveCorrect * 0.1, 0.3);

  const difficulty = baseDifficulty + levelBoost + correctBoost;

  return Math.max(0.2, Math.min(0.8, difficulty));
}

module.exports = {
  analyzeState,
  detectEmotion,
  countConsecutiveCorrect,
  isCorrectAnswer,
  deriveEmotion,
  calculateDifficulty,
};
