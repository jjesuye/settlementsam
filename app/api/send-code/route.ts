/**
 * POST /api/send-code
 *
 * Accepts { name, phone, carrier }
 * Validates inputs, enforces hourly rate limit, generates a 4-digit OTP,
 * stores it in SQLite, and sends it to the phone via carrier email-to-SMS.
 *
 * Response 200: { success: true }
 * Response 400: { error: string, message: string }
 * Response 429: { error: 'too_many_requests', message: string }
 * Response 500: { error: 'send_failed', message: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  normalizePhone,
  generateCode,
  sendSmsCode,
  sendSmsCodeMulti,
  VALID_GATEWAYS,
  MULTI_BLAST_SENTINEL,
  CODE_TTL_MS,
  RATE_WINDOW_MS,
  MAX_SENDS_PER_HR,
} from '@/lib/sms';

export async function POST(req: NextRequest) {
  let body: { name?: unknown; phone?: unknown; carrier?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  const { name: rawName, phone: rawPhone, carrier } = body;

  // ── Input validation ────────────────────────────────────────────────────────
  const name = String(rawName ?? '').trim();
  if (name.length < 1) {
    return NextResponse.json(
      { error: 'invalid_input', message: 'First name is required.' },
      { status: 400 },
    );
  }

  const phone = normalizePhone(String(rawPhone ?? ''));
  if (phone.length !== 10) {
    return NextResponse.json(
      { error: 'invalid_input', message: 'Please enter a valid 10-digit US phone number.' },
      { status: 400 },
    );
  }

  if (!carrier || !VALID_GATEWAYS.has(String(carrier))) {
    return NextResponse.json(
      { error: 'invalid_input', message: 'Please select your carrier.' },
      { status: 400 },
    );
  }

  // ── Rate limiting: max 3 sends per phone per hour ───────────────────────────
  const windowStart = Date.now() - RATE_WINDOW_MS;
  const recentCount = (db
    .prepare('SELECT COUNT(*) AS n FROM verification_codes WHERE phone = ? AND created_at > ?')
    .get(phone, windowStart) as { n: number }).n;

  if (recentCount >= MAX_SENDS_PER_HR) {
    return NextResponse.json(
      {
        error:   'too_many_requests',
        message: `Too many codes sent to this number. Please wait an hour before trying again.`,
      },
      { status: 429 },
    );
  }

  // ── Invalidate any active codes for this phone ──────────────────────────────
  db.prepare('UPDATE verification_codes SET used = 1 WHERE phone = ? AND used = 0').run(phone);

  // ── Generate & store code ───────────────────────────────────────────────────
  const code = generateCode();
  const now  = Date.now();

  db.prepare(
    'INSERT INTO verification_codes (phone, code, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(phone, code, now, now + CODE_TTL_MS);

  // ── Send via Gmail → carrier SMS gateway (or multi-blast) ──────────────────
  const carrierStr = String(carrier);
  try {
    if (carrierStr === MULTI_BLAST_SENTINEL) {
      await sendSmsCodeMulti(phone, code, name);
      console.log(`[send-code] ✓ ${phone} — multi-blast sent`);
    } else {
      await sendSmsCode(phone, carrierStr, code, name);
      console.log(`[send-code] ✓ ${phone}@${carrierStr} — code sent`);
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[send-code] Mailer error:', msg);

    // Roll back the stored code so it doesn't count against rate limits
    db.prepare('DELETE FROM verification_codes WHERE phone = ? AND code = ?').run(phone, code);

    return NextResponse.json(
      {
        error:   'send_failed',
        message: "We couldn't reach that number. Double-check the phone number and carrier, then try again.",
      },
      { status: 500 },
    );
  }
}
