# 本地智能体自动化治理任务

本文件定义每个接入项目本地应运行的记忆自动化任务。它负责在“个人知识池”和“LS / MCP 团队记忆库”之间建立闭环。

## 核心口径

默认情况下，本地新产生的知识先进入**个人知识池**，不是直接进入团队库。

这不是默认双写机制：本地保存是个人工作记忆，上传 LS 是经过自动化筛选、脱敏、去重后的候选提交。未通过筛选、未确认项目范围、含敏感信息、或明确标注不上传团队的内容，只留在本地或进入本地治理报告。

本地自动化任务定期执行四件事：

1. 从本地个人知识池中筛选适合团队复用的知识候选，脱敏后提交到 LS / MCP 审核队列。
2. 从 LS / MCP 全量同步当前项目可见的已审核团队知识到本地缓存。
3. 整理和蒸馏本地知识，识别重复、矛盾、过期、旧版被新版替代等问题。
4. 汇总最近 LS 知识的使用情况，把有用、无用、遗漏、纠错、冲突反馈回传 LS。

## 记忆分层

| 层 | 默认归属 | 用途 | 是否上传 |
|---|---|---|---|
| 本地个人知识池 | 本机 / 个人 | 本地 AI 的经验、偏好、草稿、候选、任务沉淀 | 默认不上传 |
| 本地团队缓存 | 本机缓存 | 从 LS 同步来的已审核团队知识，供 AI 召回 | 来自 LS，不反向覆盖 |
| LS / MCP 团队记忆库 | 团队事实源 | 审核后的团队知识、原则、冻结状态、团队级反馈 | 只接收候选和反馈 |
| 本地使用事件 | 本机运行态 | recall、adopt、miss、correction、ignore 等使用信号 | 只聚合回传 |

## 推荐自动化任务

建议在每个项目配置一个每日或每 4-6 小时运行的任务：

```powershell
cmd /c npm run memory:ls:maintain -- --project "<project_code>"
```

如果项目仍使用 MCP 命名，也可以叫：

```powershell
cmd /c npm run memory:mcp:maintain -- --project "<project_code>"
```

这个命令是接入层约定，不要求本仓实现 LS / MCP 服务本体。

## 自动化执行顺序

### 1. 本地增量入库

把最近对话、任务记录、手动蒸馏内容进入本地个人知识池。

预期输入：

- 本地 conversations / messages
- 本地 knowledge 中 `source=manual|local-agent|personal`
- 本地 episodes / task events
- 本地 usage events

### 2. 本地知识规范化

自动化先整理本地候选，不直接上传。

处理：

- 补摘要。
- 补召回词。
- 标记标题过短、标题过长、正文过短。
- 识别过程日志。
- 识别重复和疑似合并项。

输出：

- 本地 `normalization_status`
- 本地候选治理报告
- 不直接改 LS 主字段

### 3. 筛选可上传候选

只有满足条件的个人知识才提交到 LS：

- 有明确结论。
- 有适用场景。
- 有证据或来源。
- 有边界。
- 以后会复用。
- 不含敏感信息。
- 未标注“不上传团队”。
- 不属于个人偏好或本机路径。
- 不是已有 LS 知识的重复版本。

默认提交为：

```text
knowledge_items.status = pending_review
principle_candidates.status = pending
```

本地智能体不能自动设为 `accepted` 或 `active principle`。

### 4. 敏感内容和禁止上传检查

上传前必须拦截：

- token、secret、password、cookie、私钥、连接串、Webhook。
- 单用户隐私、账号明细、聊天原文。
- 运行态目录，例如 `99_runtime/`、浏览器 profile、截图缓存。
- 标注 `do_not_upload`、`personal_only`、`local_only`、`禁止同步` 的内容。
- 权限不明或项目范围不明的内容。

如果命中敏感项：

- 不上传。
- 本地标记 `blocked` 或写入治理报告。
- 必要时生成“需人工脱敏”的本地任务。

### 5. 上传候选到 LS

普通知识使用：

```text
memory.submit_knowledge
```

原则候选使用：

```text
memory.submit_principle_candidate
```

上传成功后，本地记录远端候选 ID，但仍保持本地候选状态。维护人审核前，不进入默认团队缓存。

### 6. 全量同步 LS 到本地

自动化每次都应同步 LS 当前项目可见的全量已审核知识。

同步范围：

- `knowledge_items.status=accepted`
- `principles.status=active`
- 当前项目可见或全项目可见
- 权限允许
- 未冻结、未归档、未删除

落地到：

- 本地 SQLite `knowledge`
- `03_memory/shared/team-memory.md`
- 本地 FTS 索引

同步规则：

- LS 是团队事实源。
- 本地团队缓存是镜像，不在本地直接修改主字段。
- LS 中冻结或废弃的知识，本地应降权、归档或移出默认召回。

### 7. 冲突、重复和过期反馈

自动化应定期扫描：

- 本地个人知识 vs LS 知识是否重复。
- LS 知识之间是否矛盾。
- 本地新知识是否覆盖旧 LS 结论。
- 某条 LS 知识是否高召回低采纳。
- 某条 LS 知识是否被 correction 指出误导。

反馈给 LS 的类型：

| 类型 | 含义 |
|---|---|
| `duplicate_candidate` | 疑似重复，可合并 |
| `conflict_candidate` | 同一对象出现相反结论 |
| `superseded_candidate` | 新版结论可能替代旧版 |
| `low_adoption` | 高频召回但很少被采纳 |
| `correction` | 用户或 AI 发现误导、过期、错误 |
| `missing_alias` | 该知识有用但召回词不足 |

这些反馈不直接改 LS 主字段，只进入维护人治理队列。

### 8. 使用反馈汇总

自动化定期汇总本地对 LS 知识的使用情况。

应回传：

- 最近被召回的 LS 知识。
- 被采纳用于回答、分析、决策的 LS 知识。
- 被忽略或召回后无用的 LS 知识。
- 用户指出“应该想起但没想起”的 miss。
- 被纠错或发现过期的知识。
- 因权限或敏感规则被 blocked 的知识。

不回传：

- 原始对话全文。
- 用户隐私。
- SQL 明细结果。
- 本机路径和运行态文件。
- 凭据和登录态。

## 建议命令拆分

完整维护：

```powershell
npm run memory:ls:maintain -- --project "<project_code>"
```

只筛选上传候选：

```powershell
npm run memory:ls:submit-candidates -- --project "<project_code>" --dry-run
```

只同步 LS：

```powershell
npm run memory:sync:mcp -- --project "<project_code>" --full
```

只回传使用反馈：

```powershell
npm run memory:mcp:push-usage -- --project "<project_code>"
```

只生成冲突治理报告：

```powershell
npm run memory:ls:audit -- --project "<project_code>"
```

## dry-run 要求

任何会上传、回传或改变本地团队缓存的动作都必须支持 dry-run。

dry-run 至少输出：

- 将上传多少条候选。
- 因敏感内容拦截多少条。
- 因 `local_only` / `do_not_upload` 跳过多少条。
- 与 LS 重复多少条。
- 将同步多少条 LS 知识。
- 将归档多少条本地旧 LS 镜像。
- 将回传多少条 usage / conflict / correction 反馈。

## 自动化输出报告

每次运行应生成本地报告：

```text
02_outputs/memory-governance/ls-maintain-YYYYMMDD-HHMM.md
```

报告包含：

- 上传候选清单。
- 被拦截清单。
- LS 同步摘要。
- 冲突 / 重复 / 旧版替代候选。
- 最近使用 LS 知识的采纳和无用情况。
- 需要维护人处理的问题。

## 最小验收

第一版自动化通过需要满足：

1. 本地新知识默认只进入个人知识池。
2. 标注 `do_not_upload` / `local_only` 的内容不会上传。
3. 敏感内容不会上传。
4. 可复用、已脱敏的个人知识会作为候选提交 LS。
5. LS 已审核知识能全量同步到本地。
6. LS 冻结知识不会继续默认召回。
7. 本地使用反馈能聚合回传 LS。
8. 冲突和重复只作为治理反馈上报，不自动改 LS 主字段。
