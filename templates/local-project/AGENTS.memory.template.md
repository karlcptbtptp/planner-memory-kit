# 团队共享记忆与本地三模块

## 新对话启动

新对话开始时，先读取：

1. `03_memory/shared/README.md`
2. `03_memory/shared/team-memory.md`
3. `03_memory/project/` 中与当前任务相关的项目规则

## 三模块规则

| 模块 | 目录 | 说明 |
|---|---|---|
| 智能体记忆 | `03_memory/` | AI 稳定上下文、共享知识缓存、项目规则 |
| 个人工具 | `90_tools/personal/` | 个人脚本和本地工具，默认不提交 Git |
| 项目产出 | `02_outputs/` | 报告、策划案、复盘、交付物 |

## 同步命令

```powershell
cmd /c npm run memory:sync:mcp -- --project "<project_code>" --dry-run
cmd /c npm run memory:sync:mcp -- --project "<project_code>"
cmd /c npm run memory:mcp:push-usage -- --project "<project_code>"
```

## 安全规则

- 个人记忆不进团队 Git。
- 个人工具不进团队 Git。
- 未审核知识不能当作事实。
- 禁止同步、个人知识、冻结知识、其它项目知识不能进入本项目缓存。
- 本机只回传聚合使用反馈，不上传原始对话或敏感上下文。
- 不写 token、cookie、密码、数据库连接串、Webhook、登录态或运行缓存路径。

