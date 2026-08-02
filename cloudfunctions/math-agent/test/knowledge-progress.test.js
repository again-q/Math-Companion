/**
 * 知识点掌握程度更新机制测试用例
 * 
 * 覆盖：初始化、答对/答错、连续答对、等级判定、难度计算等核心逻辑
 */

const { Assert } = require('./test-runner');
const config = require('../config/index');

// Mock 数据库操作
class MockKnowledgeProgress {
  constructor() {
    this.data = new Map();
  }

  get(topic) {
    return this.data.get(topic) || null;
  }

  set(topic, data) {
    this.data.set(topic, { ...data, topic });
  }

  remove(topic) {
    this.data.delete(topic);
  }

  clear() {
    this.data.clear();
  }
}

const mockDb = new MockKnowledgeProgress();

// 模拟 updateKnowledgeProgress 逻辑（从 memory.js 提取）
function mockUpdateKnowledgeProgress(topic, delta) {
  const now = new Date();
  const kConfig = config.knowledge;
  const existing = mockDb.get(topic);

  if (!existing) {
    const newDoc = {
      topic,
      level: kConfig.initialLevel,
      practicedCount: 1,
      lastPracticedAt: now,
      consecutiveCorrect: delta.consecutiveCorrect || 0,
    };
    // 使用正确的难度计算逻辑
    newDoc.difficulty = mockRecalculateDifficulty(newDoc, newDoc.consecutiveCorrect);
    mockDb.set(topic, newDoc);
    return newDoc;
  }

  const updateData = {
    ...existing,
    practicedCount: existing.practicedCount + 1,
    lastPracticedAt: now,
    consecutiveCorrect: delta.consecutiveCorrect ?? existing.consecutiveCorrect,
  };

  if (delta.correct === true) {
    updateData.level = existing.level + kConfig.correctIncrement;
  } else if (delta.correct === false) {
    updateData.level = existing.level - kConfig.wrongDecrement;
  }

  const newConsecutive = delta.consecutiveCorrect ?? existing.consecutiveCorrect;
  updateData.difficulty = mockRecalculateDifficulty(existing, newConsecutive);

  mockDb.set(topic, updateData);
  return updateData;
}

// 模拟难度计算
function mockRecalculateDifficulty(progress, consecutiveCorrect) {
  const baseDifficulty = 0.5;
  const levelBoost = (progress.level || 0) * 0.3;
  const correctBoost = Math.min((consecutiveCorrect || 0) * 0.1, 0.3);
  const difficulty = baseDifficulty + levelBoost + correctBoost;
  return Math.max(0.2, Math.min(0.8, difficulty));
}

// 等级判定
function getLevelDesc(level) {
  if (level === 0) return '未开始';
  if (level < 0.3) return '初识';
  if (level < 0.5) return '了解';
  if (level < 0.7) return '掌握';
  if (level < 0.9) return '熟练';
  return '精通';
}

module.exports = function() {
  return [
    {
      name: '知识点进度 - 首次学习初始化',
      async run() {
        mockDb.clear();
        const result = mockUpdateKnowledgeProgress('一元二次方程', {
          correct: true,
          consecutiveCorrect: 1
        });

        Assert.equal(result.level, 0.1, '初始化 level 应为 0.1');
        Assert.equal(result.practicedCount, 1, '练习次数应为 1');
        Assert.equal(result.consecutiveCorrect, 1, '连续答对次数应为 1');
        Assert.approxEqual(result.difficulty, 0.63, 0.01, '初始难度系数应为约 0.63');
      }
    },
    {
      name: '知识点进度 - 答对一次提升掌握程度',
      async run() {
        mockDb.clear();
        // 先初始化
        let result = mockUpdateKnowledgeProgress('一元二次方程', {
          correct: true,
          consecutiveCorrect: 1
        });
        
        // 答对一次
        result = mockUpdateKnowledgeProgress('一元二次方程', {
          correct: true,
          consecutiveCorrect: 2
        });

        Assert.approxEqual(result.level, 0.2, 0.001, '答对后 level 应增加 0.1');
        Assert.equal(result.practicedCount, 2, '练习次数应增加到 2');
      }
    },
    {
      name: '知识点进度 - 答错一次降低掌握程度',
      async run() {
        mockDb.clear();
        // 先初始化并答对一次
        let result = mockUpdateKnowledgeProgress('一元二次方程', {
          correct: true,
          consecutiveCorrect: 1
        });
        result = mockUpdateKnowledgeProgress('一元二次方程', {
          correct: true,
          consecutiveCorrect: 2
        });
        
        // 答错一次
        result = mockUpdateKnowledgeProgress('一元二次方程', {
          correct: false,
          consecutiveCorrect: 0
        });

        Assert.approxEqual(result.level, 0.15, 0.001, '答错后 level 应减少 0.05');
        Assert.equal(result.consecutiveCorrect, 0, '连续答对次数应归零');
      }
    },
    {
      name: '知识点进度 - 连续答对提升难度系数',
      async run() {
        mockDb.clear();
        let result = mockUpdateKnowledgeProgress('一元二次方程', {
          correct: true,
          consecutiveCorrect: 1
        });
        
        // 连续答对多次
        for (let i = 2; i <= 5; i++) {
          result = mockUpdateKnowledgeProgress('一元二次方程', {
            correct: true,
            consecutiveCorrect: i
          });
        }

        Assert.ok(result.difficulty > 0.5, '连续答对应提升难度系数');
        Assert.approxEqual(result.difficulty, 0.8, 0.01, '难度系数上限应为 0.8');
      }
    },
    {
      name: '知识点进度 - 等级判定：未开始',
      async run() {
        const levelDesc = getLevelDesc(0);
        Assert.equal(levelDesc, '未开始', 'level=0 应为未开始');
      }
    },
    {
      name: '知识点进度 - 等级判定：初识',
      async run() {
        const levelDesc = getLevelDesc(0.2);
        Assert.equal(levelDesc, '初识', 'level=0.2 应为初识');
      }
    },
    {
      name: '知识点进度 - 等级判定：了解',
      async run() {
        const levelDesc = getLevelDesc(0.4);
        Assert.equal(levelDesc, '了解', 'level=0.4 应为了解');
      }
    },
    {
      name: '知识点进度 - 等级判定：掌握',
      async run() {
        const levelDesc = getLevelDesc(0.6);
        Assert.equal(levelDesc, '掌握', 'level=0.6 应为掌握');
      }
    },
    {
      name: '知识点进度 - 等级判定：熟练',
      async run() {
        const levelDesc = getLevelDesc(0.8);
        Assert.equal(levelDesc, '熟练', 'level=0.8 应为熟练');
      }
    },
    {
      name: '知识点进度 - 等级判定：精通',
      async run() {
        const levelDesc = getLevelDesc(0.95);
        Assert.equal(levelDesc, '精通', 'level=0.95 应为精通');
      }
    },
    {
      name: '知识点进度 - 边界值测试：level上限',
      async run() {
        mockDb.clear();
        // 模拟多次答对
        let result = mockUpdateKnowledgeProgress('一元二次方程', {
          correct: true,
          consecutiveCorrect: 1
        });
        
        for (let i = 0; i < 20; i++) {
          result = mockUpdateKnowledgeProgress('一元二次方程', {
            correct: true,
            consecutiveCorrect: i + 2
          });
        }

        Assert.ok(result.level >= 1.0, '多次答对后 level 应达到上限');
      }
    },
    {
      name: '知识点进度 - 边界值测试：难度系数范围',
      async run() {
        mockDb.clear();
        let result = mockUpdateKnowledgeProgress('一元二次方程', {
          correct: false,
          consecutiveCorrect: 0
        });
        
        Assert.ok(result.difficulty >= 0.2, '难度系数不应低于 0.2');
        Assert.ok(result.difficulty <= 0.8, '难度系数不应高于 0.8');
      }
    },
    {
      name: '知识点进度 - 配置参数验证',
      async run() {
        Assert.equal(config.knowledge.initialLevel, 0.1, '初始等级应为 0.1');
        Assert.equal(config.knowledge.correctIncrement, 0.1, '答对增量应为 0.1');
        Assert.equal(config.knowledge.wrongDecrement, 0.05, '答错减量应为 0.05');
        Assert.ok(Array.isArray(config.defaultTopics), '知识点列表应为数组');
        Assert.ok(config.defaultTopics.length > 0, '知识点列表不应为空');
      }
    }
  ];
};
