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
  try {
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

    // Guard: fail fast if mailer credentials are absent
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error('[sms/send] MISSING ENV: GMAIL_USER or GMAIL_APP_PASSWORD not set');
      return NextResponse.json(
        { error: 'misconfigured', message: 'SMS service is not configured. Please contact support.' },
        { status: 500 },
      );
    }

    const now = Date.now();

    // Rate limit: max 3 sends per phone per hour
    let recentCount = 0;
    try {
      const allSnap = await adminDb.collection('verification_codes')
        .where('phone', '==', phone)
        .get();
      recentCount = allSnap.docs.filter(
        d => (d.data().timestamp as number) >= now - RATE_WINDOW_MS,
      ).length;
    } catch (err: unknown) {
      console.error('[sms/send] rate-limit query failed:', err instanceof Error ? err.message : err);
      // Non-fatal: continue without rate limiting rather than blocking the user
    }

    if (recentCount >= MAX_SENDS_PER_HR) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Too many codes sent. Please wait before requesting another.' },
        { status: 429 },
      );
    }

    // 6-digit cryptographically secure code
    const code      = String(crypto.randomInt(100_000, 1_000_000));
    const expiresAt = now + CODE_TTL_MS;

    try {
      await adminDb.collection('verification_codes').add({
        phone,
        code,
        timestamp:  now,
        expires_at: expiresAt,
        attempts:   0,
        used:       false,
      });
    } catch (err: unknown) {
      console.error('[sms/send] Firestore write failed:', err instanceof Error ? err.message : err);
      return NextResponse.json(
        { error: 'db_error', message: 'Could not save verification code. Please try again.' },
        { status: 500 },
      );
    }

    try {
      await sendSmsCodeMulti(phone, code, 'there');
    } catch (err: unknown) {
      console.error('[sms/send] sendSmsCodeMulti failed:', err instanceof Error ? err.message : err);
      return NextResponse.json(
        { error: 'send_failed', message: 'Failed to send SMS. Check your phone number and try again.' },
        { status: 500 },
      );
    }

    console.log(`[sms/send] code sent to ${phone}`);
    return NextResponse.json({ success: true, message: 'Code sent successfully.' });

  } catch (err: unknown) {
    console.error('[sms/send] unhandled error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'internal', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
