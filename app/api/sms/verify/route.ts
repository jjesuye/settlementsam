/**
 * POST /api/sms/verify
 *
 * Validates a 6-digit code against Firestore `verification_codes`,
 * marks the record used, and returns a short-lived phoneToken JWT
 * that proves phone ownership to /api/verify-code.
 *
 * Body:     { phone: string, code: string }
 * Response: { success: true, phoneToken: string }
 * Errors:   400 invalid_phone | 400 invalid_code | 400 no_code | 400 incorrect_code
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { adminDb } from '@/lib/firebase/admin';
import { normalizePhone } from '@/lib/sms';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

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
  const code  = String(body.code ?? '').replace(/\D/g, '');

  if (phone.length !== 10) {
    return NextResponse.json(
      { error: 'invalid_phone', message: 'Invalid phone number.' },
      { status: 400 },
    );
  }

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: 'invalid_code', message: 'Please enter the 6-digit code.' },
      { status: 400 },
    );
  }

  const now = Date.now();

  // Fetch all unused codes for this phone, filter expired in code
  const snap = await adminDb.collection('verification_codes')
    .where('phone', '==', phone)
    .where('used',  '==', false)
    .get();

  const valid = snap.docs
    .filter(d => (d.data().expires_at as number) > now)
    .sort((a, b) => (b.data().expires_at as number) - (a.data().expires_at as number));

  if (valid.length === 0) {
    return NextResponse.json(
      { error: 'no_code', message: 'No active code found. Please request a new one.' },
      { status: 400 },
    );
  }

  const doc      = valid[0];
  const stored   = doc.data();
  const attempts = (Number(stored.attempts) || 0) + 1;

  await doc.ref.update({ attempts });

  if (stored.code !== code) {
    const remaining = Math.max(0, 5 - attempts);
    if (remaining === 0) await doc.ref.update({ used: true });
    const msg = remaining > 0
      ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
      : 'Too many incorrect attempts. Please request a new code.';
    return NextResponse.json({ error: 'incorrect_code', message: msg }, { status: 400 });
  }

  await doc.ref.update({ used: true });

  // Short-lived phone verification token (5 minutes)
  const phoneToken = jwt.sign({ phone, verified: true }, JWT_SECRET, { expiresIn: 300 });

  console.log(`[sms/verify] ✓ phone ${phone} verified`);
  return NextResponse.json({ success: true, phoneToken });
}
