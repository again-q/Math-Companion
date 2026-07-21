# 数学小伴 — Agent 对话模块详细设计

**文档编号**：DES-20260718-001
**版本**：v1.0.0
**状态**：🟡 草稿
**创建日期**：2026-07-18
**最后更新**：2026-07-18
**作者**：系统架构师
**所属层次**：Layer 3（接口层）+ Layer 2（业务层）
**关联文档**：SAD-20260718-002

---

## 1. 功能描述

本模块处理用户与 AI 之间的对话全流程，包含三个核心子功能：

1. **消息收发与分发** — 接收小程序发来的用户消息，分发给正确的处理模块
2. **AI 对话生成** — 调用 DeepSeek API，根据认知策略生成符合人设的回复
3. **认知策略引擎** — 动态选择苏格拉底模式/故事模式/陪伴模式

---

## 2. 业务规则

| 规则编号 | 规则描述 | 来源 |
|---------|---------|------|
| CONV-REG-01 | AI 不得以任何形式贬低或否定用户回答 | BR-001 |
| CONV-REG-02 | 用户连续 2 次答不出时，必须切换教学方式 | BR-002 |
| CONV-REG-03 | 每次会话结束时必须说一句正向鼓励的话 | BR-003 |
| CONV-REG-04 | 用户明确表示"不想学"时，必须立即停止教学 | BR-005 |
| CONV-BIZ-01 | 同一知识点跨会话时，AI 必须引用上次讲到的内容 | BR-004 |
| CONV-BIZ-02 | 禁止使用"你真聪明"类标签式表扬，改为表扬具体行为 | 认知策略规则 |
| CONV-BIZ-03 | 禁止连续 3 次提问后不给提示或直接答案 | 认知策略规则 |

---

## 3. 接口定义（OpenAPI 3.0）

### 3.1 sendMessage — 发送消息

```yaml
type: cloudFunction
name: math-agent
event:
  type: sendMessage
  data:
    type: object
    properties:
      sessionId:
        type: string
        description: 会话 ID（新会话传 null）
      content:
        type: string
        description: 用户消息内容
      topic:
        type: string
        description: 知识点话题（可选，新话题时传）
    required:
      - content
    example:
      sessionId: "sess_abc123"
      content: "三角形面积怎么算？"
responses:
  200:
    description: AI 回复成功
    schema:
      type: object
      properties:
        reply:
          type: string
          description: AI 的回复内容
        sessionId:
          type: string
          description: 当前会话 ID
        mode:
          type: string
          enum: [socratic, story, companion]
          description: AI 当前使用的对话模式
        emotion:
          type: string
          description: AI 回复时的表情状态（如 happy/curious/gentle）
  400:
    description: 请求参数错误
    schema:
      type: object
      properties:
        error:
          type: string
          example: "消息内容不能为空"
  500:
    description: 服务端错误
    schema:
      type: object
      properties:
        error:
          type: string
          example: "AI 服务暂时不可用，请稍后再试"
```

### 3.2 getSummary — 生成学习总结

```yaml
type: cloudFunction
name: math-agent
event:
  type: getSummary
  data:
    type: object
    properties:
      scope:
        type: string
        enum: [all, recent]
        description: 总结范围（全部/近期）
    required: []
    example:
      scope: "recent"
responses:
  200:
    description: 学习总结
    schema:
      type: object
      properties:
        summary:
          type: string
          description: 温暖的个人学习历程总结
        topicsCovered:
          type: array
          items:
            type: string
          description: 涉及的知识点列表
        totalSessions:
          type: number
          description: 总会话数
```

---

## 4. 功能逻辑（伪代码）

### 4.1 消息处理主流程

```
function handleMessage(sessionId, content, topic):
    # 1. 加载上下文
    context = loadContext(sessionId)
    
    # 2. 策略引擎分析
    state = analyzeState(context, content)
    # state = { emotion, difficulty, consecutiveCorrect, ... }
    
    # 3. 选择教学模式
    if state.emotion == "resistant" or state.emotion == "tired":
        mode = "companion"          # 陪伴模式
    elif state.consecutiveCorrect >= 2:
        mode = "socratic"           # 苏格拉底模式（状态好时）
    elif state.difficulty > 0.7:
        mode = "story"              # 故事模式（太难时）
    else:
        mode = "socratic"           # 默认苏格拉底模式
    
    # 4. 组装 prompt
    prompt = buildPrompt(mode, context, content, state)
    
    # 5. 调用 DeepSeek
    reply = callDeepSeek(prompt)
    
    # 6. 保存到记忆
    saveMessage(sessionId, "user", content)
    saveMessage(sessionId, "assistant", reply)
    
    # 7. 更新知识点进度
    if topic:
        updateKnowledgeProgress(topic)
    
    return { reply, sessionId, mode, emotion: deriveEmotion(mode) }
```

### 4.2 认知策略引擎

```
function analyzeState(context, content):
    # 情绪检测
    emotion = detectEmotion(content)
    # 从用词判断: "不想" "好难" "累了" → tired/resistant
    #               "懂了" "原来如此" → positive
    
    # 连续答对计数
    lastMessages = context.lastNMessages(5)
    consecutiveCorrect = countPositivePatterns(lastMessages)
    
    # 难度动态评估
    topicProgress = getTopicProgress(context.currentTopic)
    difficulty = calculateDifficulty(topicProgress, consecutiveCorrect)
    
    return { emotion, consecutiveCorrect, difficulty }
```

### 4.3 人设 Prompt 模板

```
苏格拉底模式 prompt:
  "你是一只名叫小伴的可爱小兔子AI助手。
  用户是一位数学基础薄弱的初三女生。
  规则：
  1. 用提问引导她思考，不要直接给答案
  2. 如果她连续2次答不出，切换成讲故事模式
  3. 表扬她的努力和思考过程
  4. 语气温暖活泼，多用"~"和表情
  5. 参考以下历史对话：{context}
  当前话题：{topic}"

故事模式 prompt:
  "你是一只名叫小伴的可爱小兔子AI助手。
  请把"{topic}"这个数学知识点编成一个有趣的故事
  或生活中的例子来讲给用户听。
  规则：
  1. 故事要简单有趣，适合初中生
  2. 最后一定要联系到数学概念本身
  3. 语气轻松活泼"

陪伴模式 prompt:
  "你现在是小伴，一只温暖的小兔子。
  用户今天不太想学习，请以朋友的身份陪伴她聊天。
  规则：
  1. 不要提学习或数学
  2. 可以说有趣的事情或表达关心
  3. 让她感受到被理解和陪伴"
```

---

## 5. 算法

### 难度动态调整算法

```
difficulty = baseDifficulty - (consecutiveCorrect * 0.15)
其中 baseDifficulty 根据知识点层级预设：
  初一内容: 0.3
  初二内容: 0.5  
  初三内容: 0.7

当 difficulty > 0.7 且用户答不出 → 降低难度，切换故事模式
当 difficulty < 0.2 → 提升到下一层级
```

---

## 6. DDL

本模块无独立数据表，依赖 `agent_memory` 模块的 `sessions` 和 `messages` 集合。

---

## 7. 外部接口

| 接口 | 用途 | 调用方式 |
|------|------|---------|
| DeepSeek Chat API | AI 对话生成 | HTTP POST，流式响应 |
| 云数据库 SDK（wx-server-sdk） | 读写会话和消息 | SDK 方法调用 |

---

## 8. 内部接口

| 接口 | 提供方 | 用途 |
|------|-------|------|
| `memory.getSession(sessionId)` | agent_memory | 获取会话上下文 |
| `memory.saveMessage(sessionId, role, content)` | agent_memory | 保存消息 |
| `memory.getTopicProgress(topic)` | agent_memory | 获取知识点进度 |
| `memory.updateKnowledgeProgress(topic)` | agent_memory | 更新知识点进度 |

---

## 9. 性能要求

| 场景 | 要求 |
|------|------|
| AI 回复首字时间 | ≤ 3 秒（使用流式响应） |
| 上下文加载时间 | ≤ 500ms |
| DeepSeek API 超时 | 10 秒 |

---

## 10. 安全要求

- DeepSeek API Key 存储在云函数环境变量中，不硬编码
- API 调用不在日志中输出完整对话内容
- 人设 prompt 中预埋安全边界规则（禁止有害内容生成）

---

## 11. 测试要点

| 测试场景 | 预期结果 |
|---------|---------|
| 用户说"不想学了" | 切换到陪伴模式，不提学习 |
| 用户连续答对 3 次 | 难度自动提升 |
| 用户连续答错 2 次 | 切换故事模式 |
| 用户问"我聪明吗" | AI 表扬具体行为而非贴标签 |
| 会话超时 | 返回友好错误提示 |

---

## 12. 依赖关系

| 依赖模块 | 依赖接口 | 依赖方向 | 层次 |
|---------|---------|---------|------|
| agent_memory | `getSession`, `saveMessage`, `getTopicProgress`, `updateKnowledgeProgress` | 对话 → 记忆 | Layer 2 → Layer 1 |
| 云数据库 SDK | 所有 CRUD 操作 | 记忆 → 基础设施 | Layer 1 → Layer 0 |
| DeepSeek API | Chat Completions | AI 代理 → 外部 | Layer 4 |

---

## 变更记录

| 版本 | 日期 | 变更类型 | 变更内容 | 变更人 |
|------|------|---------|---------|--------|
| v1.0.0 | 2026-07-18 | 🆕 新建 | 初始版本 | 系统架构师 |
