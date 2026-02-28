/**
 * POST /api/sms/send
 *
 * Generates a 6-digit code, stores it in Firestore `verification_codes`,
 * verifies the Gmail SMTP connection, then blasts all carrier gateways.
 *
 * Body:     { phone: string }
 * Response: { success: true, message: string }
 * Errors:   400 invalid_phone | 429 rate_limited | 500 various
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

const GATEWAYS = [
  'txt.att.net',
  'vtext.com',
  'tmomail.net',
  'sms.cricketwireless.net',
  'sms.myboostmobile.com',
  'mymetropcs.com',
  'messaging.sprintpcs.com',
  'email.uscc.net',
  'vmobl.com',
];

const CODE_TTL_MS    = 10 * 60 * 1_000;
const RATE_WINDOW_MS = 60 * 60 * 1_000;
const MAX_SENDS      = 3;

function normalizePhone(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

export async function POST(req: NextRequest) {
  console.log('[SMS/SEND] Route hit');

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

    const digits = normalizePhone(String(body.phone ?? ''));
    console.log('[SMS/SEND] Phone digits:', digits.length, 'digits');

    if (digits.length !== 10) {
      return NextResponse.json(
        { error: 'invalid_phone', message: 'Please enter a valid 10-digit US phone number.' },
        { status: 400 },
      );
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    console.log('[SMS/SEND] GMAIL_USER:', gmailUser ? `SET (${gmailUser})` : 'MISSING');
    console.log('[SMS/SEND] GMAIL_PASS:', gmailPass ? 'SET' : 'MISSING');

    if (!gmailUser || !gmailPass) {
      console.error('[SMS/SEND] FATAL: Gmail credentials missing');
      return NextResponse.json(
        { error: 'misconfigured', message: 'SMS service is not configured. Please contact support.' },
        { status: 500 },
      );
    }

    // ── Rate limit ───────────────────────────────────────────────────────────

    const now = Date.now();
    let recentCount = 0;
    try {
      const { adminDb } = await import('@/lib/firebase/admin');
      const allSnap = await adminDb.collection('verification_codes')
        .where('phone', '==', digits)
        .get();
      recentCount = allSnap.docs.filter(
        d => (d.data().timestamp as number) >= now - RATE_WINDOW_MS,
      ).length;
    } catch (dbErr: unknown) {
      console.error('[SMS/SEND] Rate-limit query failed:', dbErr instanceof Error ? dbErr.message : dbErr);
      // Non-fatal — continue without rate-limiting
    }

    if (recentCount >= MAX_SENDS) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Too many codes sent. Please wait before requesting another.' },
        { status: 429 },
      );
    }

    // ── Generate code ────────────────────────────────────────────────────────

    const code = crypto.randomInt(100_000, 1_000_000).toString();
    console.log('[SMS/SEND] Code generated');

    // ── Save to Firestore ────────────────────────────────────────────────────

    try {
      const { adminDb } = await import('@/lib/firebase/admin');
      await adminDb.collection('verification_codes').add({
        phone:      digits,
        code,
        timestamp:  now,
        expires_at: now + CODE_TTL_MS,
        attempts:   0,
        used:       false,
      });
      console.log('[SMS/SEND] Code saved to Firestore');
    } catch (dbErr: unknown) {
      console.error('[SMS/SEND] Firestore error:', dbErr instanceof Error ? dbErr.message : dbErr);
      return NextResponse.json(
        { error: 'db_error', message: 'Database error. Please try again.' },
        { status: 500 },
      );
    }

    // ── Gmail transporter ────────────────────────────────────────────────────

    const transporter = nodemailer.createTransport({
      host:   'smtp.gmail.com',
      port:   465,
      secure: true,
      auth:   { user: gmailUser, pass: gmailPass },
    });

    try {
      await transporter.verify();
      console.log('[SMS/SEND] Gmail transporter verified OK');
    } catch (verifyErr: unknown) {
      console.error('[SMS/SEND] Gmail verify failed:', verifyErr instanceof Error ? verifyErr.message : verifyErr);
      return NextResponse.json(
        { error: 'smtp_error', message: 'Failed to send SMS. Please try again.' },
        { status: 500 },
      );
    }

    // ── Blast all gateways ───────────────────────────────────────────────────

    const results = await Promise.allSettled(
      GATEWAYS.map(gw =>
        transporter.sendMail({
          from:    `"Settlement Sam" <${gmailUser}>`,
          to:      `${digits}@${gw}`,
          subject: '',
          text:    `Your Settlement Sam verification code: ${code}\n\nValid for 10 minutes. Do not share this code.`,
        }),
      ),
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`[SMS/SEND] Results: ${sent} sent, ${failed} failed`);

    if (sent === 0) {
      const sample = (results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined)?.reason;
      console.error('[SMS/SEND] All gateways failed. Sample error:', sample instanceof Error ? sample.message : sample);
    }

    return NextResponse.json({ success: true, message: 'Code sent successfully.' });

  } catch (err: unknown) {
    console.error('[SMS/SEND] Unhandled error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'internal', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
