/**
 * tests/admin/login.test.ts
 * Unit tests for admin brute-force logic and bcrypt helpers.
 */

import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

// ── In-memory DB (no mock needed — test directly against the logic) ────────────

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE login_attempts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier   TEXT    NOT NULL,
    attempted_at INTEGER NOT NULL,
    success      INTEGER NOT NULL DEFAULT 0
  );
`);

// ── Constants (mirror login route) ───────────────────────────────────────────

const LOCKOUT_MS   = 15 * 60 * 1_000;
const MAX_ATTEMPTS = 5;

// ── Helpers (pure functions, no HTTP involved) ───────────────────────────────

function recordAttempt(identifier: string, success: boolean) {
  db.prepare(
    'INSERT INTO login_attempts (identifier, attempted_at, success) VALUES (?, ?, ?)',
  ).run(identifier, Date.now(), success ? 1 : 0);
}

function getFailCount(identifier: string): number {
  const windowStart = Date.now() - LOCKOUT_MS;
  return (db
    .prepare(`SELECT COUNT(*) AS n FROM login_attempts
              WHERE identifier = ? AND attempted_at > ? AND success = 0`)
    .get(identifier, windowStart) as { n: number }).n;
}

function isLocked(identifier: string): boolean {
  return getFailCount(identifier) >= MAX_ATTEMPTS;
}

beforeEach(() => db.exec('DELETE FROM login_attempts'));

// ── bcrypt ────────────────────────────────────────────────────────────────────

describe('bcrypt helpers', () => {
  it('generates a valid hash and verifies it', async () => {
    const hash  = await bcrypt.hash('my-secure-password-123', 10);
    const valid = await bcrypt.compare('my-secure-password-123', hash);
    expect(valid).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash  = await bcrypt.hash('correct-horse-battery', 10);
    const valid = await bcrypt.compare('wrong-password', hash);
    expect(valid).toBe(false);
  });

  it('different plaintexts produce different hashes', async () => {
    const h1 = await bcrypt.hash('password1', 10);
    const h2 = await bcrypt.hash('password2', 10);
    expect(h1).not.toBe(h2);
  });
});

// ── Brute-force logic ─────────────────────────────────────────────────────────

describe('login_attempts brute-force logic', () => {
  const id  = 'admin@sam.com::127.0.0.1';
  const id2 = 'other@sam.com::10.0.0.1';

  it('starts with zero failures for a fresh identifier', () => {
    expect(getFailCount(id)).toBe(0);
  });

  it('is not locked on zero failures', () => {
    expect(isLocked(id)).toBe(false);
  });

  it('accumulates failed attempts', () => {
    recordAttempt(id, false);
    recordAttempt(id, false);
    expect(getFailCount(id)).toBe(2);
  });

  it('does not count successful attempts as failures', () => {
    recordAttempt(id, false);
    recordAttempt(id, true);
    expect(getFailCount(id)).toBe(1);
  });

  it('is not locked below threshold', () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) recordAttempt(id, false);
    expect(isLocked(id)).toBe(false);
  });

  it('locks exactly at MAX_ATTEMPTS failures', () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordAttempt(id, false);
    expect(isLocked(id)).toBe(true);
  });

  it('locks at MAX_ATTEMPTS + 1 failures', () => {
    for (let i = 0; i < MAX_ATTEMPTS + 1; i++) recordAttempt(id, false);
    expect(isLocked(id)).toBe(true);
  });

  it('different identifiers are independently tracked', () => {
    recordAttempt(id,  false);
    recordAttempt(id,  false);
    recordAttempt(id2, false);

    expect(getFailCount(id)).toBe(2);
    expect(getFailCount(id2)).toBe(1);
  });

  it('a success after failures does not unlock account (failures remain)', () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordAttempt(id, false);
    recordAttempt(id, true); // success
    // Failures are still counted — account stays locked
    expect(isLocked(id)).toBe(true);
  });
});
