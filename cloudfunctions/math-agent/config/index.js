/**
 * 数学小伴 — 配置常量
 * 所有环境变量在此集中管理
 */
const config = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || 'sk-fce1650c69884aba9b225ce8f910e290',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: 'deepseek-chat',
    timeout: 10000,
    maxRetries: 2,
  },
  session: {
    maxMessages: 1000,
    archiveAfterHours: 24,
    pageSize: 20,
  },
  knowledge: {
    initialLevel: 0.1,
    correctIncrement: 0.1,
    wrongDecrement: 0.05,
    consecutiveBoost: 0.1,
    maxConsecutiveBoost: 0.3,
  },
  defaultTopics: [
    '有理数',
    '整式的加减',
    '一元一次方程',
    '几何图形初步',
    '相交线与平行线',
    '实数',
    '平面直角坐标系',
    '二元一次方程组',
    '不等式与不等式组',
    '数据的收集整理与描述',
    '三角形',
    '全等三角形',
    '轴对称',
    '整式的乘法与因式分解',
    '分式',
    '二次根式',
    '勾股定理',
    '平行四边形',
    '一次函数',
    '数据的分析',
    '一元二次方程',
    '二次函数',
    '旋转',
    '圆',
    '概率初步',
    '反比例函数',
    '相似三角形',
    '锐角三角函数',
    '投影与视图',
  ],
  topicGroups: {
    '初一上册': ['有理数', '整式的加减', '一元一次方程', '几何图形初步'],
    '初一下册': ['相交线与平行线', '实数', '平面直角坐标系', '二元一次方程组', '不等式与不等式组', '数据的收集整理与描述'],
    '初二上册': ['三角形', '全等三角形', '轴对称', '整式的乘法与因式分解', '分式'],
    '初二下册': ['二次根式', '勾股定理', '平行四边形', '一次函数', '数据的分析'],
    '初三上册': ['一元二次方程', '二次函数', '旋转', '圆', '概率初步'],
    '初三下册': ['反比例函数', '相似三角形', '锐角三角函数', '投影与视图'],
  },
};

module.exports = config;
