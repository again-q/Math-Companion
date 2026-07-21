/**
 * 数学小伴 — 通用工具函数
 */

/**
 * 格式化日期为 HH:mm
 * @param {Date|string} date - 日期对象或日期字符串
 * @returns {string} 格式化的时间
 */
function formatTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return h + ':' + m;
}

/**
 * 格式化日期为 MM月DD日 HH:mm
 * @param {Date|string} date - 日期对象或日期字符串
 * @returns {string} 格式化的日期时间
 */
function formatDateTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${month}月${day}日 ${h}:${m}`;
}

module.exports = { formatTime, formatDateTime };
