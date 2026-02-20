/**
 * lib/db/migrate.ts
 * Standalone migration runner. Can be called from the command line:
 *   node --experimental-sqlite -r ts-node/register lib/db/migrate.ts
 *
 * Also auto-runs on every server startup via lib/db/index.ts, but this
 * script is useful for one-off checks, inspecting the schema, or CI.
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { SCHEMA_SQL } from './schema';

const DB_PATH = process.env.DATABASE_PATH
  ?? path.join(process.cwd(), 'db', 'settlement_sam.db');

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`[migrate] Opening database: ${DB_PATH}`);
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

console.log('[migrate] Running schema…');
db.exec(SCHEMA_SQL);

// Verify all expected tables exist
const expectedTables = ['leads', 'verification_codes', 'clients', 'sessions', 'login_attempts', 'deliveries', 'payments'];
const rows = db
  .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
  .all() as { name: string }[];

const found = rows.map(r => r.name);
const missing = expectedTables.filter(t => !found.includes(t));

if (missing.length > 0) {
  console.error(`[migrate] FAIL — missing tables: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`[migrate] OK — tables: ${found.join(', ')}`);
console.log('[migrate] Schema migration complete.');
