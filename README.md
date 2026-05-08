# Planner Memory Kit

把策划团队维护在飞书多维表格里的知识，同步成每个项目本地 AI 可以读取的缓存。

核心约定：

- 飞书多维表格是人工主库。
- 项目本地 SQLite 和 `03_memory/shared/` 是 AI 缓存。
- Git 只放工具、模板和说明，不放真实知识库本体。
- 投稿必须经过项目知识维护人审核，才允许进入 AI 缓存。

## 快速开始

```powershell
npm install
cmd /c npm run memory:sync:feishu -- --source fixtures/feishu-memory.sample.json --dry-run
```

连接真实飞书主库：

```powershell
lark-cli auth login --scopes "base:record:read"
$env:FEISHU_MEMORY_APP_TOKEN="<your_base_app_token>"
$env:FEISHU_MEMORY_TABLE_ID="<your_table_id>"
cmd /c npm run memory:sync:feishu -- --project "<project_code>"
```

PowerShell 下推荐加 `cmd /c`，避免 npm 把 `--source`、`--project` 误解析成 npm 自己的参数。macOS/Linux 可直接使用 `npm run memory:sync:feishu -- --project "<project_code>"`。

## 同步硬闸门

会同步：

- `状态=已批准`
- `是否同步给 AI=true`
- `项目知识维护人` 非空
- `审核时间` 非空
- `敏感级别 != 禁止同步`
- `知识类型 != 个人知识`
- `可见范围 != 仅本人`
- `全策划` 内容，或 `指定项目` 且 `适用项目` 命中当前 `--project`

会拦截：

- token、secret、password、cookie、数据库连接串、私钥
- `99_runtime/`、`state/`
- `.Codex/settings.local.json`、`.cursor/mcp.json`、`.env`、`notifications.config.json`

## 文档

- [飞书字段模板](docs/FEISHU_FIELDS.md)
- [端到端测试方案](docs/E2E_TEST_PLAN.md)
- [项目 AGENTS 模板](docs/AGENTS.template.md)
