/**
 * 数学小伴 — 自动化测试运行器
 * 
 * 统一执行所有测试用例，收集测试结果，生成清晰的测试报告。
 * 支持：单元测试、集成测试、Mock数据、详细报告输出。
 */

const fs = require('fs');
const path = require('path');

class TestRunner {
  constructor() {
    this.results = [];
    this.startTime = null;
    this.endTime = null;
    this.passedCount = 0;
    this.failedCount = 0;
    this.skippedCount = 0;
  }

  async run(testFiles) {
    this.startTime = Date.now();
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('              🧪 数学小伴自动化测试套件');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    for (const testFile of testFiles) {
      await this.runTestFile(testFile);
    }

    this.endTime = Date.now();
    this.generateReport();
  }

  async runTestFile(filePath) {
    const moduleName = path.basename(filePath, '.test.js');
    console.log(`📦 开始测试模块: ${moduleName}`);
    console.log('─'.repeat(50));

    try {
      const testModule = require(filePath);
      let testCases = [];
      
      if (typeof testModule === 'function') {
        testCases = testModule();
      } else if (testModule.default && typeof testModule.default === 'function') {
        testCases = testModule.default();
      } else if (testModule.tests && Array.isArray(testModule.tests)) {
        testCases = testModule.tests;
      } else {
        console.log(`  ⚠️ 测试文件格式不正确: ${filePath}`);
        return;
      }
      
      await this.executeTestCases(testCases, moduleName);
    } catch (err) {
      console.log(`  ❌ 加载测试文件失败: ${err.message}`);
      this.results.push({
        module: moduleName,
        name: '文件加载失败',
        status: 'error',
        duration: 0,
        error: err.message
      });
      this.failedCount++;
    }

    console.log('');
  }

  async executeTestCases(testCases, moduleName) {
    for (const testCase of testCases) {
      await this.runTestCase(testCase, moduleName);
    }
  }

  async runTestCase(testCase, moduleName) {
    const startTime = Date.now();
    let status = 'passed';
    let error = null;

    console.log(`  🧪 ${testCase.name}`);

    try {
      await testCase.run();
      console.log(`     ✅ 通过`);
      this.passedCount++;
    } catch (err) {
      status = 'failed';
      error = err.message;
      console.log(`     ❌ 失败: ${err.message}`);
      this.failedCount++;
    }

    const duration = Date.now() - startTime;

    this.results.push({
      module: moduleName,
      name: testCase.name,
      status,
      duration,
      error
    });
  }

  generateReport() {
    const totalTime = this.endTime - this.startTime;
    const totalTests = this.passedCount + this.failedCount + this.skippedCount;
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                     📊 测试报告');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    // 摘要统计
    console.log('【测试摘要】');
    console.log('─'.repeat(30));
    console.log(`  总测试用例: ${totalTests}`);
    console.log(`  ✅ 通过: ${this.passedCount}`);
    console.log(`  ❌ 失败: ${this.failedCount}`);
    console.log(`  ⏭️  跳过: ${this.skippedCount}`);
    console.log(`  🕐 总耗时: ${totalTime}ms`);
    console.log('');

    // 详细结果
    console.log('【详细结果】');
    console.log('─'.repeat(30));
    
    const modules = {};
    this.results.forEach(result => {
      if (!modules[result.module]) {
        modules[result.module] = [];
      }
      modules[result.module].push(result);
    });

    for (const [module, tests] of Object.entries(modules)) {
      console.log(`\n  📦 ${module}`);
      
      tests.forEach(test => {
        const statusIcon = test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⏭️';
        console.log(`    ${statusIcon} ${test.name} (${test.duration}ms)`);
        if (test.error) {
          console.log(`       └─ 错误: ${test.error}`);
        }
      });
    }

    console.log('');
    
    // 最终结论
    console.log('【结论】');
    console.log('─'.repeat(30));
    if (this.failedCount === 0) {
      console.log('  🎉 所有测试用例通过！');
    } else {
      console.log(`  ⚠️ 有 ${this.failedCount} 个测试用例失败，请检查上述错误信息。`);
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');

    // 返回结果供调用者使用
    return {
      totalTests,
      passed: this.passedCount,
      failed: this.failedCount,
      skipped: this.skippedCount,
      duration: totalTime,
      results: this.results
    };
  }
}

// 断言工具
class Assert {
  static equal(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `期望值: ${expected}, 实际值: ${actual}`);
    }
  }

  static notEqual(actual, expected, message) {
    if (actual === expected) {
      throw new Error(message || `不应相等: ${actual}`);
    }
  }

  static deepEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(message || `深度比较失败\n期望: ${JSON.stringify(expected)}\n实际: ${JSON.stringify(actual)}`);
    }
  }

  static ok(value, message) {
    if (!value) {
      throw new Error(message || `断言失败: ${value}`);
    }
  }

  static fail(message) {
    throw new Error(message || '测试失败');
  }

  static throws(fn, expectedError, message) {
    try {
      fn();
      throw new Error(message || '预期抛出异常，但未抛出');
    } catch (err) {
      if (expectedError && !err.message.includes(expectedError)) {
        throw new Error(message || `预期错误: ${expectedError}, 实际错误: ${err.message}`);
      }
    }
  }

  static approxEqual(actual, expected, tolerance = 0.001, message) {
    const diff = Math.abs(actual - expected);
    if (diff > tolerance) {
      throw new Error(message || `近似比较失败: ${actual} ≠ ${expected} (误差: ${diff})`);
    }
  }
}

module.exports = { TestRunner, Assert };
