/**
 * schema.ts
 * All CREATE TABLE and CREATE INDEX statements for Settlement Sam.
 * Exported as a single SQL string so migrate.ts can run it once.
 *
 * Tables:
 *   leads              – every verified lead (widget or quiz source)
 *   verification_codes – SMS OTP codes with expiry + rate-limit tracking
 *   clients            – PI law firm buyer accounts
 *   sessions           – admin JWT session records
 *   deliveries         – lead-to-client delivery audit log
 */

export const SCHEMA_SQL = /* sql */ `

-- ─── leads ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  -- identity
  name                TEXT    NOT NULL,
  phone               TEXT    NOT NULL,
  email               TEXT,
  carrier             TEXT    NOT NULL,
  state               TEXT,
  -- injury details (widget + quiz)
  injury_type         TEXT    NOT NULL,  -- soft_tissue | fracture | tbi | spinal | motor_vehicle | slip_fall | workplace | med_mal | other
  surgery             INTEGER NOT NULL DEFAULT 0,   -- 0/1 boolean
  hospitalized        INTEGER NOT NULL DEFAULT 0,
  still_in_treatment  INTEGER NOT NULL DEFAULT 0,
  missed_work         INTEGER NOT NULL DEFAULT 0,
  missed_work_days    INTEGER,
  lost_wages          INTEGER NOT NULL DEFAULT 0,   -- dollars
  has_attorney        INTEGER NOT NULL DEFAULT 0,
  insurance_contacted INTEGER NOT NULL DEFAULT 0,
  incident_date       TEXT,                          -- ISO date string
  -- estimates
  estimate_low        INTEGER NOT NULL DEFAULT 0,
  estimate_high       INTEGER NOT NULL DEFAULT 0,
  -- scoring
  score               INTEGER NOT NULL DEFAULT 0,
  tier                TEXT    NOT NULL DEFAULT 'COLD', -- HOT | WARM | COLD
  -- lifecycle
  verified            INTEGER NOT NULL DEFAULT 0,
  source              TEXT    NOT NULL DEFAULT 'widget', -- widget | quiz
  timestamp           INTEGER NOT NULL,
  delivered           INTEGER NOT NULL DEFAULT 0,
  replaced            INTEGER NOT NULL DEFAULT 0,
  disputed            INTEGER NOT NULL DEFAULT 0,
  -- assignment
  client_id           INTEGER REFERENCES clients(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_phone     ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_tier      ON leads(tier);
CREATE INDEX IF NOT EXISTS idx_leads_verified  ON leads(verified);
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id);
CREATE INDEX IF NOT EXISTS idx_leads_timestamp ON leads(timestamp);

-- ─── verification_codes ───────────────────────────────────────────────────────
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

-- ─── clients ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL,
  firm              TEXT    NOT NULL,
  email             TEXT    NOT NULL UNIQUE,
  sheets_id         TEXT,                          -- Google Sheets spreadsheet ID
  leads_purchased   INTEGER NOT NULL DEFAULT 0,
  leads_delivered   INTEGER NOT NULL DEFAULT 0,
  leads_replaced    INTEGER NOT NULL DEFAULT 0,
  balance           INTEGER NOT NULL DEFAULT 0,    -- prepaid credit (cents)
  stripe_customer_id TEXT,
  created_at        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- ─── sessions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token      TEXT    NOT NULL UNIQUE,
  admin      INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- ─── login_attempts ───────────────────────────────────────────────────────────
-- Brute-force protection: tracks failed admin login attempts per IP/email.
CREATE TABLE IF NOT EXISTS login_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT    NOT NULL,   -- email or IP used in attempt
  attempted_at INTEGER NOT NULL,
  success    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier);
CREATE INDEX IF NOT EXISTS idx_login_attempts_at         ON login_attempts(attempted_at);

-- ─── deliveries ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliveries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id      INTEGER NOT NULL REFERENCES leads(id),
  client_id    INTEGER NOT NULL REFERENCES clients(id),
  method       TEXT    NOT NULL DEFAULT 'email',  -- email | sheets | both
  delivered_at INTEGER NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'delivered' -- delivered | failed | disputed | replaced
);

CREATE INDEX IF NOT EXISTS idx_deliveries_lead_id   ON deliveries(lead_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_client_id ON deliveries(client_id);

-- ─── payments ─────────────────────────────────────────────────────────────────
-- Records every successful Stripe payment (invoice.payment_succeeded webhook).
CREATE TABLE IF NOT EXISTS payments (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id          INTEGER NOT NULL REFERENCES clients(id),
  stripe_invoice_id  TEXT    NOT NULL UNIQUE,
  amount_cents       INTEGER NOT NULL,   -- amount paid in cents
  lead_quantity      INTEGER NOT NULL,   -- number of leads purchased
  paid_at            INTEGER NOT NULL    -- Unix ms
);

CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
`;
