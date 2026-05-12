# 本地项目三模块搭建方案

目标：让每个策划项目接入共享记忆时，都有同一套本地组织方式。拿到 Git 工具仓和 MCP 团队记忆库接入信息后，项目里只需要搭三块：

1. **智能体记忆**：让 AI 记得住。
2. **个人工具**：让每个策划干活顺手。
3. **项目产出**：让过程和交付物有地方放。

## 推荐目录

```text
project-root/
  AGENTS.md
  package.json
  .gitignore

  03_memory/                  # 智能体记忆
    README.md
    shared/                   # 从 MCP 团队记忆库同步下来的团队知识缓存
      README.md
      team-memory.md          # 自动生成，不手写
    project/                  # 本项目稳定规则、项目地图、常用口径
    personal/                 # 个人记忆，不提交 Git

  90_tools/                   # 工具
    personal/                 # 个人脚本，不提交 Git
    shared/                   # 项目组认可的通用工具，可提交

  02_outputs/                 # 项目产出
    reports/                  # 分析报告、复盘
    specs/                    # 策划案、需求说明
    handoff/                  # 给他人交接的材料
```

## 模块 1：智能体记忆

作用：让 AI 在新对话里先读到稳定上下文，不让策划反复解释。

放什么：

- MCP 同步下来的团队共享知识：`03_memory/shared/team-memory.md`
- 本项目稳定规则：`03_memory/project/`
- 常用口径、流程、踩坑：`03_memory/project/`
- 个人偏好或只适合自己知道的内容：`03_memory/personal/`

规则：

- `03_memory/shared/team-memory.md` 由同步命令生成，不手写。
- `03_memory/personal/` 默认加入 `.gitignore`。
- 能复用给团队的知识，提交到 MCP 团队记忆库并走维护人审核。
- 未审核内容不能被 AI 当作事实，只能当作草稿或线索。

## 模块 2：个人工具

作用：让每个策划把自己的效率工具放在固定位置，避免散落到项目根目录。

放什么：

- 自己常用的小脚本。
- 临时批处理、快捷命令。
- 本机路径相关的工具包装。
- 只服务个人工作习惯的助手文件。

规则：

- `90_tools/personal/` 默认加入 `.gitignore`。
- 工具里不能硬编码 token、密码、Webhook、数据库连接串。
- 如果一个个人工具被 2 个以上策划复用，再提升到 `90_tools/shared/`。
- 提升到 shared 前，需要补 README、参数说明和安全边界。

## 模块 3：项目产出

作用：把 AI 和策划共同产出的东西留下来，方便复盘和交付。

放什么：

- 分析报告：`02_outputs/reports/`
- 策划案或需求草稿：`02_outputs/specs/`
- 交接材料：`02_outputs/handoff/`
- 测试记录、结论快照、评审准备材料

规则：

- 进行中的材料可以先放 `02_outputs/`。
- 已经验证、以后会反复用的内容，提炼后进入 MCP 团队记忆库。
- 含敏感数据的产出要脱敏；不要放原始凭据、登录态、单用户明细。
- 临时截图、运行缓存、下载物不要放这里，应放项目自己的运行态目录。

## 最小接入步骤

1. 复制 `templates/local-project/` 的目录结构到项目根目录。
2. 把 `templates/local-project/AGENTS.memory.template.md` 的内容合并进项目 `AGENTS.md`。
3. 把 `templates/local-project/gitignore.snippet` 合并进项目 `.gitignore`。
4. 在项目 `package.json` 加同步命令，例如：

```json
{
  "scripts": {
    "memory:sync:mcp": "tsx 90_tools/planner-memory-kit/src/sync-mcp.ts",
    "memory:mcp:push-usage": "tsx 90_tools/planner-memory-kit/src/push-usage-mcp.ts"
  }
}
```

5. 配置 MCP 团队记忆库：

```powershell
$env:MCP_MEMORY_ENDPOINT="https://memory.example.com/mcp"
$env:MCP_MEMORY_TOKEN="<read_from_local_vault_or_env>"
$env:PROJECT_ID="<project_code>"
cmd /c npm run memory:sync:mcp -- --project "<project_code>" --dry-run
```

6. dry-run 确认只同步本项目可见知识后，再去掉 `--dry-run`。

## 是否提交 Git

| 内容 | 建议 |
|---|---|
| `03_memory/shared/README.md` | 提交 |
| `03_memory/shared/team-memory.md` | 第一版默认不提交，除非团队明确要做脱敏镜像 |
| `03_memory/project/` | 可提交，但要先脱敏 |
| `03_memory/personal/` | 不提交 |
| `90_tools/personal/` | 不提交 |
| `90_tools/shared/` | 可提交 |
| `02_outputs/` | 按项目规则决定，含敏感数据的不要提交 |

## 判断一句话

- AI 要长期记住的东西：进 **智能体记忆**。
- 只帮自己提效的东西：进 **个人工具**。
- 这次工作产出的东西：进 **项目产出**。

