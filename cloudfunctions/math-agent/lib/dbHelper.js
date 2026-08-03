/**
 * 数学小伴 — 数据库辅助模块
 *
 * 提供云函数内数据库操作的快捷引用，
 * 避免在多个模块中重复 init。
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * 获取当前调用者的 openid（按账号隔离数据的依据）
 * 测试号/正式号各自独立的数据空间
 * 定时任务通过 global.__tcbOpenId__ 注入指定用户
 */
function getOpenId() {
  if (global.__tcbOpenId__) return global.__tcbOpenId__;
  const { OPENID } = cloud.getWXContext();
  return OPENID || '';
}

module.exports = { cloud, db, _, getOpenId };
