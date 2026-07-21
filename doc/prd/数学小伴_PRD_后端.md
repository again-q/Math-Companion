# 数学小伴 — PRD 后端（多会话管理）

| 项目 | 内容 |
|---|---|
| **端类型** | 后端（云函数 Node.js + 云数据库 NoSQL） |
| **云函数** | `math-agent`（已有入口，新增 handler） |
| **数据库** | 云开发 NoSQL（集合 `mt_sessions` 已有，需扩展字段） |

---

## 1. 数据库设计

### 1.1 集合：`mt_sessions`（已有，扩展字段）

当前 `mt_sessions` 集合已有如下字段（`memory.js` 中定义）：

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `_id` | string | 自动 | 文档 ID |
| `sessionId` | string | ✅ | 会话唯一标识，格式 `sess_` + nanoid(16) |
| `status` | string | ✅ | `'active'` / `'archived'` |
| `createdAt` | Date | ✅ | 创建时间 |
| `updatedAt` | Date | ✅ | 最近活动时间 |
| `topic` | string | ❌ | 知识点话题（如"二次函数"） |
| `totalMessages` | number | ✅ | 消息总数，默认 0 |

**本次新增/变更字段：**

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `title` | string | ❌ | 自动生成 | 会话标题，首次对话时从第一条用户消息截取前 20 字 |
| `isDeleted` | boolean | ❌ | `false` | 软删除标记 |
| `deletedAt` | Date | ❌ | — | 删除时间 |

**索引建议：**

| 索引字段 | 方向 | 说明 |
|---|---|---|
| `updatedAt` | desc | 列表按时间排序（已有） |
| `isDeleted`, `updatedAt` | — | 复合索引：筛选未删除的会话 |
| `sessionId` | — | 唯一查询（已有 _id 可替代） |

### 1.2 集合：`mt_messages`（无变更）

已有字段 `sessionId`, `role`, `content`, `createdAt`, `mode`, `emotion`。本次无变更。

### 1.3 集合：`mt_knowledge_progress`（无变更）

已有知识点进度数据，本次无变更。

---

## 2. 云函数接口设计

### 2.1 `type: 'getSessions'` — 获取会话列表（增强已有）

**当前实现**（`handlers/sessions.js`）：仅返回所有会话，按 `updatedAt` 降序，limit 50。

**增强需求：**

```javascript
// 请求
{ type: 'getSessions', data: {} }

// 响应
{
  code: 0,
  data: [
    {
      sessionId: 'sess_xxx',
      title: '二次函数顶点式讨...',  // 新增：从第一条用户消息截取
      topic: '二次函数',
      totalMessages: 12,
      updatedAt: '2026-01-15T10:30:00Z',
      createdAt: '2026-01-14T08:00:00Z',
      lastMessage: '那我们来看一道例题...', // 新增：最后一条消息预览
    },
    // ...
  ]
}
```

**变更内容：**
- BR-006：过滤条件增加 `isDeleted: false`（或 `!= true`）
- BR-007：返回字段增加 `title`（自动生成标题）和 `lastMessage`（最后一条消息预览）
- 数据来源：`lastMessage` 从 `mt_messages` 集合查询该会话最后一条消息的 `content`

### 2.2 `type: 'createSession'` — 新建会话（新增）

```javascript
// 请求
{ type: 'createSession', data: { topic?: string } }

// 响应
{ code: 0, data: { sessionId: 'sess_xxx' } }
```

### 2.3 `type: 'deleteSession'` — 删除会话（新增）

**采用软删除策略。**

```javascript
// 请求
{ type: 'deleteSession', data: { sessionId: 'sess_xxx' } }

// 响应
{ code: 0, data: { success: true } }
```

### 2.4 `type: 'renameSession'` — 重命名会话（新增）

```javascript
// 请求
{ type: 'renameSession', data: { sessionId: 'sess_xxx', title: '二次函数顶点式' } }

// 响应
{ code: 0, data: { success: true } }
```

### 2.5 `type: 'getSessionDetail'` — 获取单个会话详情（新增）

```javascript
// 请求
{ type: 'getSessionDetail', data: { sessionId: 'sess_xxx' } }

// 响应
{
  code: 0,
  data: {
    sessionId: 'sess_xxx',
    title: '二次函数顶点式讨...',
    topic: '二次函数',
    totalMessages: 12,
    createdAt: '2026-01-14T08:00:00Z',
    updatedAt: '2026-01-15T10:30:00Z',
  }
}
```

---

## 3. 业务规则

| 编号 | 规则 | 说明 | 端 |
|---|---|---|---|
| BR-006 | 会话列表过滤软删除 | 查询列表时需过滤 `isDeleted` 不为 `true` 的记录 | 后端 |
| BR-007 | 自动生成会话标题 | 新会话收到第一条用户消息时，截取其内容前 20 字作为 `title`（去除首尾空格+省略号结尾装饰） | 后端 |
| BR-008 | 最少保留一条会话 | 删除时若用户仅剩最后一条活跃会话，提示用户"至少保留一个会话"而非真正删除 | 全部 |
| BR-009 | 标题长度限制 | 会话标题最长 50 字，超出截断 | 后端 + 小程序 |
| BR-010 | 删除二次确认 | 删除会话前必须在弹窗中二次确认 | 小程序 |
| BR-011 | 已有标题优先 | 重命名后标题以用户自定义为准，不再被自动生成覆盖 | 后端 |
| BR-012 | 会话上限提醒 | 会话数 ≥ 80 时在新建时提示"接近上限"；≥ 100 时阻止新建 | 后端 |
| BR-013 | 切换会话自动保存 | 切换会话前若当前会话有未发送的内容，自动保存到缓存 | 小程序 |

---

## 4. 需要修改的文件清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `cloudfunctions/math-agent/handlers/sessions.js` | 重写 | 增强 `getSessions`，新增 `createSession`/`deleteSession`/`renameSession`/`getSessionDetail` |
| `cloudfunctions/math-agent/index.js` | 修改 | 注册新增的 type 路由 |
| `cloudfunctions/math-agent/services/memory.js` | 修改 | 新增 `renameSession`/`softDeleteSession`/`getLastMessage` 方法；修改 `createSession` 增加 `title` 参数 |
| `cloudfunctions/math-agent/services/conversation.js` | 修改 | 首次消息时自动设置 `title`（BR-007） |
