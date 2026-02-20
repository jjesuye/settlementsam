/**
 * POST /api/admin/login
 *
 * Validates admin credentials. Checks Firestore 'admins' collection first,
 * then falls back to ADMIN_EMAIL / ADMIN_PASSWORD_HASH env vars.
 * Security features:
 *   - bcrypt hash comparison
 *   - Brute-force lockout: 5 failed attempts → 15-minute cooldown per email+IP
 *   - JWT with 24-hour expiry
 *
 * Response 200: { success: true, token: string }
 * Response 401: { error: string, message: string }
 * Response 423: { error: 'locked', message: string, retryAfter: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { adminDb } from '@/lib/firebase/admin';
import type { FsAdmin } from '@/lib/firebase/types';

const JWT_SECRET  = process.env.JWT_SECRET          ?? 'dev-secret-change-in-production';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL         ?? 'admin@settlementsam.com';
const ADMIN_HASH  = process.env.ADMIN_PASSWORD_HASH ?? '';
const ADMIN_PLAIN = process.env.ADMIN_PASSWORD      ?? 'changeme';

const TOKEN_TTL_S  = 60 * 60 * 24;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1_000;

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json', message: 'Invalid request.' }, { status: 400 });
  }

  const email      = String(body.email ?? '').trim().toLowerCase();
  const ip         = getClientIP(req);
  const identifier = `${email}::${ip}`;
  const windowStart = Date.now() - LOCKOUT_MS;

  // ── Check lockout ────────────────────────────────────────────────────────────
  const failSnap = await adminDb
    .collection('login_attempts')
    .where('identifier', '==', identifier)
    .where('attempted_at', '>', windowStart)
    .where('success', '==', false)
    .get();

  const failCount = failSnap.size;

  if (failCount >= MAX_ATTEMPTS) {
    const sorted     = failSnap.docs.sort((a, b) => a.data().attempted_at - b.data().attempted_at);
    const oldest     = (sorted[0]?.data().attempted_at as number) ?? Date.now();
    const unlockAt   = oldest + LOCKOUT_MS;
    const retryAfter = Math.ceil((unlockAt - Date.now()) / 1_000);

    return NextResponse.json(
      {
        error:      'locked',
        message:    `Too many failed attempts. Try again in ${Math.ceil(retryAfter / 60)} minute${retryAfter > 60 ? 's' : ''}.`,
        retryAfter,
      },
      { status: 423 },
    );
  }

  // ── Look up admin in Firestore, fall back to env vars ────────────────────────
  let adminEmail = ADMIN_EMAIL;
  let adminHash  = ADMIN_HASH;

  const adminSnap = await adminDb
    .collection('admins')
    .where('email', '==', email)
    .limit(1)
    .get();

  if (!adminSnap.empty) {
    const fsAdmin = adminSnap.docs[0].data() as FsAdmin;
    adminEmail = fsAdmin.email;
    adminHash  = fsAdmin.password_hash;
  }

  // ── Validate email ─────────────────────────────────────────────────────────
  if (email !== adminEmail.toLowerCase()) {
    await adminDb.collection('login_attempts').add({ identifier, attempted_at: Date.now(), success: false });
    return NextResponse.json(
      { error: 'invalid_credentials', message: 'Invalid email or password.' },
      { status: 401 },
    );
  }

  // ── Validate password ──────────────────────────────────────────────────────
  let valid = false;
  if (adminHash) {
    valid = await bcrypt.compare(String(body.password ?? ''), adminHash);
  } else {
    valid = String(body.password ?? '') === ADMIN_PLAIN;
  }

  if (!valid) {
    await adminDb.collection('login_attempts').add({ identifier, attempted_at: Date.now(), success: false });
    const remaining = MAX_ATTEMPTS - (failCount + 1);
    const msg = remaining > 0
      ? `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`
      : 'Invalid email or password. Account is now locked for 15 minutes.';
    return NextResponse.json({ error: 'invalid_credentials', message: msg }, { status: 401 });
  }

  // ── Success — record attempt and issue JWT ────────────────────────────────────
  await adminDb.collection('login_attempts').add({ identifier, attempted_at: Date.now(), success: true });

  const token = jwt.sign(
    { role: 'admin', email: adminEmail },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL_S },
  );

  return NextResponse.json({ success: true, token });
}
