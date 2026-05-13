# 落地包说明

团队负责人只需要把五样东西发给项目成员：

1. 工具 Git 仓：`https://github.com/karlcptbtptp/planner-memory-kit`
2. MCP 团队记忆库接入信息：endpoint、项目代号、权限说明、凭据获取方式
3. 流程说明图：`docs/assets/team-memory-mcp-flow.svg`
4. 接入规则：`docs/MCP_TEAM_MEMORY_IMPLEMENTATION.md`
5. 本地智能体投稿规则：`docs/AGENT_KNOWLEDGE_SUBMISSION_GUIDE.md`

## 一句话说明

远端 MCP 团队记忆库负责“哪些知识可信、谁能看、是否过期”；本机项目记忆库负责“个人知识池、AI 快速召回、自动化筛选上传和使用反馈”。

## 每个项目要做什么

项目接入人：

1. 把本仓工具装进项目。
2. 按三模块建立本地目录：`03_memory/`、`90_tools/personal/`、`02_outputs/`。
3. 配置 MCP 团队记忆库连接信息。
4. 在项目 `AGENTS.md` 加入 `docs/AGENTS.template.md` 里的共享记忆规则。
5. 执行 dry-run，确认只同步当前项目可见的知识。

三模块职责：

| 模块 | 目录 | 说明 |
|---|---|---|
| 智能体记忆 | `03_memory/` | AI 可读的稳定上下文、团队共享知识缓存、项目规则 |
| 个人工具 | `90_tools/personal/` | 个人脚本和快捷工具，默认不进团队 Git |
| 项目产出 | `02_outputs/` | 报告、策划案、复盘、交付物，按项目需要决定是否提交 |

投稿策划：

1. 在团队指定入口提交知识，可以是 MCP 审核台、项目工具页或 Agent 投稿命令。
2. `project_id` 填自己的项目代号。
3. `scope` 选清楚：指定项目、全项目、仅本人。
4. 不填写任何凭据、登录态、运行目录内容。
5. 不直接改 `accepted`、`active principle` 等正式状态，这些由维护人处理。

项目知识维护人：

1. 在 MCP 审核队列检查投稿。
2. 确认真实、可复用、不敏感、项目范围正确。
3. 需要补充时，改为待补充并写 review note。
4. 普通知识通过后改为 `accepted`。
5. 原则候选通过后进入 `principles.active`。
6. 过期、低价值或风险内容进入 `edge`、`junk`、`frozen` 或 `deleted_candidate`。

AI 使用者：

1. 新对话启动时读取本地 `03_memory/shared/` 和任务记忆包。
2. 用本地 SQLite 搜索已同步知识。
3. 新结论默认先进入本地个人知识池。
4. 自动化任务按 `AGENT_KNOWLEDGE_SUBMISSION_GUIDE.md` 和 `LOCAL_AGENT_AUTOMATION.md` 判断是否上传团队候选。
5. 发现知识没想起、过期或误导时，记录 miss / correction，并由自动化汇总反馈 LS。

## 推荐命令

在接入项目里配置：

```json
{
  "scripts": {
    "memory:sync:mcp": "tsx 90_tools/planner-memory-kit/src/sync-mcp.ts",
    "memory:mcp:push-usage": "tsx 90_tools/planner-memory-kit/src/push-usage-mcp.ts",
    "memory:ls:maintain": "tsx 90_tools/planner-memory-kit/src/ls-maintain.ts",
    "memory:search": "node 90_tools/shared/run-memory-tool.mjs search.ts",
    "memory:task": "node 90_tools/shared/run-memory-tool.mjs task.ts",
    "memory:usage": "node 90_tools/shared/run-memory-tool.mjs usage.ts"
  }
}
```

首轮验证：

```powershell
$env:MCP_MEMORY_ENDPOINT="https://memory.example.com/mcp"
$env:PROJECT_ID="<项目代号>"
cmd /c npm run memory:sync:mcp -- --project "<项目代号>" --dry-run
cmd /c npm run memory:sync:mcp -- --project "<项目代号>"
cmd /c npm run memory:ls:maintain -- --project "<项目代号>"
```

## 验收标准

流程跑通需要同时满足：

- 未审核知识不会进入 AI 缓存。
- 已批准且允许同步的知识能进入对应项目缓存。
- 指定项目知识不会进入其它项目缓存。
- 原则候选不会绕过审核直接变成正式原则。
- 个人知识默认只落本地个人池；禁止同步内容和敏感内容不会上传 LS，也不会进入团队缓存。
- 新对话能通过本地记忆召回同步后的知识。
- 本机使用反馈能以聚合形式回传 MCP。
- 本地个人知识默认不上传，只有自动化筛选通过的候选才提交 LS 审核队列。
- 重复、矛盾、旧版替代只作为治理反馈上报 LS，不自动改 LS 主字段。

## 推荐第一轮测试

先准备 3 条测试知识：

1. 全项目原则：所有项目都应同步。
2. 当前项目知识：只有当前项目应同步。
3. 其它项目知识：当前项目不应同步。

本机执行：

```powershell
cmd /c npm run memory:sync:mcp -- --project "<项目代号>" --dry-run
```

确认 dry-run 通过后再真实同步。

## 飞书 legacy

飞书多维表格仍可作为旧项目的投稿和审核主库，但新版推荐把团队事实源迁移到 MCP 团队记忆库。飞书更适合继续承担：

- 通知
- 文档发布
- 人工沟通
- 非结构化材料沉淀
