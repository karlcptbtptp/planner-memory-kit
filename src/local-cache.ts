import BetterSqlite3 from "better-sqlite3";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  contentForKnowledgeItem,
  knowledgeCategoryForScope,
  tagsForKnowledgeItem,
  type SharedKnowledgeItem,
} from "./feishu-sync-core.js";

export interface CacheWriteOptions {
  dbPath: string;
  markdownPath: string;
  project: string;
}

export interface CacheWriteResult {
  inserted: number;
  updated: number;
  archived: number;
  markdownPath: string;
  dbPath: string;
}

export function writeLocalCache(
  items: SharedKnowledgeItem[],
  markdown: string,
  options: CacheWriteOptions,
): CacheWriteResult {
  const markdownPath = resolve(options.markdownPath);
  const dbPath = resolve(options.dbPath);
  mkdirSync(dirname(markdownPath), { recursive: true });
  mkdirSync(dirname(dbPath), { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");

  const db = new BetterSqlite3(dbPath);
  ensureSchema(db);

  const sourcePrefix = `feishu-bitable:${options.project}:`;
  const activeSources = new Set(items.map((item) => `${sourcePrefix}${item.recordId}`));
  const existingSources = db
    .prepare("SELECT id, source FROM knowledge WHERE source LIKE ?")
    .all(`${sourcePrefix}%`) as Array<{ id: number; source: string }>;

  let inserted = 0;
  let updated = 0;
  let archived = 0;

  const transaction = db.transaction(() => {
    const findExisting = db.prepare("SELECT id FROM knowledge WHERE source = ? LIMIT 1");
    const insertStmt = db.prepare(`
      INSERT INTO knowledge (
        category, title, content, tags, status, quality_score, source, review_note, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 'accepted', 7, ?, 'synced from Feishu Bitable', datetime('now'), datetime('now'))
    `);
    const updateStmt = db.prepare(`
      UPDATE knowledge
      SET category = ?, title = ?, content = ?, tags = ?, status = 'accepted',
          quality_score = 7, review_note = 'refreshed from Feishu Bitable', updated_at = datetime('now')
      WHERE id = ?
    `);
    const archiveStmt = db.prepare(`
      UPDATE knowledge
      SET status = 'archived', review_note = 'not present in latest Feishu sync', updated_at = datetime('now')
      WHERE id = ?
    `);

    for (const item of items) {
      const source = `${sourcePrefix}${item.recordId}`;
      const existing = findExisting.get(source) as { id: number } | undefined;
      const params = [
        knowledgeCategoryForScope(item.scope),
        item.title,
        contentForKnowledgeItem(item),
        tagsForKnowledgeItem(item, options.project),
      ] as const;

      if (existing) {
        updateStmt.run(...params, existing.id);
        updated += 1;
      } else {
        insertStmt.run(...params, source);
        inserted += 1;
      }
    }

    for (const row of existingSources) {
      if (activeSources.has(row.source)) continue;
      archiveStmt.run(row.id);
      archived += 1;
    }
  });

  transaction();
  db.close();
  return { inserted, updated, archived, markdownPath, dbPath };
}

function ensureSchema(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'accepted',
      quality_score INTEGER NOT NULL DEFAULT 7,
      source TEXT NOT NULL UNIQUE,
      review_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

