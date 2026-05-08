#!/usr/bin/env tsx

import assert from "node:assert/strict";
import {
  normalizeFeishuKnowledgeRecords,
  renderSharedMemoryMarkdown,
} from "./feishu-sync-core.js";

function record(recordId: string, fields: Record<string, unknown>) {
  return { record_id: recordId, fields };
}

const rows = [
  record("rec_ok_team", {
    标题: "SQL Lab 正式查询口径",
    摘要: "正式充值分析先确认项目和 ODS 表，不从空 ADS 表直接下结论。",
    "正文/文档链接": "03_memory/database-map/schema-overview.md",
    知识类型: "项目知识",
    可见范围: "全策划",
    适用项目: "giftWeb",
    标签: "SQL,口径",
    状态: "已批准",
    敏感级别: "普通内部",
    提交人: "张三",
    提交时间: "2026-05-08",
    项目知识维护人: "维护人 A",
    审核时间: "2026-05-08 12:00",
    审核意见: "口径清楚，可进入主库。",
    负责人: "李若轻",
    来源: "当前 03_memory",
    "是否同步给 AI": true,
  }),
  record("rec_ok_project", {
    标题: "能量房资金流分析原则",
    摘要: "能量房不能只看 RTP，要同时看弹头兑换、活动注入和渔场抽水。",
    "正文/文档链接": "03_memory/runbooks/energy-room-reconcile.md",
    知识类型: { text: "原则" },
    可见范围: { text: "指定项目" },
    适用项目: ["giftWeb", "hwby"],
    标签: ["能量房", "资金流"],
    状态: { text: "已批准" },
    敏感级别: { text: "项目敏感" },
    提交人: [{ name: "张三" }],
    提交时间: "2026-05-08",
    项目知识维护人: [{ name: "维护人 A" }],
    审核时间: "2026-05-08 12:00",
    审核意见: "已核对路径和适用项目。",
    负责人: [{ name: "李若轻" }],
    来源: "当前 03_memory",
    "是否同步给 AI": "是",
  }),
  record("rec_draft", {
    标题: "草稿不应同步",
    摘要: "还没有审核。",
    知识类型: "项目知识",
    可见范围: "全策划",
    适用项目: "giftWeb",
    状态: "草稿",
    敏感级别: "普通内部",
    "是否同步给 AI": true,
  }),
  record("rec_unreviewed", {
    标题: "已批准但没有维护人审核痕迹",
    摘要: "状态被改成已批准，但缺项目知识维护人和审核时间。",
    知识类型: "项目知识",
    可见范围: "全策划",
    适用项目: "giftWeb",
    状态: "已批准",
    敏感级别: "普通内部",
    "是否同步给 AI": true,
  }),
  record("rec_no_ai", {
    标题: "未授权 AI 同步",
    摘要: "人工可见，但不进本地 AI 缓存。",
    知识类型: "项目知识",
    可见范围: "全策划",
    适用项目: "giftWeb",
    状态: "已批准",
    敏感级别: "普通内部",
    "是否同步给 AI": false,
  }),
  record("rec_personal", {
    标题: "个人知识不进团队同步",
    摘要: "仅个人知道。",
    知识类型: "个人知识",
    可见范围: "仅本人",
    适用项目: "giftWeb",
    状态: "已批准",
    敏感级别: "普通内部",
    "是否同步给 AI": true,
  }),
  record("rec_forbidden", {
    标题: "禁止同步内容",
    摘要: "有业务风险。",
    知识类型: "项目知识",
    可见范围: "全策划",
    适用项目: "giftWeb",
    状态: "已批准",
    敏感级别: "禁止同步",
    "是否同步给 AI": true,
  }),
  record("rec_other_project", {
    标题: "其他项目内容",
    摘要: "不应落入 giftWeb 缓存。",
    知识类型: "项目知识",
    可见范围: "指定项目",
    适用项目: "otherProject",
    状态: "已批准",
    敏感级别: "普通内部",
    "是否同步给 AI": true,
  }),
  record("rec_sensitive", {
    标题: "含凭据内容必须拦截",
    摘要: "password=<REDACTION_TEST_PASSWORD> 不应写入缓存。",
    知识类型: "项目知识",
    可见范围: "全策划",
    适用项目: "giftWeb",
    状态: "已批准",
    敏感级别: "普通内部",
    "是否同步给 AI": true,
  }),
  record("rec_runtime", {
    标题: "运行态路径必须拦截",
    摘要: "不要同步 99_runtime/sql-lab/profile 的任何内容。",
    知识类型: "项目知识",
    可见范围: "全策划",
    适用项目: "giftWeb",
    状态: "已批准",
    敏感级别: "普通内部",
    "是否同步给 AI": true,
  }),
];

const result = normalizeFeishuKnowledgeRecords(rows, {
  project: "giftWeb",
});

assert.equal(result.accepted.length, 2);
assert.deepEqual(
  result.accepted.map((item) => item.recordId),
  ["rec_ok_team", "rec_ok_project"],
);

assert.equal(result.skipped.length, 6);
assert.deepEqual(
  result.skipped.map((item) => item.reason),
  [
    "status-not-approved",
    "review-required",
    "ai-sync-disabled",
    "personal-knowledge",
    "sync-forbidden",
    "project-not-visible",
  ],
);

assert.equal(result.blocked.length, 2);
assert.deepEqual(
  result.blocked.map((item) => item.recordId),
  ["rec_sensitive", "rec_runtime"],
);
assert.ok(result.blocked[0].labels.includes("password"));
assert.ok(result.blocked[1].labels.includes("runtime-path"));

const markdown = renderSharedMemoryMarkdown(result.accepted, {
  project: "giftWeb",
  sourceLabel: "feishu-test",
});

assert.match(markdown, /# 团队共享记忆缓存/);
assert.match(markdown, /SQL Lab 正式查询口径/);
assert.match(markdown, /scope: project/);
assert.match(markdown, /visibility: team/);
assert.match(markdown, /reviewer: 维护人 A/);
assert.match(markdown, /reviewed: 2026-05-08 12:00/);
assert.doesNotMatch(markdown, /REDACTION_TEST_PASSWORD/);
assert.doesNotMatch(markdown, /99_runtime/);

console.log("feishu-sync-core tests passed");
