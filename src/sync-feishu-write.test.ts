#!/usr/bin/env tsx

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const tempDir = mkdtempSync(join(tmpdir(), "planner-memory-kit-"));
const dbPath = join(tempDir, "memory.sqlite");
const outputPath = join(tempDir, "feishu-memory.md");

try {
  const sync = spawnSync(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "src/sync-feishu.ts",
      "--source",
      "fixtures/feishu-memory.sample.json",
      "--project",
      "giftWeb",
      "--output",
      outputPath,
      "--db",
      dbPath,
    ],
    { cwd: root, encoding: "utf8" },
  );

  assert.equal(sync.status, 0, sync.stderr || sync.stdout);
  assert.ok(existsSync(outputPath), "expected markdown cache");
  assert.ok(existsSync(dbPath), "expected SQLite cache");

  const markdown = readFileSync(outputPath, "utf8");
  assert.match(markdown, /数据分析先确认正式口径/);
  assert.match(markdown, /能量房经济分析看完整资金流/);
  assert.doesNotMatch(markdown, /草稿不会进入 AI 缓存/);

  console.log("sync-feishu write tests passed");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

