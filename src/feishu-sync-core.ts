import { detectSensitiveLabels, redactText } from "./redact.js";

export const FEISHU_MEMORY_FIELDS = {
  title: "标题",
  summary: "摘要",
  bodyOrLink: "正文/文档链接",
  knowledgeType: "知识类型",
  visibility: "可见范围",
  project: "适用项目",
  tags: "标签",
  status: "状态",
  sensitivity: "敏感级别",
  submitter: "提交人",
  submittedAt: "提交时间",
  reviewer: "项目知识维护人",
  reviewedAt: "审核时间",
  reviewNote: "审核意见",
  owner: "负责人",
  source: "来源",
  updatedAt: "最后更新",
  syncToAi: "是否同步给 AI",
} as const;

export type KnowledgeScope = "principle" | "project" | "personal";
export type KnowledgeVisibility = "team" | "project" | "local";
export type SkipReason =
  | "status-not-approved"
  | "ai-sync-disabled"
  | "review-required"
  | "personal-knowledge"
  | "sync-forbidden"
  | "project-not-visible";

export interface RawFeishuRecord {
  record_id?: string;
  fields?: Record<string, unknown>;
}

export interface SharedKnowledgeItem {
  recordId: string;
  title: string;
  summary: string;
  bodyOrLink: string;
  scope: KnowledgeScope;
  visibility: KnowledgeVisibility;
  projects: string[];
  tags: string[];
  owner: string;
  submitter: string;
  submittedAt: string;
  reviewer: string;
  reviewedAt: string;
  reviewNote: string;
  source: string;
  updatedAt: string;
  sensitivity: string;
}

export interface NormalizationOptions {
  project: string;
}

export interface NormalizationResult {
  accepted: SharedKnowledgeItem[];
  skipped: Array<{ recordId: string; title: string; reason: SkipReason }>;
  blocked: Array<{ recordId: string; title: string; labels: string[] }>;
}

export interface MarkdownOptions {
  project: string;
  sourceLabel: string;
}

const FORBIDDEN_PATH_RULES: Array<{ label: string; pattern: RegExp }> = [
  { label: "runtime-path", pattern: /(^|[\\/\s`'"])(99_runtime|state)([\\/]|$)/i },
  { label: "local-codex-settings", pattern: /(^|[\\/\s`'"])\.Codex[\\/]settings\.local\.json\b/i },
  { label: "cursor-mcp-config", pattern: /(^|[\\/\s`'"])\.cursor[\\/]mcp\.json\b/i },
  { label: "local-env-file", pattern: /(^|[\\/\s`'"])\.env(?:\.local)?\b/i },
  { label: "notification-config", pattern: /(^|[\\/\s`'"])notifications\.config\.json\b/i },
];

export function normalizeFeishuKnowledgeRecords(
  records: RawFeishuRecord[],
  options: NormalizationOptions,
): NormalizationResult {
  const accepted: SharedKnowledgeItem[] = [];
  const skipped: NormalizationResult["skipped"] = [];
  const blocked: NormalizationResult["blocked"] = [];

  for (const [index, record] of records.entries()) {
    const fields = record.fields ?? {};
    const recordId = record.record_id || `row-${index + 1}`;
    const title = fieldToText(fields[FEISHU_MEMORY_FIELDS.title]) || `(untitled ${recordId})`;
    const status = fieldToText(fields[FEISHU_MEMORY_FIELDS.status]);
    const syncToAi = fieldToBoolean(fields[FEISHU_MEMORY_FIELDS.syncToAi]);
    const sensitivity = fieldToText(fields[FEISHU_MEMORY_FIELDS.sensitivity]);
    const scope = normalizeScope(fieldToText(fields[FEISHU_MEMORY_FIELDS.knowledgeType]));
    const visibility = normalizeVisibility(fieldToText(fields[FEISHU_MEMORY_FIELDS.visibility]));
    const projects = fieldToList(fields[FEISHU_MEMORY_FIELDS.project]);
    const reviewer = fieldToText(fields[FEISHU_MEMORY_FIELDS.reviewer]);
    const reviewedAt = fieldToText(fields[FEISHU_MEMORY_FIELDS.reviewedAt]);

    if (!isApproved(status)) {
      skipped.push({ recordId, title: redactText(title), reason: "status-not-approved" });
      continue;
    }
    if (!syncToAi) {
      skipped.push({ recordId, title: redactText(title), reason: "ai-sync-disabled" });
      continue;
    }
    if (scope === "personal" || visibility === "local") {
      skipped.push({ recordId, title: redactText(title), reason: "personal-knowledge" });
      continue;
    }
    if (isSyncForbidden(sensitivity)) {
      skipped.push({ recordId, title: redactText(title), reason: "sync-forbidden" });
      continue;
    }
    if (!isVisibleToProject(visibility, projects, options.project)) {
      skipped.push({ recordId, title: redactText(title), reason: "project-not-visible" });
      continue;
    }

    const item: SharedKnowledgeItem = {
      recordId,
      title: redactText(title),
      summary: redactText(fieldToText(fields[FEISHU_MEMORY_FIELDS.summary])),
      bodyOrLink: redactText(fieldToText(fields[FEISHU_MEMORY_FIELDS.bodyOrLink])),
      scope,
      visibility,
      projects: projects.map(redactText),
      tags: fieldToList(fields[FEISHU_MEMORY_FIELDS.tags]).map(redactText),
      owner: redactText(fieldToText(fields[FEISHU_MEMORY_FIELDS.owner])),
      submitter: redactText(fieldToText(fields[FEISHU_MEMORY_FIELDS.submitter])),
      submittedAt: redactText(fieldToText(fields[FEISHU_MEMORY_FIELDS.submittedAt])),
      reviewer: redactText(reviewer),
      reviewedAt: redactText(reviewedAt),
      reviewNote: redactText(fieldToText(fields[FEISHU_MEMORY_FIELDS.reviewNote])),
      source: redactText(fieldToText(fields[FEISHU_MEMORY_FIELDS.source])),
      updatedAt: redactText(fieldToText(fields[FEISHU_MEMORY_FIELDS.updatedAt])),
      sensitivity: redactText(sensitivity || "普通内部"),
    };

    const labels = detectForbiddenLabels([
      item.title,
      item.summary,
      item.bodyOrLink,
      item.projects.join(","),
      item.tags.join(","),
      item.owner,
      item.submitter,
      item.submittedAt,
      item.reviewer,
      item.reviewedAt,
      item.reviewNote,
      item.source,
      item.updatedAt,
      item.sensitivity,
    ].join("\n"));

    if (labels.length > 0) {
      blocked.push({ recordId, title: item.title, labels });
      continue;
    }
    if (!item.reviewer || !item.reviewedAt) {
      skipped.push({ recordId, title: item.title, reason: "review-required" });
      continue;
    }

    accepted.push(item);
  }

  return { accepted, skipped, blocked };
}

export function renderSharedMemoryMarkdown(
  items: SharedKnowledgeItem[],
  options: MarkdownOptions,
): string {
  const now = new Date().toLocaleString("zh-CN", { hour12: false });
  const lines = [
    "# 团队共享记忆缓存",
    "",
    `项目: ${options.project}`,
    `来源: ${options.sourceLabel}`,
    `最后同步: ${now}`,
    "",
    "> 本文件由 memory:sync:feishu 生成，只包含飞书中已批准且允许同步给 AI 的团队知识。个人知识和禁止同步内容不会写入这里。",
    "",
  ];

  if (items.length === 0) {
    lines.push("暂无可同步知识。", "");
    return lines.join("\n");
  }

  for (const item of items) {
    lines.push(`## ${item.title}`);
    lines.push("");
    if (item.summary) {
      lines.push(item.summary);
      lines.push("");
    }
    if (item.bodyOrLink) {
      lines.push(`- 正文/链接: ${item.bodyOrLink}`);
    }
    lines.push(`- scope: ${item.scope}`);
    lines.push(`- visibility: ${item.visibility}`);
    if (item.projects.length > 0) lines.push(`- projects: ${item.projects.join(", ")}`);
    if (item.tags.length > 0) lines.push(`- tags: ${item.tags.join(", ")}`);
    if (item.owner) lines.push(`- owner: ${item.owner}`);
    if (item.submitter) lines.push(`- submitter: ${item.submitter}`);
    if (item.submittedAt) lines.push(`- submitted: ${item.submittedAt}`);
    lines.push(`- reviewer: ${item.reviewer}`);
    lines.push(`- reviewed: ${item.reviewedAt}`);
    if (item.reviewNote) lines.push(`- review_note: ${item.reviewNote}`);
    if (item.source) lines.push(`- source: ${item.source}`);
    if (item.updatedAt) lines.push(`- updated: ${item.updatedAt}`);
    lines.push(`- sensitivity: ${item.sensitivity}`);
    lines.push(`- feishu_record: ${item.recordId}`);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function knowledgeCategoryForScope(scope: KnowledgeScope): "decision" | "insight" | "pattern" {
  if (scope === "principle") return "pattern";
  if (scope === "project") return "insight";
  return "decision";
}

export function tagsForKnowledgeItem(item: SharedKnowledgeItem, project: string): string {
  return [
    "shared-memory",
    "feishu",
    `scope:${item.scope}`,
    `visibility:${item.visibility}`,
    `project:${project}`,
    ...item.tags,
  ].join(",");
}

export function contentForKnowledgeItem(item: SharedKnowledgeItem): string {
  return [
    item.summary,
    item.bodyOrLink ? `正文/链接: ${item.bodyOrLink}` : "",
    item.projects.length > 0 ? `适用项目: ${item.projects.join(", ")}` : "",
    item.owner ? `负责人: ${item.owner}` : "",
    item.submitter ? `提交人: ${item.submitter}` : "",
    item.submittedAt ? `提交时间: ${item.submittedAt}` : "",
    `项目知识维护人: ${item.reviewer}`,
    `审核时间: ${item.reviewedAt}`,
    item.reviewNote ? `审核意见: ${item.reviewNote}` : "",
    item.source ? `来源: ${item.source}` : "",
    item.updatedAt ? `最后更新: ${item.updatedAt}` : "",
    `敏感级别: ${item.sensitivity}`,
    `飞书记录: ${item.recordId}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function detectForbiddenLabels(text: string): string[] {
  const labels = new Set(detectSensitiveLabels(text));
  for (const rule of FORBIDDEN_PATH_RULES) {
    if (rule.pattern.test(text)) {
      labels.add(rule.label);
    }
  }
  return [...labels];
}

function isApproved(status: string): boolean {
  return status.trim() === "已批准";
}

function isSyncForbidden(sensitivity: string): boolean {
  return sensitivity.includes("禁止同步");
}

function isVisibleToProject(
  visibility: KnowledgeVisibility,
  projects: string[],
  project: string,
): boolean {
  if (visibility === "team") return true;
  const normalizedProject = project.trim().toLowerCase();
  return projects
    .map((item) => item.trim().toLowerCase())
    .some((item) => item === normalizedProject || item === "*" || item === "all" || item === "全部");
}

function normalizeScope(raw: string): KnowledgeScope {
  if (raw.includes("个人")) return "personal";
  if (raw.includes("原则")) return "principle";
  return "project";
}

function normalizeVisibility(raw: string): KnowledgeVisibility {
  if (raw.includes("仅本人") || raw.includes("本人") || raw.includes("个人")) return "local";
  if (raw.includes("指定项目") || raw.includes("项目")) return "project";
  return "team";
}

function fieldToBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = fieldToText(value).trim().toLowerCase();
  return ["true", "1", "yes", "y", "是", "已勾选", "同步"].includes(text);
}

function fieldToList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => fieldToList(item));
  }
  return fieldToText(value)
    .split(/[,，;；\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fieldToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map(fieldToText).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["text", "name", "en_name", "value", "link", "url", "id"]) {
      const text = fieldToText(obj[key]);
      if (text) return text;
    }
    return Object.values(obj).map(fieldToText).filter(Boolean).join(", ");
  }
  return String(value).trim();
}
