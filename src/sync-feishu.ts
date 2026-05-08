#!/usr/bin/env tsx

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  FEISHU_MEMORY_FIELDS,
  normalizeFeishuKnowledgeRecords,
  renderSharedMemoryMarkdown,
  type RawFeishuRecord,
} from "./feishu-sync-core.js";
import { writeLocalCache } from "./local-cache.js";
import { runLarkCliCommand } from "./run-lark-cli.js";

interface ParsedArgs {
  appToken?: string;
  tableId?: string;
  sourcePath?: string;
  project: string;
  outputPath: string;
  dbPath: string;
  dryRun: boolean;
  printSchema: boolean;
  executable?: string;
  pageSize: number;
}

function parseArgs(argv = process.argv.slice(2)): ParsedArgs {
  const parsed: ParsedArgs = {
    appToken: process.env.FEISHU_MEMORY_APP_TOKEN,
    tableId: process.env.FEISHU_MEMORY_TABLE_ID,
    project: process.env.FEISHU_MEMORY_PROJECT || "demo-project",
    outputPath: process.env.FEISHU_MEMORY_OUTPUT || "03_memory/shared/feishu-memory.md",
    dbPath: process.env.FEISHU_MEMORY_DB || "memory.sqlite",
    dryRun: false,
    printSchema: false,
    executable: process.env.FEISHU_MEMORY_LARK_CLI,
    pageSize: Number.parseInt(process.env.FEISHU_MEMORY_PAGE_SIZE || "500", 10),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--app" && argv[i + 1]) parsed.appToken = argv[++i];
    else if (arg === "--table" && argv[i + 1]) parsed.tableId = argv[++i];
    else if (arg === "--source" && argv[i + 1]) parsed.sourcePath = argv[++i];
    else if (arg === "--project" && argv[i + 1]) parsed.project = argv[++i];
    else if (arg === "--output" && argv[i + 1]) parsed.outputPath = argv[++i];
    else if (arg === "--db" && argv[i + 1]) parsed.dbPath = argv[++i];
    else if (arg === "--lark-cli" && argv[i + 1]) parsed.executable = argv[++i];
    else if (arg === "--page-size" && argv[i + 1]) parsed.pageSize = Number.parseInt(argv[++i], 10);
    else if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--print-schema") parsed.printSchema = true;
    else if (arg === "--help" || arg === "-h") printHelpAndExit(0);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(parsed.pageSize) || parsed.pageSize <= 0) parsed.pageSize = 500;
  return parsed;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  if (args.printSchema) {
    console.log(renderSchema());
    return;
  }

  const records = args.sourcePath
    ? loadRecordsFromJson(args.sourcePath)
    : await fetchRecordsFromFeishu(args);

  const normalized = normalizeFeishuKnowledgeRecords(records, { project: args.project });
  const markdown = renderSharedMemoryMarkdown(normalized.accepted, {
    project: args.project,
    sourceLabel: args.sourcePath ? `local:${args.sourcePath}` : `feishu:${args.appToken}/${args.tableId}`,
  });

  console.log(`Feishu records: ${records.length}`);
  console.log(`Accepted: ${normalized.accepted.length}`);
  console.log(`Skipped:  ${normalized.skipped.length}`);
  console.log(`Blocked:  ${normalized.blocked.length}`);

  for (const item of normalized.blocked) {
    console.log(`  BLOCKED ${item.recordId}: ${item.title} (${item.labels.join(", ")})`);
  }
  for (const item of normalized.skipped) {
    console.log(`  skipped ${item.recordId}: ${item.title} (${item.reason})`);
  }

  if (args.dryRun) {
    console.log("\nDry run only. Markdown preview:\n");
    console.log(markdown);
    return;
  }

  const result = writeLocalCache(normalized.accepted, markdown, {
    dbPath: args.dbPath,
    markdownPath: args.outputPath,
    project: args.project,
  });
  console.log(`\nWrote markdown: ${result.markdownPath}`);
  console.log(`Wrote SQLite: ${result.dbPath}`);
  console.log(`SQLite changes: inserted ${result.inserted}, updated ${result.updated}, archived ${result.archived}`);
}

function loadRecordsFromJson(sourcePath: string): RawFeishuRecord[] {
  const resolved = resolve(process.cwd(), sourcePath);
  if (!existsSync(resolved)) throw new Error(`Source JSON not found: ${resolved}`);
  const parsed = JSON.parse(readFileSync(resolved, "utf8")) as unknown;
  if (Array.isArray(parsed)) return parsed as RawFeishuRecord[];
  if (isRecordArrayWrapper(parsed)) return parsed.records;
  if (isFeishuApiWrapper(parsed)) return parsed.data.items;
  throw new Error("Source JSON must be an array, { records: [...] }, or Feishu API { data: { items: [...] } }.");
}

async function fetchRecordsFromFeishu(args: ParsedArgs): Promise<RawFeishuRecord[]> {
  if (!args.appToken || !args.tableId) {
    throw new Error("Missing Feishu config. Set FEISHU_MEMORY_APP_TOKEN and FEISHU_MEMORY_TABLE_ID, or pass --app and --table.");
  }

  const records: RawFeishuRecord[] = [];
  let pageToken = "";
  do {
    const tokenParam = pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : "";
    const apiPath = `/open-apis/bitable/v1/apps/${args.appToken}/tables/${args.tableId}/records?page_size=${args.pageSize}${tokenParam}`;
    const raw = await runLarkCliCommand(["api", "GET", apiPath, "--as", "user"], args.executable);
    const parsed = JSON.parse(raw) as FeishuListResponse;
    if (!isFeishuSuccess(parsed)) throw new Error(`Feishu API failed: ${raw}`);
    records.push(...(parsed.data?.items ?? []));
    pageToken = parsed.data?.page_token ?? "";
  } while (pageToken);
  return records;
}

function renderSchema(): string {
  return `# 飞书多维表格字段模板

| 字段名 | 用途 |
|---|---|
| ${FEISHU_MEMORY_FIELDS.title} | 知识标题 |
| ${FEISHU_MEMORY_FIELDS.summary} | AI 召回摘要 |
| ${FEISHU_MEMORY_FIELDS.bodyOrLink} | 正文、飞书文档链接或 runbook 路径 |
| ${FEISHU_MEMORY_FIELDS.knowledgeType} | 原则 / 项目知识 / 个人知识 |
| ${FEISHU_MEMORY_FIELDS.visibility} | 全策划 / 指定项目 / 仅本人 |
| ${FEISHU_MEMORY_FIELDS.project} | 项目代号；用于项目隔离 |
| ${FEISHU_MEMORY_FIELDS.tags} | 标签 |
| ${FEISHU_MEMORY_FIELDS.status} | 草稿 / 待审核 / 已批准 / 废弃 |
| ${FEISHU_MEMORY_FIELDS.sensitivity} | 普通内部 / 项目敏感 / 禁止同步 |
| ${FEISHU_MEMORY_FIELDS.submitter} | 提交人 |
| ${FEISHU_MEMORY_FIELDS.submittedAt} | 提交时间 |
| ${FEISHU_MEMORY_FIELDS.reviewer} | 项目知识维护人 |
| ${FEISHU_MEMORY_FIELDS.reviewedAt} | 审核时间 |
| ${FEISHU_MEMORY_FIELDS.reviewNote} | 审核意见 |
| ${FEISHU_MEMORY_FIELDS.owner} | 负责人 |
| ${FEISHU_MEMORY_FIELDS.source} | 来源 |
| ${FEISHU_MEMORY_FIELDS.updatedAt} | 最后更新 |
| ${FEISHU_MEMORY_FIELDS.syncToAi} | 是否同步给 AI |
`;
}

function printHelpAndExit(code: number): never {
  console.log(`Usage:
  npm run memory:sync:feishu -- --source fixtures/feishu-memory.sample.json --dry-run
  npm run memory:sync:feishu -- --app <base_token> --table <table_id> --project <project_code>
  npm run memory:sync:feishu -- --print-schema
`);
  process.exit(code);
}

interface FeishuListResponse {
  ok?: boolean;
  code?: number;
  data?: {
    items?: RawFeishuRecord[];
    page_token?: string;
  };
}

function isRecordArrayWrapper(value: unknown): value is { records: RawFeishuRecord[] } {
  return typeof value === "object" && value !== null && Array.isArray((value as { records?: unknown }).records);
}

function isFeishuApiWrapper(value: unknown): value is { data: { items: RawFeishuRecord[] } } {
  return typeof value === "object"
    && value !== null
    && typeof (value as { data?: unknown }).data === "object"
    && (value as { data?: unknown }).data !== null
    && Array.isArray(((value as { data: { items?: unknown } }).data).items);
}

function isFeishuSuccess(response: FeishuListResponse): boolean {
  if (typeof response.code === "number") return response.code === 0;
  if (typeof response.ok === "boolean") return response.ok;
  return Array.isArray(response.data?.items);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

