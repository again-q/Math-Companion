# Math-Companion 🧮

**数学小伴** — 写给我表妹的个人数学 AI 教练，一个温暖、耐心的微信小程序。

> 基于微信小程序 + CloudBase 云开发 + DeepSeek AI 大模型，为初三学生打造的个性化数学学习陪伴助手。

---

## ✨ 功能

| 功能 | 描述 |
|------|------|
| 💬 **AI 对话** | 与「数学小伴」自然对话，AI 以提问引导的方式帮你推导答案 |
| 📝 **学习总结** | 每次对话后自动生成个性化总结，包含知识点地图 |
| 🧠 **记忆系统** | AI 记住你的学习进度、薄弱点和兴趣，因材施教 |
| ⚙️ **个性化设置** | 自定义 AI 语气、学习偏好等 |

## 🏗 项目结构

```
miniprogram/
├── pages/
│   ├── chat/          # AI 对话页（主界面）
│   ├── summary/       # 学习总结页
│   ├── memory/        # 记忆页面
│   ├── settings/      # 设置页
│   └── index/         # 首页
├── components/        # 公共组件
├── images/            # 图标与图片资源
├── services/          # 前端服务层
└── utils/             # 工具函数

cloudfunctions/
└── math-agent/        # AI 对话云函数
    ├── handlers/      # 请求处理器
    ├── services/      # 业务逻辑（对话、记忆、策略）
    ├── lib/           # 数据库、AI 调用工具
    └── config/        # 环境配置
```

## 🧠 AI 人设

- **名字**：数学小伴
- **身份**：数学学习陪伴者（初三学生专属）
- **风格**：专业、温暖、耐心
- **教学原则**：引导式提问、拆解复杂问题、用生活例子解释抽象概念

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 前端 | 微信小程序原生框架 |
| 后端 | CloudBase 云函数（Node.js） |
| AI | DeepSeek 大模型 |
| 数据库 | CloudBase 文档数据库（NoSQL） |
| 存储 | CloudBase 云存储 |

## 🚀 本地开发

1. 克隆项目
2. 使用微信开发者工具打开 `miniprogram/` 目录
3. 在 CloudBase 控制台绑定环境
4. 部署云函数 `math-agent`
5. 在 `cloudfunctions/math-agent/config/` 配置 AI 密钥

```bash
# 部署云函数
cd cloudfunctions/math-agent
npm install
```

## 📄 文档

项目完整遵循 Reasonix AI 编码门禁流程开发，文档位于 `doc/` 目录：

- `doc/prd/` — 产品需求文档
- `doc/arch/` — 架构设计文档  
- `doc/detailed/` — 详细设计文档
- `doc/review/` — 代码评审报告

## 📜 许可证

MIT
