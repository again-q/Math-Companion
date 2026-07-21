# 数学小伴 — Agent 编码指令

**文档编号**：DES-20260718-005
**版本**：v1.0.0
**状态**：🟡 草稿
**创建日期**：2026-07-18
**最后更新**：2026-07-18

---

> 本文档是给编码 AI（Gatekeeper）的完整指令，指导其按照详细设计文档实现可工作的代码。

---

## 1. 整体说明

### 1.1 项目定位

「数学小伴」是一个微信小程序 + 微信云函数项目，AI 角色是一只名叫"小伴"的粉白色小兔子，通过苏格拉底式对话帮助一名初三女生提高数学成绩。

### 1.2 关键约束

| 约束 | 说明 |
|------|------|
| 用户数 | 单人使用，不需要登录鉴权 |
| 数据存储 | 微信云数据库（NoSQL） |
| AI 模型 | DeepSeek API |
| 前端框架 | 微信原生小程序 |
| 后端 | 微信云函数（Node.js 18.x） |
| 包管理 | npm（云函数内 package.json） |

---

## 2. 编码阶段顺序

请严格按照以下顺序编码，后面的步骤依赖前面的产出物。

### Step 1：云函数基础框架

**目标**：创建 `cloudfunctions/math-agent/` 云函数，建立完整目录结构和入口分发

**待实现文件**：
```
cloudfunctions/math-agent/
├── index.js              ← 入口：事件分发路由
├── package.json          ← 依赖：@cloudbase/node-sdk, nanoid
├── config/
│   └── index.js          ← 配置常量（环境变量读取）
└── handlers/             ← 占位，后续实现
    ├── sendMessage.js    ← (占位)
    └── getSummary.js     ← (占位)
```

**验证**：部署云函数后调用 `type: 'ping'` 返回 `{ code: 0, pong: true }`

### Step 2：记忆模块（Memory）

**目标**：实现 `services/memory.js`，封装 8 个数据访问接口

**详细设计参考**：`doc/detailed/agent_memory.md`

**需实现接口**：
1. `getSession(sessionId)` — 查会话
2. `createSession(topic?)` — 创建新会话
3. `saveMessage(sessionId, role, content, options?)` — 保存消息
4. `getMessages(sessionId, page, pageSize)` — 分页查询消息
5. `getTopicProgress(topic)` — 查知识点进度
6. `updateKnowledgeProgress(topic, delta)` — 更新知识点进度
7. `archiveSession(sessionId)` — 归档会话
8. `getRecentSessions(limit)` — 最近活跃会话

**接口契约**：见 `doc/detailed/agent_memory.md` 第 3 节

**数据模型**：见 `doc/detailed/agent_memory.md` 第 2 节

### Step 3：DeepSeek API 封装

**目标**：实现 `lib/deepseek.js`，封装 AI 模型调用

**待实现文件**：
```
cloudfunctions/math-agent/
└── lib/
    ├── deepseek.js       ← DeepSeek API 调用
    └── prompts.js        ← 三种模式的 prompt 模板
```

**接口**：
```javascript
// deepseek.js
async function callDeepSeek(prompt, options = {})

// prompts.js
function buildPrompt(mode, context, userContent, state)
```

**调用方式**：HTTP POST 流式 / 非流式（初期非流式即可）
- API: `https://api.deepseek.com/chat/completions`
- Model: `deepseek-chat`

### Step 4：认知策略引擎

**目标**：实现 `services/strategy.js`，封装模式选择和难度计算

**待实现文件**：
```
cloudfunctions/math-agent/
└── services/
    └── strategy.js       ← 策略引擎
```

**需实现函数**：
1. `analyzeState(context, content)` — 分析用户状态（情绪、连续答对、难度）
2. `selectMode(state)` — 选择教学模式
3. `deriveEmotion(mode)` — 根据模式映射 AI 表情
4. `calculateDifficulty(topic, progress)` — 难度计算

**算法参考**：`doc/detailed/agent_conversation.md` 第 4-5 节

### Step 5：对话业务逻辑

**目标**：实现 `services/conversation.js`，串联记忆 + 策略引擎 + DeepSeek

**待实现文件**：
```
cloudfunctions/math-agent/
└── services/
    └── conversation.js   ← 对话主逻辑
```

**需实现函数**：
1. `handleMessage(sessionId, content, topic)` — 消息处理主流程
2. `buildContext(sessionId)` — 加载上下文
3. `generateSummary(sessions)` — 生成学习总结

**流程参考**：`doc/detailed/agent_conversation.md` 第 4.1 节

### Step 6：对话云函数处理器

**目标**：实现 `handlers/sendMessage.js` 和 `handlers/getSummary.js`，调用 service 层

**待实现文件**：
```
cloudfunctions/math-agent/
└── handlers/
    ├── sendMessage.js    ← 处理 sendMessage 事件
    └── getSummary.js     ← 处理 getSummary 事件
```

### Step 7：小程序对话页

**目标**：实现 `miniprogram/pages/chat/` 全部四个文件

**详细设计参考**：`doc/detailed/小程序_chat.md`

**待实现文件**：
```
miniprogram/pages/chat/
├── chat.js               ← 页面逻辑
├── chat.json             ← 页面配置
├── chat.wxml             ← 页面结构
└── chat.wxss             ← 页面样式
```

**关键功能**：
- 消息列表展示（自动滚动）
- 文字输入与发送
- AI 流式回复展示（打字机效果）
- 兔子角色展示（CSS动画）
- 语音输入（P1，可后补）
- 三种模式指示

### Step 8：小程序服务层

**目标**：封装云函数调用

**待实现文件**：
```
miniprogram/
└── services/
    └── chat-service.js   ← 云函数调用封装
```

**接口**：
```javascript
async function sendMessage(sessionId, content)
async function getSummary(scope)
```

---

## 3. 编码特殊要求

### 3.1 错误处理

所有云函数 handler 必须 try-catch，按 `{ code, error }` 格式返回。

### 3.2 日志规范

```javascript
console.log(`[math-agent] sendMessage session=${sessionId} len=${content.length}`);
console.error(`[math-agent] sendMessage 失败:`, err.message);
```

- 不记录完整 messages content
- 每个关键步骤打一行日志

### 3.3 环境变量

使用 `config/index.js` 集中管理：

```javascript
module.exports = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: 'deepseek-chat',
    timeout: 10000,
    maxRetries: 2,
  },
  session: {
    maxMessages: 1000,
    archiveAfterHours: 24,
  },
};
```

### 3.4 输入校验

云函数 handler 入口必须校验参数：

```javascript
if (!data || !data.content || typeof data.content !== 'string') {
  return { code: 400, error: '消息内容不能为空' };
}
if (data.content.length > 2000) {
  return { code: 400, error: '消息内容过长' };
}
```

### 3.5 记得 AI 人设

AI 角色是一只粉白色小兔子，名叫「小伴」：
- 温暖活泼的语气
- 用提问引导思考（苏格拉底式）
- 不贴标签式的表扬
- 不贬低或否定用户回答
- 用户说"不想学"时立即停止教学

---

## 4. 验证清单

编码完成后须验证以下事项：

| # | 验证项 | 预期 |
|---|--------|------|
| 1 | 云函数部署 | `tcb cloud functions deploy math-agent` 成功 |
| 2 | 云函数 ping | `type: 'ping'` → `{ code: 0, pong: true }` |
| 3 | 新建会话 | 发送消息，返回 sessionId |
| 4 | 跨会话记忆 | 同一 topic 第二次对话时 progress 不变 |
| 5 | 连续答对后难度 | difficulty 数值升高 |
| 6 | 用户说"不想学了" | 模式切为 companion |
| 7 | 小程序发送消息 | 消息出现在列表中 |
| 8 | AI 打字效果 | 消息逐字出现 |
| 9 | 空状态 | 新用户看到引导文案 |
| 10 | 网络异常重试 | 显示友好提示 |

---

## 5. 不在此次编码范围内的功能

- 话题选择页（`pages/topics/`）— P2 后续迭代
- 学习总结页（`pages/summary/`）— P2 后续迭代
- 语音输入完整实现 — P1 可后补（先使用文字输入）
- 兔子角色 PNG 素材 — 使用 CSS 动画 + emoji 替代

---

## 变更记录

| 版本 | 日期 | 变更类型 | 变更内容 | 变更人 |
|------|------|---------|---------|--------|
| v1.0.0 | 2026-07-18 | 🆕 新建 | 初始版本 | 系统架构师 |
