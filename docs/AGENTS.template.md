# Project Memory Instructions

把本段放进项目的 `AGENTS.md` 或等价的 AI 启动说明里。

## 团队共享记忆

新对话启动时，先读取本地团队共享缓存：

1. `03_memory/shared/README.md`
2. `03_memory/shared/feishu-memory.md`

## 本地三模块

本项目按三块组织：

| 模块 | 目录 | 规则 |
|---|---|---|
| 智能体记忆 | `03_memory/` | 放 AI 需要稳定记住的内容；飞书同步缓存进入 `03_memory/shared/`；个人记忆进入 `03_memory/personal/` 且不提交 |
| 个人工具 | `90_tools/personal/` | 放每个策划自己的脚本、快捷命令和本地工具；默认不提交团队 Git |
| 项目产出 | `02_outputs/` | 放报告、策划案草稿、评审材料、交付物；可按项目规则提交 |

如果需要同步飞书主库：

```powershell
npm run memory:sync:feishu -- --project "<project_code>"
```

同步规则：

- 飞书是人工主库，本地文件只是 AI 缓存。
- 只读取已批准且允许同步给 AI 的知识。
- `项目知识维护人` 和 `审核时间` 缺任意一个，都视为未审核。
- 个人知识、禁止同步内容和其它项目知识不能进入本项目缓存。
