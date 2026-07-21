# 数学小伴 — 代码评审报告

**评审日期**：2026-07-18
**评审范围**：cloudfunctions/math-agent/ + miniprogram/pages/chat/ + miniprogram/services/
**评审人**：code-reviewer

---

## 摘要

| 检查项 | 状态 |
|--------|------|
| 业务规则实现 | ⚠️ 部分覆盖 |
| 架构对齐 | ✅ 良好 |
| 接口契约 | ✅ 符合详设 |
| 代码质量 | ⚠️ 1个阻塞 + 2个建议 |
| 安全性 | ✅ 良好 |
| 性能 | ✅ 良好 |

---

## 1. 业务规则覆盖（PRD 检查）

| 规则编号 | 规则描述 | 状态 | 说明 |
|---------|---------|------|------|
| CONV-REG-01 | AI 不得贬低/否定用户 | ✅ | `validateReply()` 正则校验 |
| CONV-REG-02 | 连续2次答不出切换模式 | ⚠️ | 通过 difficulty>0.7 间接实现，未精确追踪"连续答错次数" |
| CONV-REG-03 | 会话结束说正向鼓励 | ❌ | 未实现（P2 功能） |
| CONV-REG-04 | "不想学"时停止教学 | ✅ | 触发 companion 模式 |
| CONV-BIZ-01 | 跨会话引用上次内容 | ✅ | 通过 `loadContext()` 实现 |
| CONV-BIZ-02 | 禁止标签式表扬 | ✅ | `validateReply()` 正则校验 |
| CONV-BIZ-03 | 禁止连续3次不提示 | ⚠️ | 策略引擎会切换模式，但未显式校验 |

## 2. 架构对齐

- ✅ 云函数模块划分（handler → service → lib）符合 SAD
- ✅ 小程序页面结构符合详细设计
- ✅ 数据流方向正确（小程序 → chat-service → 云函数 → 外部API）

## 3. 接口契约

- ✅ `sendMessage` 接口参数/返回值符合详设
- ✅ `getSummary` 接口参数/返回值符合详设
- ✅ 记忆模块 8 个接口签名一致

## 4. 代码质量问题

### 🔴 阻塞级：deepseek.js 使用 `fetch` API

**文件**：`cloudfunctions/math-agent/lib/deepseek.js`
**问题**：微信云函数 Node.js 18.x 环境可能不支持 `fetch`（取决于运行时版本和 polyfill 配置）
**修复**：改用 `wx-server-sdk` 内置的 HTTP 能力或通过 `axios` 包

### 🟡 中等：strategy.js 未使用的 import

**文件**：`cloudfunctions/math-agent/services/strategy.js` 第 7 行
**问题**：`const config = require('../config/index')` 定义了但从未使用
**修复**：移除未使用的导入

### 🟡 中等：conversation.js 未使用的 import

**文件**：`cloudfunctions/math-agent/services/conversation.js` 第 11 行
**问题**：`_` from dbHelper 定义了但从未使用
**修复**：移除未使用的 `_`

### 🟢 建议级：chat.js data 直接修改

**文件**：`miniprogram/pages/chat/chat.js` 第 119 行
**问题**：`this.data.sessionId = result.sessionId` 直接修改 data 属性
**建议**：使用 `this.setData()` 保持一致

### 🟢 建议级：countConsecutiveCorrect 关键词检测不够精确

**文件**：`cloudfunctions/math-agent/services/strategy.js`
**问题**：答对检测依赖关键词匹配（"对"、"等于"、"结果"），可能存在误判
**建议**：后续可通过 AI 语义理解或更精确的答案验证来改进

## 5. 安全性

- ✅ API Key 通过环境变量注入
- ✅ 云函数内校验输入参数
- ✅ 日志不记录完整对话内容
- ✅ 数据库权限由云函数管控

## 6. 性能

- ✅ 数据库查询使用索引
- ✅ 消息分页（pageSize 上限 50）
- ✅ API 调用超时 10s + 重试 2 次 + 指数退避
- ✅ 本地缓存最近 50 条消息

---

## 修复清单

| 优先级 | 问题 | 操作 | 状态 |
|--------|------|------|------|
| 🔴 P0 | deepseek.js 使用 fetch → 替换为 Node.js https | 已修复 | ✅ |
| 🟡 P1 | strategy.js 未使用 import → 移除 | 已修复 | ✅ |
| 🟡 P1 | conversation.js 未使用 import → 移除 | 已修复 | ✅ |
| 🟢 P2 | chat.js 直接修改 data → 改用 setData | 已修复 | ✅ |

---

**所有 P0/P1 问题已修复。评审通过 ✅**
