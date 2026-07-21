/**
 * 数学小伴 — 云函数入口
 * 统一事件分发路由
 */
const { sendMessage } = require('./handlers/sendMessage');
const { getSummary } = require('./handlers/getSummary');
const { getConfig, setConfig } = require('./handlers/config');
const { getSessions, createSession, deleteSession, renameSession } = require('./handlers/sessions');
const { handleGetMessages } = require('./handlers/getMessages');
const { getProfile, updateProfile, addExp } = require('./handlers/profile');
const { rebuildMemory } = require('./services/memory-builder');

exports.main = async (event, context) => {
  const { type, data } = event;

  // 健康检查
  if (type === 'ping') {
    return { code: 0, pong: true };
  }

  if (!type && event.timerType === 'dailyMemoryRebuild') {
    console.log('[math-agent] 定时任务触发：重建 memory');
    try {
      await rebuildMemory();
      return { code: 0, message: 'memory 重建完成' };
    } catch (e) {
      console.error('[math-agent] 定时任务失败:', e);
      return { code: 500, error: 'memory 重建失败' };
    }
  }

  try {
    switch (type) {
      case 'sendMessage':
        return await sendMessage(data, context);
      case 'getSummary':
        return await getSummary(data, context);
      case 'getConfig':
        return await getConfig(data);
      case 'setConfig':
        return await setConfig(data);
      case 'getSessions':
        return await getSessions(data);
      case 'createSession':
        return await createSession(data);
      case 'deleteSession':
        return await deleteSession(data);
      case 'renameSession':
        return await renameSession(data);
      case 'getMessages':
        return await handleGetMessages(data);
      case 'getProfile':
        return await getProfile(data);
      case 'updateProfile':
        return await updateProfile(data);
      case 'addExp':
        return await addExp(data);
      case 'rebuildMemory':
        await rebuildMemory();
        return { code: 0, message: 'memory 重建完成' };
      default:
        console.error(`[math-agent] 未知事件类型: ${type}`);
        return { code: 400, error: `未知事件类型: ${type}` };
    }
  } catch (err) {
    console.error(`[math-agent] 处理 ${type} 失败:`, err.message);
    return { code: 500, error: '服务内部错误，请稍后再试' };
  }
};
