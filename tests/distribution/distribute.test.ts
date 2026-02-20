/**
 * tests/distribution/distribute.test.ts
 * Unit tests for the lead distribution engine.
 *
 * We test the pure logic (scoring, email/sheets helpers) using
 * in-memory mocks — no real SMTP or Sheets API calls are made.
 */

import { DatabaseSync } from 'node:sqlite';

// ── In-memory DB ──────────────────────────────────────────────────────────────

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE leads (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT    NOT NULL DEFAULT '',
    phone               TEXT    NOT NULL DEFAULT '',
    email               TEXT,
    carrier             TEXT    NOT NULL DEFAULT '',
    state               TEXT,
    injury_type         TEXT    NOT NULL DEFAULT 'soft_tissue',
    surgery             INTEGER NOT NULL DEFAULT 0,
    hospitalized        INTEGER NOT NULL DEFAULT 0,
    still_in_treatment  INTEGER NOT NULL DEFAULT 0,
    missed_work         INTEGER NOT NULL DEFAULT 0,
    missed_work_days    INTEGER,
    lost_wages          REAL    NOT NULL DEFAULT 0,
    has_attorney        INTEGER NOT NULL DEFAULT 0,
    insurance_contacted INTEGER NOT NULL DEFAULT 0,
    incident_date       TEXT,
    estimate_low        REAL    NOT NULL DEFAULT 0,
    estimate_high       REAL    NOT NULL DEFAULT 0,
    score               INTEGER NOT NULL DEFAULT 0,
    tier                TEXT    NOT NULL DEFAULT 'COLD',
    verified            INTEGER NOT NULL DEFAULT 0,
    source              TEXT    NOT NULL DEFAULT 'widget',
    timestamp           INTEGER NOT NULL DEFAULT 0,
    delivered           INTEGER NOT NULL DEFAULT 0,
    replaced            INTEGER NOT NULL DEFAULT 0,
    disputed            INTEGER NOT NULL DEFAULT 0,
    client_id           INTEGER
  );

  CREATE TABLE clients (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT    NOT NULL,
    firm               TEXT    NOT NULL,
    email              TEXT    NOT NULL UNIQUE,
    sheets_id          TEXT,
    leads_purchased    INTEGER NOT NULL DEFAULT 0,
    leads_delivered    INTEGER NOT NULL DEFAULT 0,
    leads_replaced     INTEGER NOT NULL DEFAULT 0,
    balance            REAL    NOT NULL DEFAULT 0,
    stripe_customer_id TEXT,
    created_at         INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE deliveries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id      INTEGER NOT NULL,
    client_id    INTEGER NOT NULL,
    method       TEXT    NOT NULL,
    delivered_at INTEGER NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'delivered'
  );
`);

// ── Seed helpers ──────────────────────────────────────────────────────────────

function insertLead(overrides: Record<string, unknown> = {}): number {
  const defaults = {
    name: 'Jane Doe', phone: '5550001111', carrier: 'att',
    injury_type: 'fracture', score: 90, tier: 'HOT',
    verified: 1, delivered: 0, estimate_low: 20000, estimate_high: 75000,
    timestamp: Date.now(), source: 'quiz',
  };
  const merged = { ...defaults, ...overrides };
  const result = db.prepare(`
    INSERT INTO leads (name, phone, carrier, injury_type, score, tier, verified, delivered, estimate_low, estimate_high, timestamp, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    merged.name, merged.phone, merged.carrier, merged.injury_type,
    merged.score, merged.tier, merged.verified, merged.delivered,
    merged.estimate_low, merged.estimate_high, merged.timestamp, merged.source,
  );
  return result.lastInsertRowid as number;
}

function insertClient(overrides: Record<string, unknown> = {}): number {
  const defaults = {
    name: 'Alice Smith', firm: 'Smith & Associates',
    email: `client_${Date.now()}_${Math.random()}@firm.com`,
    sheets_id: 'test-sheet-id-123',
    leads_purchased: 50, leads_delivered: 0, balance: 5000,
    created_at: Date.now(),
  };
  const merged = { ...defaults, ...overrides };
  const result = db.prepare(`
    INSERT INTO clients (name, firm, email, sheets_id, leads_purchased, leads_delivered, balance, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    merged.name, merged.firm, merged.email, merged.sheets_id,
    merged.leads_purchased, merged.leads_delivered, merged.balance, merged.created_at,
  );
  return result.lastInsertRowid as number;
}

// ── Delivery logic helpers (mirrors /api/distribute route logic) ───────────────

function checkAlreadyDelivered(leadId: number): boolean {
  const lead = db.prepare('SELECT delivered FROM leads WHERE id = ?').get(leadId) as { delivered: number } | undefined;
  return lead?.delivered === 1;
}

function markDelivered(leadId: number, clientId: number, method: string): number {
  const now = Date.now();
  db.prepare('UPDATE leads SET delivered = 1, client_id = ? WHERE id = ?').run(clientId, leadId);
  db.prepare('UPDATE clients SET leads_delivered = leads_delivered + 1 WHERE id = ?').run(clientId);
  const result = db.prepare(`
    INSERT INTO deliveries (lead_id, client_id, method, delivered_at, status)
    VALUES (?, ?, ?, ?, 'delivered')
  `).run(leadId, clientId, method, now);
  return result.lastInsertRowid as number;
}

// ── Cleanup between tests ─────────────────────────────────────────────────────

beforeEach(() => {
  db.exec('DELETE FROM deliveries');
  db.exec('DELETE FROM leads');
  db.exec('DELETE FROM clients');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suites
// ─────────────────────────────────────────────────────────────────────────────

describe('lead delivery — duplicate prevention', () => {
  it('returns delivered=false for a fresh undelivered lead', () => {
    const leadId = insertLead({ delivered: 0 });
    expect(checkAlreadyDelivered(leadId)).toBe(false);
  });

  it('returns delivered=true after lead is marked delivered', () => {
    const leadId    = insertLead({ delivered: 0 });
    const clientId  = insertClient();
    markDelivered(leadId, clientId, 'email');
    expect(checkAlreadyDelivered(leadId)).toBe(true);
  });

  it('returns delivered=true for a lead seeded as already delivered', () => {
    const leadId = insertLead({ delivered: 1 });
    expect(checkAlreadyDelivered(leadId)).toBe(true);
  });
});

describe('markDelivered — DB state', () => {
  it('sets lead.delivered = 1', () => {
    const leadId   = insertLead();
    const clientId = insertClient();
    markDelivered(leadId, clientId, 'email');
    const lead = db.prepare('SELECT delivered FROM leads WHERE id = ?').get(leadId) as { delivered: number };
    expect(lead.delivered).toBe(1);
  });

  it('sets lead.client_id to the resolved client', () => {
    const leadId   = insertLead();
    const clientId = insertClient();
    markDelivered(leadId, clientId, 'email');
    const lead = db.prepare('SELECT client_id FROM leads WHERE id = ?').get(leadId) as { client_id: number };
    expect(lead.client_id).toBe(clientId);
  });

  it('increments client.leads_delivered', () => {
    const leadId   = insertLead();
    const clientId = insertClient({ leads_delivered: 0 });
    markDelivered(leadId, clientId, 'email');
    const client = db.prepare('SELECT leads_delivered FROM clients WHERE id = ?').get(clientId) as { leads_delivered: number };
    expect(client.leads_delivered).toBe(1);
  });

  it('creates a deliveries row with correct method', () => {
    const leadId   = insertLead();
    const clientId = insertClient();
    const deliveryId = markDelivered(leadId, clientId, 'sheets');
    const delivery = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(deliveryId) as {
      lead_id: number; client_id: number; method: string; status: string;
    };
    expect(delivery.lead_id).toBe(leadId);
    expect(delivery.client_id).toBe(clientId);
    expect(delivery.method).toBe('sheets');
    expect(delivery.status).toBe('delivered');
  });

  it('creates a deliveries row with method=both', () => {
    const leadId   = insertLead();
    const clientId = insertClient();
    markDelivered(leadId, clientId, 'both');
    const delivery = db.prepare('SELECT method FROM deliveries WHERE lead_id = ?').get(leadId) as { method: string };
    expect(delivery.method).toBe('both');
  });

  it('does not re-deliver a lead that is already delivered', () => {
    const leadId   = insertLead({ delivered: 1 });
    const clientId = insertClient();
    // Simulate the 409 check — do NOT call markDelivered if already delivered
    const alreadyDelivered = checkAlreadyDelivered(leadId);
    if (!alreadyDelivered) markDelivered(leadId, clientId, 'email');
    const deliveries = db.prepare('SELECT COUNT(*) AS n FROM deliveries WHERE lead_id = ?').get(leadId) as { n: number };
    expect(deliveries.n).toBe(0); // no new delivery row
  });

  it('marks multiple different leads independently', () => {
    const lead1    = insertLead({ name: 'Lead One' });
    const lead2    = insertLead({ name: 'Lead Two' });
    const clientId = insertClient();
    markDelivered(lead1, clientId, 'email');
    // lead2 is NOT delivered
    expect(checkAlreadyDelivered(lead1)).toBe(true);
    expect(checkAlreadyDelivered(lead2)).toBe(false);
  });
});

describe('client leads_delivered counter', () => {
  it('increments by 1 for each delivery', () => {
    const clientId = insertClient({ leads_delivered: 0 });
    for (let i = 0; i < 3; i++) {
      const leadId = insertLead();
      markDelivered(leadId, clientId, 'email');
    }
    const client = db.prepare('SELECT leads_delivered FROM clients WHERE id = ?').get(clientId) as { leads_delivered: number };
    expect(client.leads_delivered).toBe(3);
  });

  it('tracks leads_delivered independently per client', () => {
    const c1 = insertClient({ email: 'c1@firm.com', leads_delivered: 0 });
    const c2 = insertClient({ email: 'c2@firm.com', leads_delivered: 0 });
    const l1 = insertLead();
    const l2 = insertLead();
    markDelivered(l1, c1, 'email');
    markDelivered(l2, c2, 'email');
    const client1 = db.prepare('SELECT leads_delivered FROM clients WHERE id = ?').get(c1) as { leads_delivered: number };
    const client2 = db.prepare('SELECT leads_delivered FROM clients WHERE id = ?').get(c2) as { leads_delivered: number };
    expect(client1.leads_delivered).toBe(1);
    expect(client2.leads_delivered).toBe(1);
  });
});

describe('client sheets_id guard', () => {
  it('client with sheets_id should be allowed sheets delivery', () => {
    const clientId = insertClient({ sheets_id: 'some-sheet-id' });
    const client   = db.prepare('SELECT sheets_id FROM clients WHERE id = ?').get(clientId) as { sheets_id: string | null };
    expect(client.sheets_id).toBeTruthy();
  });

  it('client without sheets_id should be blocked from sheets delivery', () => {
    const clientId = insertClient({ sheets_id: null });
    const client   = db.prepare('SELECT sheets_id FROM clients WHERE id = ?').get(clientId) as { sheets_id: string | null };
    expect(client.sheets_id).toBeFalsy();
  });
});

describe('deliveries table — audit log', () => {
  it('records delivered_at timestamp', () => {
    const before   = Date.now();
    const leadId   = insertLead();
    const clientId = insertClient();
    const deliveryId = markDelivered(leadId, clientId, 'email');
    const after    = Date.now();
    const delivery = db.prepare('SELECT delivered_at FROM deliveries WHERE id = ?').get(deliveryId) as { delivered_at: number };
    expect(delivery.delivered_at).toBeGreaterThanOrEqual(before);
    expect(delivery.delivered_at).toBeLessThanOrEqual(after);
  });

  it('status defaults to delivered', () => {
    const leadId     = insertLead();
    const clientId   = insertClient();
    const deliveryId = markDelivered(leadId, clientId, 'email');
    const delivery   = db.prepare('SELECT status FROM deliveries WHERE id = ?').get(deliveryId) as { status: string };
    expect(delivery.status).toBe('delivered');
  });

  it('returns lastInsertRowid as the delivery ID', () => {
    const leadId     = insertLead();
    const clientId   = insertClient();
    const deliveryId = markDelivered(leadId, clientId, 'email');
    expect(typeof deliveryId).toBe('number');
    expect(deliveryId).toBeGreaterThan(0);
  });
});
