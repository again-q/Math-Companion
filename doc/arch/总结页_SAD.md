# 总结页 SAD — 架构设计文档

- **文档编号**: SAD-SUMMARY-20260720-001
- **版本**: v1.0.0
- **状态**: 🟡 草稿
- **创建日期**: 2026-07-20
- **作者**: AI 助手
- **关联 PRD**: `doc/prd/总结页_PRD_概览.md`

## 1. 引言

### 1.1 目的

本文档描述「数学小伴」微信小程序中**总结页（Summary）** 模块的软件架构设计，涵盖数据流、组件划分、数据模型、接口定义、缓存策略等。作为详细设计（task-decomposer）和编码（gatekeeper）的上游输入。

### 1.2 范围

本文档仅覆盖总结页模块，不涉及对话页、记忆页、设置页等其他模块。

### 1.3 术语表

| 术语 | 说明 |
|------|------|
| 总结页 | 底部 Tab「总结」对应的页面，展示学习历程 |
| 学习会话 | 用户与 AI 之间的一次完整对话 |
| 知识点掌握度 | 0~1 之间的浮点数，表示用户对某个知识点的掌握程度 |
| 学习建议 | 根据学习数据自动生成的文字建议 |

## 2. 架构概览

### 2.1 系统上下文

```
┌─────────────────────────────────────────────────────┐
│                  微信小程序                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ 对话页   │  │ 总结页   │  │ 记忆页   │  ...     │
│  └──────────┘  └────┬─────┘  └──────────┘         │
│                     │                               │
│              ┌──────┴──────┐                        │
│              │ chat-service │ (JS 服务层)            │
│              └──────┬──────┘                        │
│                     │ wx.cloud.callFunction          │
└─────────────────────┼───────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────┐
│         云函数环境   │                                │
│          ┌──────────┴──────────┐                    │
│          │   math-agent 云函数  │                    │
│          │   ┌──────────────┐  │                    │
│          │   │ getSummary   │  │                    │
│          │   │ handler      │  │                    │
│          │   └──────┬───────┘  │                    │
│          │          │          │                    │
│          │   ┌──────┴───────┐  │                    │
│          │   │ conversation │  │                    │
│          │   │ generateSum- │  │                    │
│          │   │ mary()       │  │                    │
│          │   └──────┬───────┘  │                    │
│          │          │          │                    │
│          │   ┌──────┴───────┐  │                    │
│          │   │   memory     │  │                    │
│          │   │ (数据访问层)  │  │                    │
│          │   └──────┬───────┘  │                    │
│          └──────────┼──────────┘                    │
│                     │                               │
│          ┌──────────┴──────────┐                    │
│          │    云数据库          │                    │
│          │  mt_sessions        │                    │
│          │  mt_messages        │                    │
│          │  mt_knowledge_progress                   │
│          │  mt_profile         │                    │
│          └─────────────────────┘                    │
└─────────────────────────────────────────────────────┘
```

### 2.2 架构风格

分层架构（Layered Architecture），自顶向下：

| 层 | 组件 | 职责 |
|----|------|------|
| 表现层 | `summary.js/wxml/wxss` | 页面渲染、用户交互、动画 |
| 服务层 | `chat-service.js` | 封装云函数调用，提供 Promise 接口 |
| 函数层 | `math-agent` 云函数 | 请求路由、业务编排 |
| 服务层 | `conversation.js` | 总结生成、数据聚合、建议生成 |
| 数据层 | `memory.js` | 数据库 CRUD 操作 |
| 存储层 | 云数据库（NoSQL） | 数据持久化 |

## 3. 技术栈

| 组件 | 技术选型 | 选型理由 |
|------|---------|---------|
| 小程序前端 | 原生微信小程序框架 | 已有项目使用，无需引入额外框架 |
| 云函数运行时 | Node.js 18 | 微信云开发默认支持，兼容现有代码 |
| 数据库 | 微信云开发 NoSQL（MongoDB 兼容） | 已有项目使用，文档型适合学习记录存储 |
| AI 模型 | DeepSeek Chat API（通过 `deepseek.js` 封装） | 已有集成，用于生成学习总结文字 |
| 总结缓存 | 云数据库 `mt_profile` 集合 | 与用户学习档案同位置，减少查询次数 |

## 4. 非功能需求

| 属性 | 指标 | 实现策略 |
|------|------|---------|
| 响应时间 | 95% 的请求在 3 秒内返回 | 总结缓存减少 AI 调用次数；数据库查询加索引 |
| 可用性 | 99.9%（云开发平台保障） | 依赖微信云开发基础设施 |
| 数据一致性 | 最终一致性，误差 ≤ 1 | 统计数据直接基于数据库记录计算 |
| 可维护性 | 分层清晰，每层职责单一 | 严格按 handler → service → data 分层 |

## 5. 组件划分

### 5.1 前端组件

| 组件 | 文件 | 职责 |
|------|------|------|
| 统计卡片 | `summary.wxml` | 展示四个统计数字卡片 |
| 进度条列表 | `summary.wxml` | 知识点掌握度进度条 |
| 建议列表 | `summary.wxml` | 学习建议展示 |
| AI 总结卡片 | `summary.wxml` | AI「小伴说」展示 |
| 范围切换 | `summary.wxml` | 近期/全部切换控件 |
| 页面逻辑 | `summary.js` | 数据加载、状态管理 |
| 页面样式 | `summary.wxss` | 页面样式 |

### 5.2 后端组件

| 组件 | 文件 | 职责 |
|------|------|------|
| Handler | `handlers/getSummary.js` | 请求入口，校验参数，调用 service |
| Service | `services/conversation.js` | `generateSummary()` 聚合数据、生成建议、调用 AI |
| Data | `services/memory.js` | `getRecentSessions()`, `getTopicProgress()` 等数据库操作 |
| AI | `lib/deepseek.js` | DeepSeek API 调用封装 |

## 6. 数据流

### 6.1 主要数据流

```
用户进入总结页
  │
  ▼
summary.js onLoad/onShow
  │
  ▼
chatService.getSummary(scope)
  │  ┌─ wx.cloud.callFunction({ type: 'getSummary', data: { scope } })
  ▼
math-agent 云函数
  │
  ▼
getSummary handler
  │
  ▼
conversation.generateSummary({ scope })
  │
  ├──→ memory.getRecentSessions(limit) ──→ 云数据库 mt_sessions
  │
  ├──→ 遍历 sessions，聚合 totalSessions / totalMessages / learningDays
  │
  ├──→ 遍历 topics，调用 memory.getTopicProgress(topic) ──→ 云数据库 mt_knowledge_progress
  │
  ├──→ 生成 topicsCovered 列表（含 levelDesc 等级描述）
  │
  ├──→ 根据统计数据生成 suggestions 列表
  │
  └──→ 组装 summary 文字（含所有统计数据和鼓励语气）
  │
  ▼
返回 { summary, topicsCovered, totalSessions, totalMessages, learningDays, stats, suggestions }
  │
  ▼
summary.js setData → WXML 渲染
```

### 6.2 数据范围切换流

```
用户点击「全部历史」
  │
  ▼
summary.js 调用 chatService.getSummary('all')
  │
  ▼
云函数 generateSummary({ scope: 'all' })
  │
  ▼
memory.getRecentSessions(100)  ← 返回 100 条
  │
  ▼
剩余流程同主要数据流，但基于全部数据聚合
```

## 7. 数据模型

### 7.1 核心集合

**mt_sessions（学习会话）**
| 字段 | 类型 | 说明 |
|------|------|------|
| sessionId | string | 会话唯一 ID |
| status | string | 状态：active / archived |
| title | string | 会话标题 |
| topic | string | 关联知识点 |
| totalMessages | number | 消息总数 |
| createdAt | Date | 创建时间 |
| updatedAt | Date | 最后更新时间 |
| isDeleted | boolean | 是否软删除 |

**mt_messages（消息）**
| 字段 | 类型 | 说明 |
|------|------|------|
| sessionId | string | 所属会话 ID |
| role | string | user / assistant |
| content | string | 消息内容 |
| createdAt | Date | 创建时间 |
| emotion | string | 回复情绪（assistant 消息） |

**mt_knowledge_progress（知识点进度）**
| 字段 | 类型 | 说明 |
|------|------|------|
| topic | string | 知识点名称 |
| level | number | 掌握程度 0~1 |
| practicedCount | number | 练习次数 |
| consecutiveCorrect | number | 连续答对次数 |
| difficulty | number | 难度系数 |
| lastPracticedAt | Date | 上次练习时间 |

**mt_profile（用户档案）**
| 字段 | 类型 | 说明 |
|------|------|------|
| lastSummary | string | 上次生成的总结缓存 |
| lastSummaryUpdatedAt | Date | 总结生成时间 |
| summaryNeedsUpdate | boolean | 总结是否需要更新 |

### 7.2 核心查询

| 查询 | 涉及集合 | 用途 |
|------|---------|------|
| 按 updatedAt 倒序查活跃会话 | mt_sessions | 获取学习次数和消息数 |
| 按 sessionId 查消息 | mt_messages | 获取 totalMessages 汇总 |
| 按 topic 查知识点进度 | mt_knowledge_progress | 获取掌握度 |
| 按 profile 查总结缓存 | mt_profile | 缓存读取/写入 |

## 8. 接口设计

### 8.1 云函数接口

| 端点 | 方法 | 说明 |
|------|------|------|
| getSummary | 云函数调用 (type: 'getSummary') | 获取学习总结数据 |

### 8.2 请求/响应

**请求**：`{ scope: 'recent' | 'all' }`
**响应**：`{ code: 0, data: { summary, topicsCovered, totalSessions, totalMessages, learningDays, stats, suggestions } }`

详见 PRD 后端文档第 4 节。

## 9. 安全设计

### 9.1 数据访问控制

- 云函数通过 `wx-server-sdk` 访问数据库，使用云开发环境默认权限
- 用户数据通过 sessionId 关联，不涉及跨用户数据访问
- 数据库查询基于 `isDeleted: false` 和 `status: 'active'` 条件过滤

### 9.2 输入校验

- 云函数 handler 校验 `scope` 参数仅接受 'recent' 或 'all'
- 分页参数限制最大 50 条

## 10. 缓存策略

### 10.1 总结缓存

| 项 | 说明 |
|----|------|
| 缓存位置 | `mt_profile` 集合 |
| 缓存内容 | 上次生成的 summary 文字 |
| 更新条件 | 用户完成一次完整学习会话（≥1 轮问答）后标记 `summaryNeedsUpdate=true` |
| 过期策略 | 无自动过期，随用户数据永久保存 |

### 10.2 统计数据

统计数据不缓存，每次进入总结页时实时计算。由于数据量小（近期 10 条/全部 100 条），实时查询性能可接受。

## 11. 错误处理

| 异常场景 | 处理方式 |
|---------|---------|
| 数据库查询失败 | 返回 `{ code: 500, error: '生成总结失败' }`，前端显示空状态 |
| 用户无任何学习记录 | 返回空数据 `{ totalSessions: 0, ... }`，前端显示空状态引导 |
| 网络超时 | 云函数超时 5 秒，前端 loading 超时 3 秒后显示空状态 |

## 12. 部署视图

| 组件 | 部署位置 | 说明 |
|------|---------|------|
| 小程序页面 | 微信小程序客户端 | 随小程序发布更新 |
| 云函数 | 微信云开发环境 | 按需部署，支持灰度 |
| 数据库 | 微信云开发 NoSQL | 自动扩缩容 |

## 变更记录

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| v1.0.0 | 2026-07-20 | 初版架构文档 |
