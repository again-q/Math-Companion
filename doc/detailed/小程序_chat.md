# 数学小伴 — 小程序对话页详细设计

**文档编号**：DES-20260718-003
**版本**：v1.0.0
**状态**：🟡 草稿
**创建日期**：2026-07-18
**最后更新**：2026-07-18
**作者**：系统架构师
**所属层次**：Layer 5（展示层）
**关联文档**：SAD-20260718-003, DES-20260718-001

---

## 1. 页面概述

对话页是「数学小伴」的核心页面（`pages/chat/chat`），用户在此与小兔子 AI「小伴」进行数学学习对话。

### 1.1 页面功能清单

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 消息列表展示 | P0 | 展示历史消息，支持自动滚到底部 |
| 文字输入发送 | P0 | 用户输入文字并发送给云函数 |
| AI 流式回复展示 | P0 | 逐字展示 AI 回复，打字机效果 |
| 语音输入 | P1 | 微信语音识别 → 转文字 → 发送 |
| 三种教学模式指示 | P1 | 显示当前模式（苏格拉底/故事/陪伴） |
| 小兔子动画角色 | P1 | 带简单动画的 AI 角色展示 |
| 话题选择面板 | P2 | 选择/切换数学知识点 |
| 学习总结弹窗 | P2 | 查看本次学习历程总结 |
| 历史会话切换 | P2 | 切换不同会话 |

### 1.2 页面关系

```
pages/chat/chat          ← 主对话页（本设计）
pages/topics/topics      ← 话题选择页（P2，后续迭代）
pages/summary/summary    ← 学习总结页（P2，后续迭代）
```

---

## 2. 页面结构（WXML 骨架）

```
<view class="chat-container">
  
  <!-- 顶部导航栏 -->
  <view class="navbar">
    <view class="navbar-title">小伴陪你学数学~</view>
    <view class="navbar-actions">
      <button class="btn-history">📋</button>
    </view>
  </view>

  <!-- 兔子角色展示区 -->
  <view class="character-area">
    <view class="rabbit-avatar {{currentEmotion}}"></view>
    <view class="mode-badge">{{modeLabel}}</view>
  </view>

  <!-- 消息列表 -->
  <scroll-view class="message-list" scroll-into-view="{{lastMsgId}}">
    <block wx:for="{{messages}}" wx:key="msgId">
      <view class="message-item {{item.role}}">
        <view class="bubble {{item.role}}">
          <text class="content">{{item.content}}</text>
          <text class="time">{{item.time}}</text>
        </view>
      </view>
    </block>
    <!-- AI 正在输入指示 -->
    <view class="message-item assistant" wx:if="{{isTyping}}">
      <view class="bubble assistant typing">
        <text class="dot-animation">...</text>
      </view>
    </view>
  </scroll-view>

  <!-- 底部输入区 -->
  <view class="input-area">
    <button class="btn-voice" bindtap="onVoiceInput">
      <image src="/images/icon-voice.png" />
    </button>
    <input class="text-input" 
           placeholder="输入你想学的内容~"
           value="{{inputValue}}"
           bindinput="onInputChange" />
    <button class="btn-send {{inputValue ? 'active' : ''}}"
            bindtap="onSendMessage"
            disabled="{{!inputValue || isLoading}}">
      发送
    </button>
  </view>

</view>
```

---

## 3. 组件树与职责

| 组件 | 职责 | 状态容器 |
|------|------|---------|
| `chat-page`（页面） | 整体布局、生命周期 | `Page.data` |
| `rabbit-avatar` | 兔子角色展示区 + 情绪动画 | CSS class 切换 |
| `message-list` | 消息列表渲染 + 自动滚动 | `messages[]` |
| `input-area` | 文字/语音输入 + 发送 | `inputValue` |
| `mode-badge` | 当前教学模式标签 | `currentMode` |

---

## 4. 数据流

### 4.1 页面数据模型

```javascript
Page({
  data: {
    // 会话状态
    sessionId: null,          // 当前会话 ID（null=新会话）
    messages: [],             // 消息列表 [{msgId, role, content, time, mode?, emotion?}]
    
    // 输入状态
    inputValue: '',           // 当前输入框内容
    isLoading: false,         // 是否正在等待 AI 回复
    isTyping: false,          // 是否正在展示打字效果
    
    // AI 状态
    currentMode: 'socratic',  // socratic | story | companion
    currentEmotion: 'happy',  // happy | curious | gentle | thinking
    modeLabel: '苏格拉底模式', // 当前模式中文名
    
    // 语音
    isRecording: false,       // 是否正在录音
  }
})
```

### 4.2 消息发送流程

```
用户点击发送
  ↓
Page.onSendMessage()
  ├─ 1. 校验：inputValue 非空、不在加载中
  ├─ 2. 更新消息列表（追加用户消息）
  ├─ 3. 清空输入框、设 isLoading=true、isTyping=true
  ├─ 4. 调用 wx.cloud.callFunction({
  │     name: 'math-agent',
  │     data: {
  │       type: 'sendMessage',
  │       data: {
  │         sessionId: this.data.sessionId,
  │         content: this.data.inputValue
  │       }
  │     }
  │   })
  │     ↓
  │   成功回调：
  │     ├─ 更新 sessionId（如为新会话）
  │     ├─ 更新 currentMode、currentEmotion
  │     ├─ 追加 AI 回复消息（逐字动画）
  │     ├─ 设 isLoading=false、isTyping=false
  │     └─ 滚动到底部
  │     ↓
  │   失败回调：
  │     ├─ 显示错误 toast
  │     ├─ 设 isLoading=false、isTyping=false
  │     └─ 可重试
  └─ 5. 结束
```

### 4.3 打字机效果实现

```javascript
// 云函数返回完整文本后，前端逐字展示
function typewriterEffect(fullText, callback) {
  let index = 0;
  let displayText = '';
  
  const timer = setInterval(() => {
    if (index >= fullText.length) {
      clearInterval(timer);
      callback(displayText); // 完成回调
      return;
    }
    displayText += fullText[index];
    index++;
    
    // 更新最后一条消息的 content
    const msgs = this.data.messages;
    const lastMsg = msgs[msgs.length - 1];
    lastMsg.content = displayText;
    this.setData({ messages: msgs });
    
    // 每次更新后滚动到底部
    this.scrollToBottom();
  }, 30); // 每 30ms 显示一个字
}
```

### 4.4 语音输入流程

```
用户点击语音按钮
  ↓
Page.onVoiceInput()
  ├─ 1. 调用 wx.startRecord() / wx.getRecorderManager()
  ├─ 2. 录音过程中显示录音状态 UI
  ├─ 3. 录音结束 → wx.uploadFile() 上传到语音识别服务
  │     └─ 或直接用微信同声传译插件
  ├─ 4. 识别结果回填到 inputValue
  └─ 5. 用户可编辑后发送
```

---

## 5. 状态管理

### 5.1 页面级状态（Page.data）

所有对话相关的状态保存在 `Page.data` 中，使用 `setData` 更新。

### 5.2 应用级状态（App.globalData）

```javascript
// app.js
App({
  globalData: {
    // 跨页面共享
    currentSessionId: null,   // 最新活跃会话 ID
    totalSessions: 0,         // 总会话数
    lastVisitTime: null,      // 上次访问时间
  }
})
```

### 5.3 本地持久化（wx.setStorageSync）

```javascript
// 页面卸载/隐藏时保存
wx.setStorageSync('chat_backup', {
  sessionId: this.data.sessionId,
  messages: this.data.messages.slice(-50),  // 只保存最近 50 条
  savedAt: Date.now()
})

// 页面加载时恢复
const backup = wx.getStorageSync('chat_backup');
```

---

## 6. 视觉设计规范

### 6.1 色彩系统

| 用途 | 色值 | 说明 |
|------|------|------|
| 主色 | `#FFB5C2` | 樱花粉（兔子主色） |
| 辅色 | `#FFF0F3` | 奶油白（消息气泡底色） |
| 文字主色 | `#4A4A4A` | 深灰（正文） |
| 文字辅色 | `#9B9B9B` | 浅灰（时间戳） |
| 用户气泡 | `#FFE4E9` | 浅粉（用户消息背景） |
| AI 气泡 | `#FFFFFF` | 白色（AI 消息背景） |
| 强调色 | `#FF7EB3` | 深粉（按钮/链接） |

### 6.2 字体与排版

| 元素 | 字号 | 字重 | 行高 |
|------|------|------|------|
| 导航栏标题 | 18rpx | 600 | — |
| 消息正文 | 32rpx | 400 | 1.6 |
| 时间戳 | 24rpx | 400 | — |
| 输入框文字 | 30rpx | 400 | — |
| 模式标签 | 24rpx | 500 | — |

### 6.3 兔子角色动画

四个情绪状态对应不同动画：

| 情绪 | CSS 动画 | 描述 |
|------|---------|------|
| `happy` | 轻微上下弹跳 + 微笑 | 用户答对或主动学习时 |
| `curious` | 头歪 + 眨眼 | 提问时 |
| `gentle` | 轻轻左右摇摆 | 安慰/鼓励时 |
| `thinking` | 摸下巴状（旋转） | AI 思考中 |

### 6.4 消息气泡样式

```
用户气泡（右对齐）：
  ┌──────────────────┐
  │ 三角形面积怎么算？│  ← 浅粉背景 #FFE4E9
  │       14:30       │  ← 浅灰字 #9B9B9B
  └──────────────────┘
          ┘

AI 气泡（左对齐）：
  ┌──────────────────┐
  │ 🐰 小伴来教你~    │  ← 白底 + 粉色左边框
  │ 三角形面积 = ...  │
  │    14:30          │
  └──────────────────┘
  └
```

---

## 7. 交互细节

| 场景 | 交互行为 |
|------|---------|
| 页面加载 | 检查本地缓存 → 恢复最近会话 / 创建新会话 |
| 发送消息 | 输入框缩回 → 消息列表滚动到底部 → 显示打字动画 |
| 收到回复 | 逐字展示 → 滚动保持最新内容可见 |
| 语音输入中 | 底部录音按钮变为红色录制状态 |
| 语音识别结束 | 文字填入输入框，用户可修改后再发送 |
| 网络错误 | Toast 提示"网络开小差了~" + 重试按钮 |
| 空状态（新用户） | 兔子角色 + 气泡提示："开始学习吧~点下方输入你想学的内容" |
| 滚动查看历史 | 自动加载更多历史消息（分页） |

---

## 8. 性能要求

| 指标 | 目标 |
|------|------|
| 页面首次渲染 | ≤ 1.5 秒 |
| 消息发送到展示首字 | ≤ 500ms（不包含 AI 响应时间） |
| 消息列表滚动 | 60fps 流畅 |
| 单会话消息上限 | 本地缓存最近 200 条 |
| 语音识别响应 | ≤ 2 秒 |

---

## 9. 依赖与接口

| 依赖 | 用途 |
|------|------|
| `wx.cloud.callFunction` | 调用 `math-agent` 云函数 |
| `wx.getRecorderManager` | 语音录制（P1） |
| 微信同声传译插件 | 语音转文字（P1） |
| `wx.setStorageSync/getStorageSync` | 本地状态缓存 |
| 兔子角色素材 | PNG 序列帧 / CSS 动画 |

---

## 10. 测试要点

| 测试场景 | 预期结果 |
|---------|---------|
| 首次进入页面 | 显示空状态引导文案 |
| 发送文字消息 | 消息出现在列表中，AI 开始逐字回复 |
| AI 回复完成 | 完整消息展示，打字动画结束 |
| 连续快速发送 | 第二次发送被阻止（isLoading 防抖） |
| 语音输入→发送 | 文字框中出现识别结果，可编辑后发送 |
| 切后台再回来 | 恢复最近消息（最近 50 条） |
| 断网时发送 | Toast 提示 + 重试按钮 |
| 消息超过屏幕高度 | 自动滚动到最新消息 |
| 切换教学模式 | 模式标签和兔子动画同步更新 |

---

## 变更记录

| 版本 | 日期 | 变更类型 | 变更内容 | 变更人 |
|------|------|---------|---------|--------|
| v1.0.0 | 2026-07-18 | 🆕 新建 | 初始版本 | 系统架构师 |
