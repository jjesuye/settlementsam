/**
 * POST /api/sms/send
 *
 * Generates a 6-digit code, stores it in Firestore `verification_codes`,
 * and blasts all carrier gateways simultaneously (first delivery wins).
 *
 * Body:     { phone: string }
 * Response: { success: true, message: string }
 * Errors:   400 invalid_phone | 429 rate_limited | 500 send_failed
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import {
  normalizePhone,
  sendSmsCodeMulti,
  CODE_TTL_MS,
  RATE_WINDOW_MS,
  MAX_SENDS_PER_HR,
} from '@/lib/sms';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  const phone = normalizePhone(String(body.phone ?? ''));
  if (phone.length !== 10) {
    return NextResponse.json(
      { error: 'invalid_phone', message: 'Please enter a valid 10-digit US phone number.' },
      { status: 400 },
    );
  }

  const now = Date.now();

  // Rate limit: max 3 sends per phone per hour (filter in code to avoid composite index)
  const allSnap = await adminDb.collection('verification_codes')
    .where('phone', '==', phone)
    .get();

  const recentCount = allSnap.docs.filter(
    d => (d.data().timestamp as number) >= now - RATE_WINDOW_MS,
  ).length;

  if (recentCount >= MAX_SENDS_PER_HR) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many codes sent. Please wait before requesting another.' },
      { status: 429 },
    );
  }

  // 6-digit cryptographically secure code
  const code      = String(crypto.randomInt(100_000, 1_000_000));
  const expiresAt = now + CODE_TTL_MS;

  await adminDb.collection('verification_codes').add({
    phone,
    code,
    timestamp:  now,
    expires_at: expiresAt,
    attempts:   0,
    used:       false,
  });

  try {
    await sendSmsCodeMulti(phone, code, 'there');
  } catch (err: unknown) {
    console.error('[sms/send]', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'send_failed', message: 'Failed to send SMS. Check your phone number and try again.' },
      { status: 500 },
    );
  }

  console.log(`[sms/send] code sent to ${phone}`);
  return NextResponse.json({ success: true, message: 'Code sent successfully.' });
}
