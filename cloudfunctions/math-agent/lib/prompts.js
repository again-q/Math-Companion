/**
 * 数学小伴 — AI 人设 Prompt
 *
 * 单一的、统一的系统提示词。
 * AI 根据对话上下文自然决定教学方式，无需硬编码模式切换。
 */

/**
 * 构建对话参数
 * @param {object} context - 上下文对象
 * @param {string} userContent - 用户本次输入
 * @returns {{ systemPrompt: string, userMessage: string }}
 */
function buildPrompt(context, userContent) {
  const contextStr = formatContext(context);
  const topic = context?.topic || '数学';

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
${contextStr}

## 当前知识点
${topic}`;

  const userMessage = `学生问：${userContent}`;

  return { systemPrompt, userMessage };
}

/**
 * 格式化历史上下文为字符串
 */
function formatContext(context) {
  if (!context?.lastMessages || context.lastMessages.length === 0) {
    return '（新会话，暂无历史记录）';
  }

  return context.lastMessages
    .slice(-5)
    .map(msg => {
      const role = msg.role === 'user' ? '学生' : '小伴';
      return `${role}: ${msg.content}`;
    })
    .join('\n');
}

module.exports = { buildPrompt };
