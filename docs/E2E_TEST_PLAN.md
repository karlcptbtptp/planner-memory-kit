# 策划团队共享记忆端到端测试方案

## 测试目标

验证完整流程能跑通：

策划或 Agent 投稿到 MCP 团队记忆库 -> 项目知识维护人审核 -> 对应项目本地同步 -> 新对话能召回 -> 其它项目不会误召回 -> 使用反馈能聚合回传。

## 测试前提

MCP 团队记忆库服务本体由团队提供，本仓只验证接入流程。测试环境需要准备：

- MCP endpoint
- 测试 token 或本机凭据读取方式
- 当前项目代号，例如 `giftWeb`
- 另一个项目代号，例如 `otherProject`
- 一个维护人账号
- 一个普通投稿人或测试 Agent

## 测试数据

准备 5 条记录：

| 编号 | 类型 | 项目 | 状态 | 预期 |
|---|---|---|---|---|
| A | principle | 全项目 | active | 当前项目应同步 |
| B | knowledge | 当前项目 | accepted | 当前项目应同步 |
| C | knowledge | 其它项目 | accepted | 当前项目不应同步 |
| D | knowledge | 当前项目 | pending_review | 不应同步 |
| E | knowledge | 当前项目 | frozen | 不应同步 |

测试标题建议：

```text
测试-全项目-AI协作原则
测试-giftWeb-首局结论沉淀
测试-otherProject-项目隔离验证
测试-未审核不应同步
测试-冻结不应同步
```

## 维护人审核动作

维护人在 MCP 审核队列中确认：

- A 进入 `principles.active`
- B 进入 `knowledge_items.accepted`
- C 进入 `knowledge_items.accepted`，但 `project_id=otherProject`
- D 保持 `pending_review`
- E 进入 `frozen`

每条记录都要检查：

- 标题能搜索
- 摘要说明“以后什么任务该想起”
- 正文不含 token、cookie、密码、数据库连接串、私钥
- `project_id` 和 `clearance` 正确

## 同步验证

在当前项目本地执行：

```powershell
$env:MCP_MEMORY_ENDPOINT="https://memory.example.com/mcp"
$env:PROJECT_ID="giftWeb"
cmd /c npm run memory:sync:mcp -- --project "giftWeb" --dry-run
```

预期：

- Accepted 包含 A、B。
- Skipped 包含 C，原因是 `project-not-visible`。
- Skipped 包含 D，原因是 `review-required`。
- Skipped 包含 E，原因是 `frozen`。

确认无误后执行真实同步：

```powershell
cmd /c npm run memory:sync:mcp -- --project "giftWeb"
```

预期：

- `03_memory/shared/team-memory.md` 出现 A、B。
- SQLite `knowledge` 里能搜到 A、B。
- C、D、E 不进入默认召回。

## 项目隔离验证

换成另一个项目 dry-run：

```powershell
cmd /c npm run memory:sync:mcp -- --project "otherProject" --dry-run
```

预期：

- C 可以进入 Accepted。
- B 不应进入 Accepted。

## 新对话召回验证

新开一个 AI 对话，问：

```text
帮我查一下“测试-giftWeb-首局结论沉淀”这条共享知识。
```

预期：

- AI 能说出标题、摘要、适用项目、审核状态。
- AI 不会把 `otherProject` 的测试知识混进来。

## 使用反馈回传验证

本地记录一次采纳：

```powershell
npm run memory:usage -- record --id "<local_knowledge_id>" --type adopt --source manual --note "端到端测试采纳"
```

回传聚合反馈：

```powershell
cmd /c npm run memory:mcp:push-usage -- --project "giftWeb"
```

预期：

- MCP 端对应 knowledge 的 `adopt_count` 或 usage 聚合增加。
- 不出现原始对话正文。
- 不出现本机运行态路径或敏感内容。

## 冻结回归验证

把 B 改为 frozen 后再次同步：

```powershell
cmd /c npm run memory:sync:mcp -- --project "giftWeb"
```

预期：

- B 不再进入默认召回。
- 本地可以保留历史记录，但应降权、归档或标记 archived。

## 判定标准

流程通过需要同时满足：

- 未审核记录不能同步。
- 审核通过记录能同步。
- 指定项目知识只进入对应项目缓存。
- 原则候选必须审核后才能成为 active principle。
- 冻结知识不会继续被默认召回。
- 使用反馈能回传为聚合信号。
- 原始对话和敏感内容不会上传。
