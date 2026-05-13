# 团队共享记忆与本地三模块

## 新对话启动

新对话开始时，先读取：

1. `03_memory/shared/README.md`
2. `03_memory/shared/team-memory.md`
3. `03_memory/project/` 中与当前任务相关的项目规则

## 三模块规则

| 模块 | 目录 | 说明 |
|---|---|---|
| 智能体记忆 | `03_memory/` | AI 稳定上下文、共享知识缓存、项目规则、本地个人知识池 |
| 个人工具 | `90_tools/personal/` | 个人脚本和本地工具，默认不提交 Git |
| 项目产出 | `02_outputs/` | 报告、策划案、复盘、交付物 |

## 同步命令

```powershell
cmd /c npm run memory:sync:mcp -- --project "<project_code>" --dry-run
cmd /c npm run memory:sync:mcp -- --project "<project_code>"
cmd /c npm run memory:mcp:push-usage -- --project "<project_code>"
cmd /c npm run memory:ls:maintain -- --project "<project_code>"
```

## 安全规则

- 个人记忆不进团队 Git。
- 个人工具不进团队 Git。
- 未审核知识不能当作事实。
- 禁止同步、个人知识、冻结知识、其它项目知识不能进入本项目缓存。
- 本机只回传聚合使用反馈，不上传原始对话或敏感上下文。
- 不写 token、cookie、密码、数据库连接串、Webhook、登录态或运行缓存路径。

## 知识投稿规则

本地 AI 新产生的知识默认先进入个人知识池。当本地 AI 发现可复用结论、稳定流程、踩坑修复、决策记录或原则候选时，先按工具包里的 `docs/AGENT_KNOWLEDGE_SUBMISSION_GUIDE.md` 和 `docs/LOCAL_AGENT_AUTOMATION.md` 自检。

只有满足这些条件才投稿到 MCP 团队记忆库：

- 以后会复用。
- 有明确结论和适用边界。
- 有来源或证据。
- 标题、摘要、正文和标签能被未来搜索召回。
- 不含敏感信息。
- 已确认不是已有知识的重复版本。
- 没有标注 `do_not_upload`、`local_only`、`personal_only`、`禁止同步`。

投稿后默认仍是候选；维护人审核通过前，不能把它当作团队事实。

## 自动化治理任务

本地应定期运行 `memory:ls:maintain`：

- 筛选个人知识池中的团队候选并上传到 LS 审核队列。
- 自动跳过敏感内容和明确不上传团队的内容。
- 全量同步 LS 已审核知识到本地缓存。
- 汇总 LS 知识是否有用、是否被采纳、是否 miss、是否被纠错。
- 发现重复、矛盾、旧版替代时，只作为反馈上报 LS，不自动改 LS 主字段。

