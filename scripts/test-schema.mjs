/**
 * Quick schema smoke-test — runs without TypeScript compilation.
 * Usage: node --experimental-sqlite --no-warnings scripts/test-schema.mjs
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = './db/test_migration.db';

// Clean start
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA synchronous = NORMAL;');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS leads (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT    NOT NULL,
  phone               TEXT    NOT NULL,
  email               TEXT,
  carrier             TEXT    NOT NULL,
  state               TEXT,
  injury_type         TEXT    NOT NULL,
  surgery             INTEGER NOT NULL DEFAULT 0,
  hospitalized        INTEGER NOT NULL DEFAULT 0,
  still_in_treatment  INTEGER NOT NULL DEFAULT 0,
  missed_work         INTEGER NOT NULL DEFAULT 0,
  missed_work_days    INTEGER,
  lost_wages          INTEGER NOT NULL DEFAULT 0,
  has_attorney        INTEGER NOT NULL DEFAULT 0,
  insurance_contacted INTEGER NOT NULL DEFAULT 0,
  incident_date       TEXT,
  estimate_low        INTEGER NOT NULL DEFAULT 0,
  estimate_high       INTEGER NOT NULL DEFAULT 0,
  score               INTEGER NOT NULL DEFAULT 0,
  tier                TEXT    NOT NULL DEFAULT 'COLD',
  verified            INTEGER NOT NULL DEFAULT 0,
  source              TEXT    NOT NULL DEFAULT 'widget',
  timestamp           INTEGER NOT NULL,
  delivered           INTEGER NOT NULL DEFAULT 0,
  replaced            INTEGER NOT NULL DEFAULT 0,
  disputed            INTEGER NOT NULL DEFAULT 0,
  client_id           INTEGER REFERENCES clients(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_phone     ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_tier      ON leads(tier);
CREATE INDEX IF NOT EXISTS idx_leads_verified  ON leads(verified);
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id);
CREATE INDEX IF NOT EXISTS idx_leads_timestamp ON leads(timestamp);

CREATE TABLE IF NOT EXISTS verification_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  phone      TEXT    NOT NULL,
  code       TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  used       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_vcodes_phone ON verification_codes(phone);

CREATE TABLE IF NOT EXISTS clients (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT    NOT NULL,
  firm               TEXT    NOT NULL,
  email              TEXT    NOT NULL UNIQUE,
  sheets_id          TEXT,
  leads_purchased    INTEGER NOT NULL DEFAULT 0,
  leads_delivered    INTEGER NOT NULL DEFAULT 0,
  leads_replaced     INTEGER NOT NULL DEFAULT 0,
  balance            INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT,
  created_at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token      TEXT    NOT NULL UNIQUE,
  admin      INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

CREATE TABLE IF NOT EXISTS deliveries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id      INTEGER NOT NULL REFERENCES leads(id),
  client_id    INTEGER NOT NULL REFERENCES clients(id),
  method       TEXT    NOT NULL DEFAULT 'email',
  delivered_at INTEGER NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'delivered'
);
CREATE INDEX IF NOT EXISTS idx_deliveries_lead_id   ON deliveries(lead_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_client_id ON deliveries(client_id);
`;

db.exec(SCHEMA_SQL);

// ── Verify tables ──────────────────────────────────────────────────────────────
const expected = ['leads', 'verification_codes', 'clients', 'sessions', 'deliveries'];
const rows = db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
  .all();
const found = rows.map(r => r.name);
const missing = expected.filter(t => !found.includes(t));

if (missing.length > 0) {
  console.error('FAIL — missing tables:', missing.join(', '));
  process.exit(1);
}
console.log('✓ Tables:', found.join(', '));

// ── Insert + read a test lead ──────────────────────────────────────────────────
db.prepare(`
  INSERT INTO leads (name, phone, carrier, injury_type, timestamp)
  VALUES (?, ?, ?, ?, ?)
`).run('Test User', '5550001234', 'vtext.com', 'soft_tissue', Date.now());

const lead = db.prepare('SELECT * FROM leads WHERE phone = ?').get('5550001234');
console.assert(lead.name === 'Test User', 'Lead name mismatch');
console.assert(lead.tier === 'COLD', 'Default tier mismatch');
console.assert(lead.score === 0, 'Default score mismatch');
console.log('✓ Lead insert/read OK');

// ── Verify code insert ────────────────────────────────────────────────────────
db.prepare(`
  INSERT INTO verification_codes (phone, code, created_at, expires_at)
  VALUES (?, ?, ?, ?)
`).run('5550001234', '4242', Date.now(), Date.now() + 600_000);

const code = db.prepare(
  'SELECT * FROM verification_codes WHERE phone = ?'
).get('5550001234');
console.assert(code.code === '4242', 'Code mismatch');
console.log('✓ Verification code insert/read OK');

// ── Client insert ─────────────────────────────────────────────────────────────
db.prepare(`
  INSERT INTO clients (name, firm, email, created_at)
  VALUES (?, ?, ?, ?)
`).run('Jane Smith', 'Smith & Associates', 'jane@smithlaw.com', Date.now());

const client = db.prepare('SELECT * FROM clients WHERE email = ?').get('jane@smithlaw.com');
console.assert(client.firm === 'Smith & Associates', 'Client firm mismatch');
console.log('✓ Client insert/read OK');

// ── Delivery insert (with FK) ─────────────────────────────────────────────────
db.prepare(`
  INSERT INTO deliveries (lead_id, client_id, delivered_at)
  VALUES (?, ?, ?)
`).run(lead.id, client.id, Date.now());

const delivery = db.prepare('SELECT * FROM deliveries WHERE lead_id = ?').get(lead.id);
console.assert(delivery.status === 'delivered', 'Default delivery status mismatch');
console.log('✓ Delivery insert/read OK');

// Cleanup
db.close();
fs.unlinkSync(DB_PATH);
console.log('\n✅ Schema test PASSED — all 5 tables created and validated.');
