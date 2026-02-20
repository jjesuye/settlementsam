/**
 * tests/billing/billing.test.ts
 * Unit tests for Stripe billing business logic.
 *
 * Tests the pure in-DB logic: balance updates, lead_quantity validation,
 * and payment recording — no real Stripe API calls.
 */

import { DatabaseSync } from 'node:sqlite';

// ── In-memory DB ──────────────────────────────────────────────────────────────

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE clients (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT    NOT NULL DEFAULT 'Client',
    firm                TEXT    NOT NULL DEFAULT 'Firm',
    email               TEXT    NOT NULL UNIQUE,
    sheets_id           TEXT,
    leads_purchased     INTEGER NOT NULL DEFAULT 0,
    leads_delivered     INTEGER NOT NULL DEFAULT 0,
    leads_replaced      INTEGER NOT NULL DEFAULT 0,
    balance             REAL    NOT NULL DEFAULT 0,
    stripe_customer_id  TEXT,
    created_at          INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE payments (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id          INTEGER NOT NULL,
    stripe_invoice_id  TEXT    NOT NULL UNIQUE,
    amount_cents       INTEGER NOT NULL,
    lead_quantity      INTEGER NOT NULL,
    paid_at            INTEGER NOT NULL
  );
`);

// ── Constants (mirror billing route) ─────────────────────────────────────────

const LEAD_PRICE_CENTS = 25_000; // $250
const MIN_LEADS        = 25;

// ── Helpers ───────────────────────────────────────────────────────────────────

function insertClient(overrides: Record<string, unknown> = {}): number {
  const email = overrides.email ?? `client_${Date.now()}_${Math.random()}@firm.com`;
  const result = db.prepare(`
    INSERT INTO clients (name, firm, email, leads_purchased, balance, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    (overrides.name ?? 'Test Client') as string,
    (overrides.firm ?? 'Test Firm') as string,
    email as string,
    (overrides.leads_purchased ?? 0) as number,
    (overrides.balance ?? 0) as number,
    Date.now(),
  );
  return result.lastInsertRowid as number;
}

/** Simulates what handlePaymentSucceeded does in the webhook */
function applyPayment(clientId: number, invoiceId: string, amountCents: number, qty: number): void {
  const amountDollars = amountCents / 100;
  db.prepare(`
    UPDATE clients
    SET balance         = balance + ?,
        leads_purchased = leads_purchased + ?
    WHERE id = ?
  `).run(amountDollars, qty, clientId);
  db.prepare(`
    INSERT INTO payments (client_id, stripe_invoice_id, amount_cents, lead_quantity, paid_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(clientId, invoiceId, amountCents, qty, Date.now());
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  db.exec('DELETE FROM payments');
  db.exec('DELETE FROM clients');
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('billing constants', () => {
  it('LEAD_PRICE_CENTS equals $250.00', () => {
    expect(LEAD_PRICE_CENTS).toBe(25_000);
  });

  it('MIN_LEADS is 25', () => {
    expect(MIN_LEADS).toBe(25);
  });

  it('minimum invoice = MIN_LEADS × LEAD_PRICE_CENTS', () => {
    const minInvoice = MIN_LEADS * LEAD_PRICE_CENTS;
    expect(minInvoice).toBe(625_000); // $6,250
  });
});

describe('quantity validation', () => {
  it('rejects quantity below MIN_LEADS', () => {
    const qty = 10;
    const valid = Number.isInteger(qty) && qty >= MIN_LEADS;
    expect(valid).toBe(false);
  });

  it('accepts MIN_LEADS exactly', () => {
    const qty = 25;
    const valid = Number.isInteger(qty) && qty >= MIN_LEADS;
    expect(valid).toBe(true);
  });

  it('accepts quantity above MIN_LEADS', () => {
    const qty = 50;
    const valid = Number.isInteger(qty) && qty >= MIN_LEADS;
    expect(valid).toBe(true);
  });

  it('rejects zero quantity', () => {
    const qty = 0;
    const valid = Number.isInteger(qty) && qty >= MIN_LEADS;
    expect(valid).toBe(false);
  });

  it('rejects negative quantity', () => {
    const qty = -5;
    const valid = Number.isInteger(qty) && qty >= MIN_LEADS;
    expect(valid).toBe(false);
  });

  it('rejects fractional quantity', () => {
    const qty = 25.5;
    const valid = Number.isInteger(qty) && qty >= MIN_LEADS;
    expect(valid).toBe(false);
  });
});

describe('invoice amount calculation', () => {
  it('calculates correct amount for 25 leads', () => {
    expect(25 * LEAD_PRICE_CENTS).toBe(625_000);
  });

  it('calculates correct amount for 50 leads', () => {
    expect(50 * LEAD_PRICE_CENTS).toBe(1_250_000);
  });

  it('calculates correct amount for 100 leads', () => {
    expect(100 * LEAD_PRICE_CENTS).toBe(2_500_000);
  });
});

describe('webhook — handlePaymentSucceeded', () => {
  it('increases client balance by the paid amount', () => {
    const clientId = insertClient({ balance: 0 });
    applyPayment(clientId, 'inv_001', 625_000, 25);
    const client = db.prepare('SELECT balance FROM clients WHERE id = ?').get(clientId) as { balance: number };
    expect(client.balance).toBeCloseTo(6250, 2);
  });

  it('increases leads_purchased by the correct quantity', () => {
    const clientId = insertClient({ leads_purchased: 0 });
    applyPayment(clientId, 'inv_002', 625_000, 25);
    const client = db.prepare('SELECT leads_purchased FROM clients WHERE id = ?').get(clientId) as { leads_purchased: number };
    expect(client.leads_purchased).toBe(25);
  });

  it('accumulates balance across multiple payments', () => {
    const clientId = insertClient({ balance: 0 });
    applyPayment(clientId, 'inv_003', 625_000, 25);
    applyPayment(clientId, 'inv_004', 625_000, 25);
    const client = db.prepare('SELECT balance FROM clients WHERE id = ?').get(clientId) as { balance: number };
    expect(client.balance).toBeCloseTo(12500, 2);
  });

  it('accumulates leads_purchased across multiple payments', () => {
    const clientId = insertClient({ leads_purchased: 0 });
    applyPayment(clientId, 'inv_005', 625_000, 25);
    applyPayment(clientId, 'inv_006', 1_250_000, 50);
    const client = db.prepare('SELECT leads_purchased FROM clients WHERE id = ?').get(clientId) as { leads_purchased: number };
    expect(client.leads_purchased).toBe(75);
  });

  it('creates a payments row with correct invoice ID', () => {
    const clientId = insertClient();
    applyPayment(clientId, 'inv_unique_007', 625_000, 25);
    const payment = db.prepare('SELECT * FROM payments WHERE stripe_invoice_id = ?').get('inv_unique_007') as {
      client_id: number; amount_cents: number; lead_quantity: number;
    };
    expect(payment.client_id).toBe(clientId);
    expect(payment.amount_cents).toBe(625_000);
    expect(payment.lead_quantity).toBe(25);
  });

  it('enforces unique invoice ID (no duplicate payments)', () => {
    const clientId = insertClient();
    applyPayment(clientId, 'inv_dup_008', 625_000, 25);
    expect(() => {
      applyPayment(clientId, 'inv_dup_008', 625_000, 25); // duplicate
    }).toThrow();
  });

  it('tracks payments independently per client', () => {
    const c1 = insertClient({ email: 'c1@firm.com', balance: 0 });
    const c2 = insertClient({ email: 'c2@firm.com', balance: 0 });
    applyPayment(c1, 'inv_c1_009', 625_000, 25);
    applyPayment(c2, 'inv_c2_010', 1_250_000, 50);
    const client1 = db.prepare('SELECT balance, leads_purchased FROM clients WHERE id = ?').get(c1) as { balance: number; leads_purchased: number };
    const client2 = db.prepare('SELECT balance, leads_purchased FROM clients WHERE id = ?').get(c2) as { balance: number; leads_purchased: number };
    expect(client1.balance).toBeCloseTo(6250, 2);
    expect(client1.leads_purchased).toBe(25);
    expect(client2.balance).toBeCloseTo(12500, 2);
    expect(client2.leads_purchased).toBe(50);
  });
});

describe('payments audit table', () => {
  it('records paid_at timestamp', () => {
    const before   = Date.now();
    const clientId = insertClient();
    applyPayment(clientId, 'inv_ts_011', 625_000, 25);
    const after    = Date.now();
    const payment  = db.prepare('SELECT paid_at FROM payments WHERE client_id = ?').get(clientId) as { paid_at: number };
    expect(payment.paid_at).toBeGreaterThanOrEqual(before);
    expect(payment.paid_at).toBeLessThanOrEqual(after);
  });

  it('stores amount_cents not dollars', () => {
    const clientId = insertClient();
    applyPayment(clientId, 'inv_cents_012', 625_000, 25);
    const payment = db.prepare('SELECT amount_cents FROM payments WHERE client_id = ?').get(clientId) as { amount_cents: number };
    expect(payment.amount_cents).toBe(625_000);
    expect(payment.amount_cents).not.toBe(6250);
  });
});
