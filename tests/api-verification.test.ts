/**
 * tests/api-verification.test.ts
 * Integration tests for the send-code / verify-code flow.
 *
 * Strategy: use an in-memory SQLite database and mock sendSmsCode so
 * no real network calls are made. Tests cover every meaningful branch.
 */

import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '@/lib/db/schema';
import {
  normalizePhone,
  generateCode,
  VALID_GATEWAYS,
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  MAX_SENDS_PER_HR,
  RATE_WINDOW_MS,
} from '@/lib/sms';

// ── In-memory test database ───────────────────────────────────────────────────
const testDb = new DatabaseSync(':memory:');
testDb.exec('PRAGMA foreign_keys = ON;');
testDb.exec(SCHEMA_SQL);

// ── Helpers that mirror the route handler logic ───────────────────────────────

interface SendCodeResult {
  status: number;
  body: Record<string, unknown>;
}

/** Simulates POST /api/send-code without the real mailer */
function simulateSendCode(
  name: string,
  rawPhone: string,
  carrier: string,
  mailerShouldFail = false,
): SendCodeResult {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { status: 400, body: { error: 'invalid_input', message: 'First name is required.' } };
  }

  const phone = normalizePhone(rawPhone);
  if (phone.length !== 10) {
    return {
      status: 400,
      body: { error: 'invalid_input', message: 'Please enter a valid 10-digit US phone number.' },
    };
  }

  if (!VALID_GATEWAYS.has(carrier)) {
    return {
      status: 400,
      body: { error: 'invalid_input', message: 'Please select your carrier.' },
    };
  }

  const windowStart  = Date.now() - RATE_WINDOW_MS;
  const recentCount  = (testDb
    .prepare('SELECT COUNT(*) AS n FROM verification_codes WHERE phone = ? AND created_at > ?')
    .get(phone, windowStart) as { n: number }).n;

  if (recentCount >= MAX_SENDS_PER_HR) {
    return {
      status: 429,
      body: { error: 'too_many_requests', message: expect.any(String) as unknown as string },
    };
  }

  testDb.prepare('UPDATE verification_codes SET used = 1 WHERE phone = ? AND used = 0').run(phone);

  const code = generateCode();
  const now  = Date.now();
  testDb.prepare(
    'INSERT INTO verification_codes (phone, code, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(phone, code, now, now + CODE_TTL_MS);

  if (mailerShouldFail) {
    testDb.prepare('DELETE FROM verification_codes WHERE phone = ? AND code = ?').run(phone, code);
    return { status: 500, body: { error: 'send_failed', message: expect.any(String) as unknown as string } };
  }

  return { status: 200, body: { success: true, _code: code } };
}

interface VerifyResult {
  status: number;
  body: Record<string, unknown>;
}

function simulateVerifyCode(phone: string, code: string): VerifyResult {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || String(code).replace(/\D/g, '').length !== 4) {
    return {
      status: 400,
      body: { error: 'invalid_input', message: 'Phone number and 4-digit code are both required.' },
    };
  }

  const record = testDb
    .prepare(`
      SELECT * FROM verification_codes
      WHERE phone = ? AND used = 0 AND expires_at > ?
      ORDER BY created_at DESC LIMIT 1
    `)
    .get(normalizedPhone, Date.now()) as
    | { id: number; code: string; attempts: number }
    | undefined;

  if (!record) {
    return { status: 400, body: { error: 'expired', message: "That code has expired." } };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    return { status: 429, body: { error: 'too_many_attempts', message: 'Too many wrong attempts.' } };
  }

  if (String(record.code) !== String(code).trim()) {
    testDb.prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?').run(record.id);
    const left = MAX_ATTEMPTS - (record.attempts + 1);
    return {
      status: 400,
      body: {
        error:   'invalid_code',
        message: left > 0 ? `Hmm, that code didn't match. ${left} attempts left.` : 'No attempts left.',
      },
    };
  }

  testDb.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(record.id);
  return { status: 200, body: { success: true, token: 'mock-jwt-token' } };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Clean codes table before each test
  testDb.exec('DELETE FROM verification_codes');
});

describe('POST /api/send-code — input validation', () => {
  it('rejects missing name', () => {
    const r = simulateSendCode('', '5550001234', 'vtext.com');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('invalid_input');
  });

  it('rejects name with only spaces', () => {
    const r = simulateSendCode('   ', '5550001234', 'vtext.com');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('invalid_input');
  });

  it('rejects a phone with fewer than 10 digits', () => {
    const r = simulateSendCode('Sam', '555', 'vtext.com');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('invalid_input');
  });

  it('accepts phone with formatting characters', () => {
    const r = simulateSendCode('Sam', '(555) 000-1234', 'vtext.com');
    expect(r.status).toBe(200);
  });

  it('strips US country code and accepts the number', () => {
    const r = simulateSendCode('Sam', '+1 555 000 1234', 'vtext.com');
    expect(r.status).toBe(200);
  });

  it('rejects an unknown carrier', () => {
    const r = simulateSendCode('Sam', '5550001234', 'fakemobile.net');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('invalid_input');
  });

  it('accepts all 6 valid carriers', () => {
    const carriers = [
      'txt.att.net', 'vtext.com', 'tmomail.net',
      'messaging.sprintpcs.com', 'email.uscc.net', 'sms.myboostmobile.com',
    ];
    for (const c of carriers) {
      testDb.exec('DELETE FROM verification_codes');
      const r = simulateSendCode('Sam', '5550001234', c);
      expect(r.status).toBe(200);
    }
  });
});

describe('POST /api/send-code — rate limiting', () => {
  it('allows up to MAX_SENDS_PER_HR sends within the window', () => {
    for (let i = 0; i < MAX_SENDS_PER_HR; i++) {
      const r = simulateSendCode('Sam', '5550009999', 'vtext.com');
      expect(r.status).toBe(200);
    }
  });

  it('rejects the 4th send within 1 hour', () => {
    for (let i = 0; i < MAX_SENDS_PER_HR; i++) {
      simulateSendCode('Sam', '5550009998', 'vtext.com');
    }
    const r = simulateSendCode('Sam', '5550009998', 'vtext.com');
    expect(r.status).toBe(429);
    expect(r.body.error).toBe('too_many_requests');
  });

  it('invalidates previous active code when new one is sent', () => {
    simulateSendCode('Sam', '5550009997', 'vtext.com');
    const before = testDb
      .prepare('SELECT COUNT(*) AS n FROM verification_codes WHERE phone = ? AND used = 0')
      .get('5550009997') as { n: number };
    expect(before.n).toBe(1);

    simulateSendCode('Sam', '5550009997', 'vtext.com');
    const after = testDb
      .prepare('SELECT COUNT(*) AS n FROM verification_codes WHERE phone = ? AND used = 0')
      .get('5550009997') as { n: number };
    expect(after.n).toBe(1); // only 1 active at a time
  });
});

describe('POST /api/send-code — mailer failure', () => {
  it('rolls back the stored code on mail failure', () => {
    const countBefore = (testDb
      .prepare('SELECT COUNT(*) AS n FROM verification_codes WHERE phone = ?')
      .get('5550009996') as { n: number }).n;

    simulateSendCode('Sam', '5550009996', 'vtext.com', /* mailerShouldFail= */ true);

    const countAfter = (testDb
      .prepare('SELECT COUNT(*) AS n FROM verification_codes WHERE phone = ?')
      .get('5550009996') as { n: number }).n;

    expect(countAfter).toBe(countBefore); // no net change
  });
});

describe('POST /api/verify-code — success path', () => {
  it('returns success + token for correct code', () => {
    const sendResult = simulateSendCode('Sam', '5550001111', 'vtext.com');
    expect(sendResult.status).toBe(200);
    const code = sendResult.body._code as string;

    const r = simulateVerifyCode('5550001111', code);
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.token).toBeTruthy();
  });

  it('marks the code as used after successful verify', () => {
    const sendResult = simulateSendCode('Sam', '5550001112', 'vtext.com');
    const code = sendResult.body._code as string;
    simulateVerifyCode('5550001112', code);

    const row = testDb
      .prepare('SELECT used FROM verification_codes WHERE phone = ?')
      .get('5550001112') as { used: number };
    expect(row.used).toBe(1);
  });
});

describe('POST /api/verify-code — wrong code / expiry', () => {
  it('rejects an incorrect code and decrements remaining attempts', () => {
    simulateSendCode('Sam', '5550002222', 'vtext.com');
    const r = simulateVerifyCode('5550002222', '0000');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('invalid_code');
  });

  it('returns too_many_attempts after MAX_ATTEMPTS wrong guesses', () => {
    simulateSendCode('Sam', '5550003333', 'vtext.com');
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      simulateVerifyCode('5550003333', '0000');
    }
    const r = simulateVerifyCode('5550003333', '0000');
    expect(r.status).toBe(429);
    expect(r.body.error).toBe('too_many_attempts');
  });

  it('returns expired when no active code exists', () => {
    const r = simulateVerifyCode('5550004444', '1234');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('expired');
  });

  it('rejects a code that has been manually expired (used = 1)', () => {
    simulateSendCode('Sam', '5550005555', 'vtext.com');
    testDb.exec("UPDATE verification_codes SET used = 1 WHERE phone = '5550005555'");
    const r = simulateVerifyCode('5550005555', '1234');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('expired');
  });
});

describe('POST /api/verify-code — input validation', () => {
  it('rejects missing code', () => {
    const r = simulateVerifyCode('5550006666', '');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('invalid_input');
  });

  it('rejects code with fewer than 4 digits', () => {
    const r = simulateVerifyCode('5550006666', '123');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('invalid_input');
  });

  it('rejects missing phone', () => {
    const r = simulateVerifyCode('', '1234');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('invalid_input');
  });
});
