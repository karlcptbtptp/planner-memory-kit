# MCP 团队记忆实施方案

## 目标

把团队共享记忆从“飞书多维表格人工主库”升级为“远端 MCP 团队记忆库 + 本地个人知识池 + 本机 AI 高速缓存”。

本方案只定义接入流程、数据契约、本机缓存结构和 AI 使用方式；**不实现 MCP 服务本体**。

## 总体分工

| 层 | 角色 | 职责 |
|---|---|---|
| Git 工具包 | `planner-memory-kit` | 放模板、接入说明、同步适配示例、流程图和验收方案 |
| MCP 团队记忆库 | 远端服务 | 团队事实源、审核队列、原则库、冻结库、使用反馈聚合 |
| 本地个人知识池 | 每个项目本地 | 本地 AI 新产生的个人知识、草稿、候选、偏好和任务沉淀 |
| 本机 SQLite | 每个项目本地 | AI 运行缓存、全文搜索、任务记忆包、使用事件明细、LS 镜像 |
| Markdown 快照 | `03_memory/shared/` | 低 token 入口摘要，方便新对话快速加载 |
| 飞书 | 可选协作层 | 发布说明、通知、人工沟通；不再作为推荐记忆主库 |

## 端到端流程

1. **安装工具包**
   - 项目接入人安装本仓模板。
   - 合并 `AGENTS.memory.template.md` 到项目 AI 启动说明。
   - 配置 `.gitignore`，避免个人记忆和运行态入库。

2. **配置 MCP 连接**
   - 配置 `MCP_MEMORY_ENDPOINT`。
   - 配置 `PROJECT_ID`。
   - 配置 `ACTOR_ID` / `USER_ID`。
   - 凭据从环境变量或本机密码库读取，不写入 Git。

3. **本地默认沉淀为个人知识**
   - 本地 AI 新产生的知识，默认先进入本地个人知识池。
   - 个人偏好、本机路径、临时任务上下文、未脱敏材料只留本地。
   - 标注 `local_only`、`personal_only`、`do_not_upload`、`禁止同步` 的内容不得上传团队库。

4. **自动化筛选上传候选**
   - 本地自动化任务定期扫描个人知识池。
   - 只有可复用、已脱敏、有证据、有边界、非重复的知识才提交 LS。
   - 普通知识写入 `knowledge_items`，默认 `unreviewed` 或 `pending_review`。
   - 原则候选写入 `principle_candidates`，默认 `pending`。
   - Agent 可以提交候选，但不能直接写入正式原则或 accepted 知识。

5. **维护人审核**
   - 检查真实、可复用、不过期、不敏感、项目范围正确。
   - 普通知识通过后进入 `accepted`。
   - 原则候选通过后写入 `principles.active`。
   - 低价值、过期或风险内容进入 `edge`、`junk`、`frozen` 或 `deleted_candidate`。

6. **本机全量同步 LS**
   - 本机从 MCP 拉取当前项目可见、已审核、未冻结、权限允许的知识。
   - 写入现有本地 SQLite `knowledge` 表和 `03_memory/shared/team-memory.md`。
   - 不把未审核知识当作事实。

7. **AI 召回与协作**
   - 新对话先读 Markdown 快照和本轮任务记忆包。
   - 复杂问题用本机 SQLite 全文搜索召回。
   - 长对话中途刷新任务记忆包。
   - 用户指出“你忘了”时记录 miss。

8. **使用反馈和治理反馈回传**
   - 本机保留详细使用事件。
   - 定期只回传聚合反馈：召回、采纳、遗漏、纠错、忽略、阻断。
   - 定期上报重复、矛盾、旧版替代、高召回低采纳、召回词缺失等治理信号。
   - 不上传原始对话、用户隐私、运行态文件或敏感凭据。

## MCP 接入契约

MCP 服务需要暴露以下能力。具体服务、数据库和鉴权实现由团队自建，不在本仓实现。

### 推荐工具

| 工具 | 方向 | 用途 |
|---|---|---|
| `memory.submit_knowledge` | 本机/Agent -> MCP | 提交普通知识候选 |
| `memory.submit_principle_candidate` | 本机/Agent -> MCP | 提交原则候选 |
| `memory.export_project_memory` | MCP -> 本机 | 导出当前项目可同步知识 |
| `memory.export_principles` | MCP -> 本机 | 导出当前项目可用原则 |
| `memory.push_usage_events` | 本机 -> MCP | 回传聚合使用反馈 |
| `memory.submit_governance_feedback` | 本机 -> MCP | 上报重复、矛盾、旧版替代、召回词缺失等治理反馈 |
| `memory.get_review_queue` | MCP -> 维护台 | 查看待审核队列 |
| `memory.freeze_knowledge` | 维护台 -> MCP | 冻结低分、过期或风险知识 |

### 导出过滤条件

MCP 导出给本机时必须过滤：

- `status` 必须是 `accepted` 或正式原则 `active`。
- `project_id` 必须命中当前项目，或记录声明全项目可见。
- `clearance` 不高于当前 actor 权限。
- `frozen_at` 为空。
- 未命中敏感内容扫描。
- `delete_after` 未到期。

### 推荐远端表结构

#### `knowledge_items`

普通知识表，用于存策划或外部 Agent 写入的知识，默认未审核。

字段：

```text
id, title, content, summary, source_type, source_ref,
project_id, user_id, actor_id, tags,
status, quality_tier, clearance, health_score,
recall_count, adopt_count, miss_count, correction_count,
last_recalled_at, last_used_at,
reviewed_by, reviewed_at, frozen_at,
created_at, updated_at
```

状态：

```text
unreviewed, pending_review, accepted, edge, junk, frozen, deleted_candidate
```

#### `principle_candidates`

原则候选表。Agent 可以提交候选，但不能直接成为正式原则。

字段：

```text
id, title, content, evidence_refs, proposed_by,
project_id, status, reviewer, review_note,
created_at, reviewed_at
```

状态：

```text
pending, approved, rejected, merged
```

#### `principles`

正式原则表。维护人审核通过后，才进入这里。

字段：

```text
id, title, content, project_id, scope_tags,
source_candidate_id, status, clearance,
approved_by, approved_at, created_at, updated_at
```

状态：

```text
active, deprecated, archived
```

#### `memory_usage_events`

远端聚合使用反馈表。

字段：

```text
id, session_id, user_id, actor_id,
knowledge_id, principle_id,
event_type, query, feedback, score_delta,
feedback_token, created_at
```

事件：

```text
recall, adopt, miss, correction, ignore, blocked
```

#### `frozen_knowledge`

冷冻知识表，用于保存低分、过期、被冷冻的知识，避免直接物理删除。

字段：

```text
id, knowledge_id, title, content,
freeze_reason, freeze_snapshot,
can_restore, delete_after, frozen_by, frozen_at
```

## 本地记忆体表结构

本机继续使用项目现有 SQLite 结构。它是 AI 运行缓存，不是团队事实源。

### `conversations`

历史对话索引。

```text
id, title, first_user_msg, summary,
message_count, created_at, updated_at, ingested_at
```

### `messages`

历史消息全文检索来源。

```text
id, conversation_id, seq, role, content, created_at
```

### `knowledge`

本机可复用知识缓存。

```text
id, conversation_id, category,
title, summary, aliases, content, tags,
status, quality_score, source,
merged_into_id, review_note,
normalization_status, normalization_score,
original_title, normalized_at,
created_at, updated_at
```

字段说明：

| 字段 | 用途 |
|---|---|
| `summary` | 召回时的短摘要 |
| `aliases` | 召回词、别名、常见问法 |
| `status` | 本地可用状态，如 accepted / archived / merged |
| `quality_score` | 人工或治理质量，不等同于使用次数 |
| `source` | 来源，如 manual / mcp-team / feishu-legacy |
| `normalization_status` | 标题、摘要、召回词规范化状态 |
| `original_title` | 标题被人工确认改写时保存原标题 |

### 本地 LS 接入元数据

第一版仍复用现有本地记忆库，不强制改成本地团队库。为了支持“本地个人知识池 + LS 镜像”的流程，本地适配层至少需要能表达这些含义：

| 含义 | 现有字段建议 |
|---|---|
| 本地个人知识 | `source=manual|local-agent|personal`，必要时在 `tags` 标注 `personal` |
| LS 同步镜像 | `source=mcp-team`，远端 ID 写入 `review_note` 或适配层元数据 |
| 禁止上传 | `tags` 或正文标注 `do_not_upload` / `local_only` / `personal_only` / `禁止同步` |
| 已提交 LS 候选 | `review_note` 记录远端候选 ID 和提交时间 |
| LS 冻结或废弃 | 本地 `status=archived`，不进入默认召回 |

如果接入项目愿意做本地迁移，可额外增加 `remote_id`、`remote_status`、`upload_policy`、`sensitivity_flags`、`last_synced_at` 等字段；但本工具包不要求第一阶段必须迁移这些字段。

### `knowledge_usage_events`

本机详细使用反馈。

```text
id, knowledge_id, event_type, source,
query, note, position, created_at
```

事件：

```text
recall, adopt, correction
```

说明：

- `recall` 是传感器信号，表示被搜索、prefetch 或任务记忆包召回。
- `adopt` 是正反馈，表示被 AI 或用户确认用于回答、分析、决策。
- `correction` 是负反馈，表示被用户纠错、发现过期或误导。
- `miss` 不强行写入本表，因为 miss 往往表示“应该想起但没有对应知识被召回”；本地从 `memory_task_events.event_type=miss` 聚合后回传 LS。

### `memory_task_events`

本轮任务记忆包事件。

```text
id, task_id, event_type, knowledge_id, query, note, created_at
```

事件：

```text
start, refresh, pin, miss
```

### `episodes`

高价值任务检查点。

```text
id, conversation_id, title, summary, trigger,
score, status, categories, tags, next_step,
promoted_to, created_at, updated_at
```

### FTS 索引

本地维护两套全文索引：

| 索引 | 用途 |
|---|---|
| `*_fts` | unicode61 分词，适合英文和空格分隔文本 |
| `*_tri` | trigram 子串匹配，适合中文连续词 |

`knowledge` 的检索范围必须覆盖：

```text
title + summary + aliases + content + tags
```

## AI 使用记忆体的方式

本地智能体识别新知识时，先进入本地个人知识池；定期自动化任务按 [本地智能体知识识别与投稿指南](AGENT_KNOWLEDGE_SUBMISSION_GUIDE.md) 和 [本地智能体自动化治理任务](LOCAL_AGENT_AUTOMATION.md) 筛选上传候选、同步 LS 全量知识并回传治理反馈。

### 新对话开场

AI 应先读取本地低 token 入口：

```text
03_memory/shared/team-memory.md
03_memory/project/
03_memory/personal/ 仅本人可见时
```

然后生成本轮任务记忆包：

```powershell
npm run memory:task -- start "<任务关键词>"
```

### 需要查历史或项目知识

优先搜本地缓存：

```powershell
npm run memory:search -- "<关键词>"
npm run memory:search -- --knowledge "<关键词>"
```

### 长对话中途

当任务持续变长，刷新本轮上下文：

```powershell
npm run memory:task -- refresh
```

### 用户指出没想起

记录 miss，供后续治理：

```powershell
npm run memory:task -- miss "<应该想起的关键词>" --note "用户指出本轮未召回"
```

### 使用反馈

AI 或维护人确认知识被采用时：

```powershell
npm run memory:usage -- record --id 123 --type adopt --source manual --note "用于本次决策"
```

发现知识误导时：

```powershell
npm run memory:usage -- record --id 123 --type correction --source manual --note "口径已过期"
```

### 治理闭环

定期运行：

```powershell
npm run memory:normalize -- audit
npm run memory:usage -- audit
npm run memory:ls:maintain -- --project "<project_code>"
npm run memory:sync:mcp -- --project "<project_code>"
npm run memory:mcp:push-usage -- --project "<project_code>"
```

## 本地与 MCP 字段映射

| MCP 字段 | 本地字段 | 说明 |
|---|---|---|
| `knowledge_items.id` | `source_ref` 或 `review_note` | 本地需能追踪远端来源 |
| `title` | `knowledge.title` | 默认只拉取审核后的标题 |
| `summary` | `knowledge.summary` | 参与 FTS |
| `content` | `knowledge.content` | 长正文或文档链接摘要 |
| `tags` | `knowledge.tags` / `aliases` | 标签进 tags，召回词可补 aliases |
| `quality_tier` | `quality_score` | 映射为本地质量分 |
| `status` | `status` | accepted -> accepted，frozen -> archived |
| `project_id` | `tags` 或 `review_note` | 本地用于可见性追踪 |
| `clearance` | `review_note` | 本地只记录，不绕过远端过滤 |
| `principles.active` | `knowledge.category=decision/pattern` | 同步为高优先级稳定记忆 |

## 安全边界

- MCP token 只能从环境变量或本机密码库读取。
- 不在 Git、Markdown、SQLite 中写入真实密码或长期 token。
- 不上传原始对话、运行态目录、截图缓存、SQL 明细结果。
- 标注 `do_not_upload`、`local_only`、`personal_only`、`禁止同步` 的本地知识不得上传。
- 项目敏感知识必须由 MCP 端按 `clearance` 过滤后再导出。
- 本机同步命令必须支持 `--dry-run`，先看 accepted / skipped 再落地。

## 第一阶段验收

1. MCP 端准备 3 条测试知识：
   - 全项目原则 1 条。
   - 当前项目 accepted 知识 1 条。
   - 其它项目 accepted 知识 1 条。
2. 本机 dry-run 同步当前项目。
3. 验证只出现全项目原则和当前项目知识。
4. 真实同步后，本地搜索能召回。
5. 本地准备 3 条个人知识：可上传候选 1 条、敏感内容 1 条、`do_not_upload` 1 条。
6. 自动化 dry-run 只允许可上传候选进入提交清单。
7. 记录一次 adopt 和一次 miss。
8. 回传 usage 后，MCP 端健康度能看到聚合反馈。
9. 将当前项目知识冻结，再同步一次，本地不应继续默认召回。

## 不做的事

- 不在本仓实现 MCP 服务端。
- 不把飞书作为新版团队记忆主库。
- 不让 Agent 绕过维护人直接写正式原则。
- 不把本机 SQLite 当成团队事实源。
