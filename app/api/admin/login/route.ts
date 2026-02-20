/**
 * POST /api/admin/login
 *
 * Validates admin credentials. Checks Firestore 'admins' collection by username.
 * Security features:
 *   - bcrypt hash comparison
 *   - Brute-force lockout: 5 failed attempts → 15-minute cooldown per username+IP
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

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

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
  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json', message: 'Invalid request.' }, { status: 400 });
  }

  const username   = String(body.username ?? '').trim().toLowerCase();
  const ip         = getClientIP(req);
  const identifier = `${username}::${ip}`;
  const windowStart = Date.now() - LOCKOUT_MS;

  if (!username) {
    return NextResponse.json({ error: 'invalid_credentials', message: 'Username is required.' }, { status: 401 });
  }

  // ── Check lockout ─────────────────────────────────────────────────────────────
  const failSnap = await adminDb
    .collection('login_attempts')
    .where('identifier', '==', identifier)
    .where('attempted_at', '>', windowStart)
    .where('success', '==', false)
    .get();

  if (failSnap.size >= MAX_ATTEMPTS) {
    const sorted     = failSnap.docs.sort((a, b) => a.data().attempted_at - b.data().attempted_at);
    const oldest     = (sorted[0]?.data().attempted_at as number) ?? Date.now();
    const retryAfter = Math.ceil((oldest + LOCKOUT_MS - Date.now()) / 1_000);
    return NextResponse.json(
      {
        error:      'locked',
        message:    `Too many failed attempts. Try again in ${Math.ceil(retryAfter / 60)} minute${retryAfter > 60 ? 's' : ''}.`,
        retryAfter,
      },
      { status: 423 },
    );
  }

  // ── Look up admin by username in Firestore ────────────────────────────────────
  const adminSnap = await adminDb
    .collection('admins')
    .where('username', '==', username)
    .limit(1)
    .get();

  if (adminSnap.empty) {
    await adminDb.collection('login_attempts').add({ identifier, attempted_at: Date.now(), success: false });
    return NextResponse.json(
      { error: 'invalid_credentials', message: 'Invalid username or password.' },
      { status: 401 },
    );
  }

  const fsAdmin = adminSnap.docs[0].data() as FsAdmin;

  // ── Validate password ─────────────────────────────────────────────────────────
  const valid = await bcrypt.compare(String(body.password ?? ''), fsAdmin.password_hash);

  if (!valid) {
    await adminDb.collection('login_attempts').add({ identifier, attempted_at: Date.now(), success: false });
    const remaining = MAX_ATTEMPTS - (failSnap.size + 1);
    const msg = remaining > 0
      ? `Invalid username or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
      : 'Invalid username or password. Account is now locked for 15 minutes.';
    return NextResponse.json({ error: 'invalid_credentials', message: msg }, { status: 401 });
  }

  // ── Success ───────────────────────────────────────────────────────────────────
  await adminDb.collection('login_attempts').add({ identifier, attempted_at: Date.now(), success: true });

  const token = jwt.sign(
    { role: 'admin', username: fsAdmin.username },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL_S },
  );

  return NextResponse.json({ success: true, token });
}
