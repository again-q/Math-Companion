# Math-Companion 🧮

**数学小伴** — 写给我表妹的个人数学 AI 教练，一个温暖、耐心的微信小程序。

> 基于微信小程序 + CloudBase 云开发 + DeepSeek AI 大模型，为初三学生打造的个性化数学学习陪伴助手。
> 单用户设计：全部数据全局共享一份，不做多用户隔离。

---

## ✨ 功能总览

| 功能 | 描述 |
|------|------|
| 🚪 **登录/开始页** | 每次冷启动显示，点击「开始使用」进入主界面 |
| 💬 **AI 对话** | 认知科学驱动的苏格拉底式教学：搭梯子引导、生活化类比、Unicode 公式、完整多轮上下文 |
| ⚡ **深度思考** | 对话输入区开关，开启后走 DeepSeek 思考模式（更高质量回答） |
| 📚 **知识点地图** | 初一到初三全部 29 个知识点，按 6 个单元分组；单元状态（未学习/学习中/已掌握）+ 推荐先学 + 开始学习 |
| 📝 **单元水平测试** | 对话式摸底（非出题考试）：AI 聊天式探询掌握情况，联网搜索人教版教材资料辅助 |
| 🌟 **学习总结** | 3 入口 + 3 详情页：AI 生成 Markdown 三件套（总结/建议/知识点点评），towxml 渲染 |
| 🧠 **记忆系统** | AI 记住学习进度、薄弱点、兴趣；每次对话后 AI 独立判断掌握度更新 |
| 💬 **吐槽学习** | AI 从学生的吐槽/反馈中学习改进（FEEDBACK_UPDATE + learningStyle） |
| 🕊️ **零压力陪伴** | 有连续学习就鼓励，中断绝不催促 |
| ⚙️ **个性化设置** | 自定义 AI 人设（留空恢复默认） |

## 🏗 页面结构

```
miniprogram/
├── pages/
│   ├── login/         # 登录/开始使用页（启动首页）
│   ├── chat/          # AI 对话页（主界面 tab）
│   ├── memory/        # 记忆/会话管理（tab）
│   ├── summary/       # 学习总结入口（tab）
│   ├── settings/      # 设置页（tab）
│   ├── example/       # 示例题页（未接入口）
│   └── report/        # 【分包】知识点地图 / 学习建议 / 总结详情
├── towxml/            # Markdown 渲染组件（裁剪版 512K）
├── components/        # 公共组件
├── images/            # 图标
├── services/          # 前端服务层
└── utils/             # 工具函数

cloudfunctions/
└── math-agent/        # AI 对话云函数
    ├── handlers/      # 请求处理器（sendMessage/summary/profile/config/unitTest）
    ├── services/      # 业务逻辑（对话、记忆、策略、memory-builder）
    ├── lib/           # deepseek 调用、搜索、数据库工具
    └── config/        # 环境配置
```

## ☁️ 云端环境

| 项 | 值 |
|----|-----|
| 环境 ID | `math-agent-d5g60mlm8bb6878ee`（个人版，2027-02-01 到期需续期） |
| AppID | `wx608070b3eb1b9cfd` |
| 云函数 | `math-agent`（含 dailyMemoryRebuild 定时触发器，每天 02:00） |
| 集合 | `mt_sessions` / `mt_messages` / `mt_knowledge_progress` / `mt_profile` / `mt_config` |
| API Key | 环境变量 `DEEPSEEK_API_KEY`（云开发控制台配置，**严禁硬编码**） |

## 🧠 AI 人设

- **名字**：数学小伴
- **身份**：数学学习陪伴者（初三学生）
- **风格**：幽默风趣、温暖耐心，用生活化例子（篮球/动漫/零食）
- **教学原则**：认知科学驱动（认知负荷控制/脚手架/检索练习/错误驱动/即时小练习）
- **引导方式**：搭梯子式苏格拉底引导（问题逐级具体，答不出补一级再问）
- **教材依据**：以人教版教材为准
- **公式**：Unicode 数学符号（x²、±、√），不用 LaTeX

> 完整提示词见 `doc/ai-prompts.md`

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 前端 | 微信小程序原生框架（主包 <1MB，report 分包） |
| 后端 | CloudBase 云函数（Node.js） |
| AI | DeepSeek 大模型（含思考模式） |
| 数据库 | CloudBase 文档数据库（NoSQL） |
| Markdown | towxml 组件（裁剪） |
| 联网搜索 | 必应中国版 cn.bing.com（免费无需 key） |

## 🚀 本地开发

1. 克隆项目，用微信开发者工具打开
2. 绑定环境 `math-agent-d5g60mlm8bb6878ee`
3. 部署云函数 `math-agent`（右键 → 上传并部署：云端安装依赖）
4. 云开发控制台给 math-agent 配置环境变量 `DEEPSEEK_API_KEY`
5. 编译运行

## 📄 文档

- `doc/ai-prompts.md` — AI 提示词全集（对话/总结/记忆/配置/调整指南）
- `doc/prd/` — 产品需求文档
- `doc/arch/` — 架构设计文档
- `doc/detailed/` — 详细设计文档
- `doc/review/` — 代码评审报告
- `test-deepseek-timeout.py` — DeepSeek 链路诊断脚本（`export DEEPSEEK_API_KEY=... && python3 test-deepseek-timeout.py`）

## 📌 当前状态（2026-08）

- ✅ 全部功能开发完成并云端实测
- ✅ Bug 全清（P0-P3 + 多轮上下文/嵌套三元/条件链等关键修复）
- ⏳ 待办：模拟数据清空、真机编译验证、体验版上传、环境续期（2027-02）

## 📜 许可证

MIT
