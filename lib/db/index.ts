/**
 * lib/db/index.ts
 * Singleton database connection using Node.js built-in node:sqlite.
 *
 * Usage (server-side only — API routes / server components):
 *   import { db } from '@/lib/db';
 *   const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
 *
 * Never import this in client components.
 */

// node:sqlite is built into Node.js 22+.
// The "experimental" warning is suppressed in production via --no-warnings flag
// (added to the start script). In dev you'll see it once on startup — harmless.
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { SCHEMA_SQL } from './schema';

const DB_PATH = process.env.DATABASE_PATH
  ?? path.join(process.cwd(), 'db', 'settlement_sam.db');

// Ensure the directory exists before opening
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Single shared connection — DatabaseSync is synchronous and safe for Next.js
// API routes (which run in separate Node.js worker processes in production).
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for better concurrent read performance and crash safety.
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA synchronous = NORMAL;');

// Run schema on every startup — CREATE TABLE IF NOT EXISTS is idempotent.
db.exec(SCHEMA_SQL);

export { db };

// ─── Typed helper row types ────────────────────────────────────────────────────

export interface DbLead {
  id:                  number;
  name:                string;
  phone:               string;
  email:               string | null;
  carrier:             string;
  state:               string | null;
  injury_type:         string;
  surgery:             number;
  hospitalized:        number;
  still_in_treatment:  number;
  missed_work:         number;
  missed_work_days:    number | null;
  lost_wages:          number;
  has_attorney:        number;
  insurance_contacted: number;
  incident_date:       string | null;
  estimate_low:        number;
  estimate_high:       number;
  score:               number;
  tier:                string;
  verified:            number;
  source:              string;
  timestamp:           number;
  delivered:           number;
  replaced:            number;
  disputed:            number;
  client_id:           number | null;
}

export interface DbVerificationCode {
  id:         number;
  phone:      string;
  code:       string;
  created_at: number;
  expires_at: number;
  attempts:   number;
  used:       number;
}

export interface DbClient {
  id:                 number;
  name:               string;
  firm:               string;
  email:              string;
  sheets_id:          string | null;
  leads_purchased:    number;
  leads_delivered:    number;
  leads_replaced:     number;
  balance:            number;
  stripe_customer_id: string | null;
  created_at:         number;
}

export interface DbSession {
  id:         number;
  token:      string;
  admin:      number;
  created_at: number;
  expires_at: number;
}

export interface DbDelivery {
  id:           number;
  lead_id:      number;
  client_id:    number;
  method:       string;
  delivered_at: number;
  status:       string;
}
