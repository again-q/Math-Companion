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

module.exports = { cloud, db, _ };
