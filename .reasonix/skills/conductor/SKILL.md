---
name: conductor
description: 管道指挥家。一次调用自动走完五阶段全过程，无需用户逐阶段干预。
runAs: inline
---
# Conductor — 管道指挥家

你是五阶段管道的**全自动编排者**。用户调用你一次，你负责完整跑完 `PRD → 架构 → 详细设计 → 编码 → 代码评审` 全流程。

**禁止在步骤之间询问用户"是否继续"。** 只有遇到阻断才停下来报告。

---

## 启动

```bash
run_skill({ name: "conductor", arguments: "module=<模块名> task=<任务描述>" })
```

第一步：

```python
# 1. 恢复上下文（查之前跑到哪了）
memory_init_session(project_name="当前项目")
memory_search_summaries(query="conductor <模块>", tags="conductor, pipeline")

# 2. 看当前管道状态
bash gate.sh status
```

**如果搜索结果中有 status=in_progress 的记录** → 从记录的 `next_steps` 描述的阶段继续。
**如果没有** → 从 PRD 开始全新的管道。

---

## 管道状态管理

用一个**全局管道会话**来追踪进度。每完成一个阶段就更新状态，这样即使中途中断，下次也能恢复。

### 创建一个新的管道记录

```python
memory_save_summary(
    session_id="pipeline-<模块>-<日期>",
    task_title="Conductor: <模块>: <任务>",
    summary_content="管道当前阶段：PRD",
    file_paths="doc/prd/,doc/arch/,doc/detailed/,src/,doc/review/",
    project_name="当前项目",
    status="in_progress",
    next_steps="开始 PRD 阶段",
    tags="conductor, pipeline, <模块>",
    module="<模块>"
)
```

### 每阶段完成后更新

```python
memory_update_summary(
    session_id="pipeline-<模块>-<日期>",
    new_status="in_progress",
    updated_content="PRD 阶段已完成。下一阶段：架构"
)
```

### 全部完成后

```python
memory_update_summary(
    session_id="pipeline-<模块>-<日期>",
    new_status="completed",
    updated_content="五阶段全部完成"
)
```

---

## 各阶段执行流程

### PRD 阶段

```python
memory_init_session(project_name="当前项目")
memory_search_summaries(query="PRD <模块>", tags="prd, <模块>")
# ↑ 查之前有没有写过 PRD，避免重复

run("bash gate.sh check prd")

# 写 → 评审 → 修复 → 归零（循环）
while True:
    run_skill({ name: "prd-writer", arguments: "module=<模块> task=<任务>" })
    run_skill({ name: "review-expert", arguments: "评审 <模块> 的 PRD 文档" })
    if review_expert_passed():
        break
    memory_add_decision(
        session_id="pipeline-<模块>-<日期>",
        description="<review-expert 发现的问题和修复方案>",
        decision_type="需求变更"
    )
    # prd-writer 修复 → 继续循环

# 归零后：记录本阶段产出
memory_save_summary(
    session_id="session-<日期>-prd-<模块>",
    task_title="PRD: <模块>",
    summary_content="PRD 文档已完成，review-expert 评审归零",
    file_paths="doc/prd/<模块>_PRD.md",
    project_name="当前项目",
    status="completed",
    tags="prd, <模块>, 需求",
    module="<模块>"
)

# 更新管道状态
memory_update_summary(
    session_id="pipeline-<模块>-<日期>",
    new_status="in_progress",
    updated_content="PRD 完成，进入架构阶段"
)

run("bash gate.sh pass prd --force")
```

### 架构阶段

```python
memory_init_session(project_name="当前项目")
memory_search_summaries(query="架构 <模块>", tags="arch, <模块>")

run("bash gate.sh check arch")

# 写 → 评审 → 修复 → 归零（循环）
while True:
    run_skill({ name: "system-architect", arguments: "module=<模块>" })
    run_skill({ name: "review-expert", arguments: "评审 <模块> 的架构文档" })
    if review_expert_passed():
        break
    memory_add_decision(...)

memory_save_summary(
    session_id="session-<日期>-arch-<模块>",
    task_title="架构: <模块>",
    file_paths="doc/arch/<模块>_SAD.md",
    project_name="当前项目",
    status="completed",
    tags="arch, <模块>, 架构",
    module="<模块>"
)

memory_update_summary(
    session_id="pipeline-<模块>-<日期>",
    new_status="in_progress",
    updated_content="架构完成，进入详细设计阶段"
)

run("bash gate.sh pass arch --force")
```

### 详细设计阶段

```python
memory_init_session(project_name="当前项目")
memory_search_summaries(query="详细设计 <模块>", tags="detailed, <模块>")

run("bash gate.sh check detailed")

while True:
    run_skill({ name: "task-decomposer", arguments: "module=<模块>" })
    run_skill({ name: "review-expert", arguments: "评审 <模块> 的详细设计文档" })
    if review_expert_passed():
        break
    memory_add_decision(...)

memory_save_summary(
    session_id="session-<日期>-detailed-<模块>",
    task_title="详细设计: <模块>",
    file_paths="doc/detailed/<模块>_详细设计.md",
    project_name="当前项目",
    status="completed",
    tags="detailed, <模块>, 详细设计",
    module="<模块>"
)

memory_update_summary(
    session_id="pipeline-<模块>-<日期>",
    new_status="in_progress",
    updated_content="详细设计完成，进入编码阶段"
)

run("bash gate.sh pass detailed --force")
```

### 编码阶段

```python
memory_init_session(project_name="当前项目")
memory_search_summaries(query="编码 <模块>", tags="code, <模块>")

run("bash gate.sh pre <模块> doc/detailed/<模块>*.md")

# 编码 → code-reviewer → 修复 → 归零（循环）
while True:
    run_skill({ name: "gatekeeper", arguments: "module=<模块> task=<任务> docs=doc/detailed/<模块>*.md" })
    run_skill({ name: "code-reviewer", arguments: "审查 <模块> 的代码" })
    if code_reviewer_passed():
        break
    memory_add_decision(
        session_id="pipeline-<模块>-<日期>",
        description="<code-reviewer 发现的问题和修复方案>",
        decision_type="代码修复"
    )

run("bash gate.sh post <模块> 'biz=ok urls=ok params=ok entity=ok no-drift=yes'")

memory_save_summary(
    session_id="session-<日期>-code-<模块>",
    task_title="编码: <模块>",
    file_paths="src/",
    project_name="当前项目",
    status="completed",
    tags="code, <模块>, 编码",
    module="<模块>"
)

memory_update_summary(
    session_id="pipeline-<模块>-<日期>",
    new_status="in_progress",
    updated_content="编码完成，进入代码评审阶段"
)
```

### 代码评审阶段

```python
memory_init_session(project_name="当前项目")
memory_search_summaries(query="代码评审 <模块>", tags="review, <模块>")

while True:
    run_skill({ name: "code-reviewer", arguments: "审查 <模块> 的代码" })
    if code_reviewer_passed():
        break
    run_skill({ name: "gatekeeper", arguments: "module=<模块> task=修复 code-reviewer 指出的问题" })
    memory_add_decision(...)

run("bash gate.sh pass review")

memory_save_summary(
    session_id="session-<日期>-review-<模块>",
    task_title="代码评审: <模块>",
    file_paths="src/",
    project_name="当前项目",
    status="completed",
    tags="review, <模块>, 代码评审",
    module="<模块>"
)

memory_update_summary(
    session_id="pipeline-<模块>-<日期>",
    new_status="completed",
    updated_content="五阶段全部完成：PRD → 架构 → 详细设计 → 编码 → 代码评审"
)
```

---

## 评审归零判断

```python
def review_expert_passed():
    """检查 doc/review/ 下最新评审报告的结论"""
    # review-expert 输出评审报告 → 读结论
    # 结论是"通过" → 归零
    # 否则 → 未归零，继续修复

def code_reviewer_passed():
    """检查 code-reviewer 是否给出通过结论"""
    # 读最新评审报告 → 结论为"通过"或"有条件通过" → 归零
    # 存在 P0 问题 → 未归零
```

---

## 阻断处理

以下情况停下来报告用户，不要自动跳过：

| 阻断条件 | 报告内容 |
|---------|---------|
| gate.sh check 不通过 | 缺失哪个上游阶段 |
| review >3 轮不归零 | 卡在什么问题，请用户决策 |
| gate.sh pre/post 不通过 | 编码验证失败详情 |

---

## 完成报告

```python
memory_search_summaries(query="pipeline-<模块>-<日期>", tags="conductor")
# 读取最终状态，确认全部完成

print("""
🎉 Conductor 完成
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  模块: {module}
  任务: {task}

  [PRD]        ✅
  [架构]       ✅
  [详细设计]   ✅
  [编码]       ✅
  [代码评审]   ✅

  记忆: pipeline 已归档（status=completed）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")
```
