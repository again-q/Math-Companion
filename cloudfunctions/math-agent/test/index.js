/**
 * 数学小伴 — 测试主入口
 * 
 * 统一执行所有测试用例，输出测试报告
 */

const path = require('path');
const { TestRunner } = require('./test-runner');

// 测试文件列表
const testFiles = [
  './knowledge-progress.test.js',
  './memory.test.js',
  './conversation.test.js',
  './summary.test.js',
];

async function main() {
  const runner = new TestRunner();
  
  try {
    await runner.run(testFiles.map(f => path.join(__dirname, f)));
    process.exit(0);
  } catch (err) {
    console.error('测试执行失败:', err);
    process.exit(1);
  }
}

main();
