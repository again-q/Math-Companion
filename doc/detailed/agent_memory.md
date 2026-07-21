# 数学小伴 — Agent 记忆模块详细设计

**文档编号**：DES-20260718-002
**版本**：v1.0.0
**状态**：🟡 草稿
**创建日期**：2026-07-18
**最后更新**：2026-07-18
**作者**：系统架构师
**所属层次**：Layer 1（数据层）
**关联文档**：SAD-20260718-002, DES-20260718-001

---

## 1. 功能描述

本模块负责学习者**全量记忆**的存储与检索，包含三个核心子功能：

1. **会话管理** — 创建/查询/归档会话（session），支持跨会话上下文恢复
2. **消息持久化** — 存储用户与 AI 的每一条消息，支持按会话分页加载
3. **知识点进度跟踪** — 记录每个知识点的掌握程度、学习次数、最后一次练习时间

---

## 2. 数据模型

### 2.1 集合：`sessions`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 微信云数据库自动生成 |
| `sessionId` | string | ✅ | 业务主键，格式 `sess_` + 随机字符串 |
| `status` | string | ✅ | `active` / `archived` |
| `createdAt` | date | ✅ | 创建时间 |
| `updatedAt` | date | ✅ | 最近消息时间 |
| `topic` | string | | 当前知识点话题 |
| `summary` | string | | 会话结束时的简短总结 |
| `totalMessages` | number | | 消息总数 |

**索引**：`sessionId`（唯一索引）、`status` + `updatedAt`（复合索引，用于归档查询）

### 2.2 集合：`messages`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 微信云数据库自动生成 |
| `sessionId` | string | ✅ | 所属会话 ID |
| `role` | string | ✅ | `user` / `assistant` |
| `content` | string | ✅ | 消息正文 |
| `mode` | string | | AI 回复时的对话模式（仅在 role=assistant 时有值） |
| `emotion` | string | | AI 回复时的表情状态 |
| `createdAt` | date | ✅ | 消息时间 |

**索引**：`sessionId` + `createdAt`（复合索引，用于按会话分页查询）

### 2.3 集合：`knowledge_progress`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 微信云数据库自动生成 |
| `topic` | string | ✅ | 知识点名称，例：`"三角形面积"` |
| `level` | number | ✅ | 掌握程度 0~1（0=未接触，1=精通） |
| `practicedCount` | number | ✅ | 练习次数 |
| `lastPracticedAt` | date | ✅ | 最后一次练习时间 |
| `consecutiveCorrect` | number | ✅ | 连续答对次数 |
| `difficulty` | number | ✅ | 当前难度系数 0.2~0.8（调参用） |

**索引**：`topic`（唯一索引）

---

## 3. 接口定义（伪接口 / 模块内部 API）

> 以下接口在本云函数内通过模块调用（require），不对外暴露为云函数事件。

### 3.1 `memory.getSession(sessionId)`

```
入参: { sessionId: string }
出参: { session: object | null }
逻辑:
  1. 查 sessions 集合，按 sessionId 精确匹配
  2. 若 status=archived，返回 null
  3. 返回 session 文档
```

### 3.2 `memory.createSession(topic?)`

```
入参: { topic?: string }
出参: { sessionId: string }
逻辑:
  1. 生成 sessionId: "sess_" + nanoid(16)
  2. 插入 sessions 文档
  3. 返回 sessionId
```

### 3.3 `memory.saveMessage(sessionId, role, content, options?)`

```
入参: {
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  options?: { mode?: string, emotion?: string }
}
出参: { messageId: string }
逻辑:
  1. 构建 messages 文档
  2. 插入 messages 集合
  3. 更新 sessions 的 updatedAt、totalMessages 计数器
  4. 返回 messageId
```

### 3.4 `memory.getMessages(sessionId, page, pageSize)`

```
入参: {
  sessionId: string,
  page: number,      // 从 1 开始
  pageSize: number   // 默认 20，最大 50
}
出参: {
  messages: array,
  total: number,
  hasMore: boolean
}
逻辑:
  1. 按 sessionId + createdAt 排序分页查询
  2. 默认按时间升序（最早的在前）
```

### 3.5 `memory.getTopicProgress(topic)`

```
入参: { topic: string }
出参: { progress: object | null }
逻辑:
  1. 查 knowledge_progress 集合，按 topic 精确匹配
  2. 返回掌握程度、练习次数等
```

### 3.6 `memory.updateKnowledgeProgress(topic, delta)`

```
入参: {
  topic: string,
  delta: {
    correct?: boolean,   // 本次答对/答错
    consecutiveCorrect?: number
  }
}
出参: { progress: object }
逻辑:
  1. 查 knowledge_progress 集合，按 topic 查找
  2. 若不存在，初始化（level=0.1, practicedCount=1, ...）
  3. 若存在，更新：
     - practicedCount += 1
     - lastPracticedAt = now
     - consecutiveCorrect = delta.consecutiveCorrect ?? 0
     - level = min(1, level + (correct ? 0.1 : -0.05))
     - difficulty = 按难度算法重算
  4. 更新文档
```

### 3.7 `memory.archiveSession(sessionId)`

```
入参: { sessionId: string }
出参: { success: boolean }
逻辑:
  1. 将 session 的 status 改为 archived
  2. 生成简短的对话摘要
```

### 3.8 `memory.getRecentSessions(limit)`

```
入参: { limit: number }  // 默认 5
出参: { sessions: array }
逻辑:
  1. 按 updatedAt 降序，取 status=active 的最近会话
  2. 用于对话页恢复时展示历史会话列表
```

---

## 4. 功能逻辑（伪代码）

### 4.1 上下文加载流程

```
function loadContext(sessionId):
    # 1. 获取会话
    session = getSession(sessionId)
    if not session:
        return null
    
    # 2. 获取最近 20 条消息
    messages = getMessages(sessionId, 1, 20)
    
    # 3. 获取当前知识点进度
    progress = null
    if session.topic:
        progress = getTopicProgress(session.topic)
    
    # 4. 组装上下文对象
    return {
        sessionId: session.sessionId,
        topic: session.topic,
        lastMessages: messages.messages,
        progress: progress,
        messageCount: session.totalMessages
    }
```

### 4.2 知识点难度重算

```
function recalculateDifficulty(topic):
    progress = getTopicProgress(topic)
    if not progress:
        return 0.3  # 初始难度
    
    # baseDifficulty 根据知识点层级预设
    baseDifficulty = getBaseDifficulty(topic)
    # baseDifficulty: 初一=0.3, 初二=0.5, 初三=0.7
    
    # 掌握程度越好，难度越高（自动提升层级的依据）
    levelBoost = progress.level * 0.3
    
    # 连续答对越多，难度越高
    correctBoost = min(progress.consecutiveCorrect * 0.1, 0.3)
    
    difficulty = baseDifficulty + levelBoost + correctBoost
    
    # 限制在合理范围
    return clamp(difficulty, 0.2, 0.8)
```

### 4.3 会话归档定时任务

```
function archiveOldSessions():
    # 查找超过 24 小时未更新的 active 会话
    cutoff = now - 24h
    oldSessions = db.collection('sessions')
        .where({ status: 'active', updatedAt: db.command.lt(cutoff) })
        .get()
    
    for session in oldSessions:
        archiveSession(session.sessionId)
```

---

## 5. 数据库性能设计

| 场景 | 方案 |
|------|------|
| 消息大量增长 | 单会话消息上限 1000 条，超限时自动归档最早消息 |
| 知识点数量 | 预计不超过 200 个（初中数学范围），无需分片 |
| 查询热点 | sessions 的 status+updatedAt 复合索引覆盖归档查询 |
| 写入频次 | 每次对话 1 条 user + 1 条 assistant，低频写入无需优化 |

---

## 6. 数据安全

- 所有集合的读写权限设为 `只允许管理员`（云函数内通过 `wx-server-sdk` 调用，不上传用户自定义规则）
- 不在日志中输出 `content` 字段内容（仅记录 sessionId 和操作类型）
- 定期归档：超过 30 天的 archived 会话可被自动清理

---

## 7. 内部接口依赖

| 依赖 | 用途 |
|------|------|
| `wx-server-sdk` | 云数据库 CRUD |
| `nanoid` | 生成 sessionId |

---

## 8. 测试要点

| 测试场景 | 预期结果 |
|---------|---------|
| 创建新会话 | 插入 sessions 文档，返回 sessionId |
| 发送消息后查看上下文 | 最近消息在返回列表中 |
| 同一知识点重复练习 | level 逐渐提升 |
| 连续答对后难度 | difficulty 数值升高 |
| 会话超过 24h 未更新 | 自动归档 |
| 查询不存在的 topic | 返回 null |
| messages 超过 1000 条 | 最早消息被自动归档 |

---

## 变更记录

| 版本 | 日期 | 变更类型 | 变更内容 | 变更人 |
|------|------|---------|---------|--------|
| v1.0.0 | 2026-07-18 | 🆕 新建 | 初始版本 | 系统架构师 |
