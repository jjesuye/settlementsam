/**
 * POST /api/admin/login
 *
 * Validates admin credentials against env vars.
 * Security features:
 *   - bcrypt hash comparison (ADMIN_PASSWORD_HASH env) with plaintext dev fallback
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
import { db } from '@/lib/db';

const JWT_SECRET    = process.env.JWT_SECRET          ?? 'dev-secret-change-in-production';
const ADMIN_EMAIL   = process.env.ADMIN_EMAIL         ?? 'admin@settlementsam.com';
const ADMIN_HASH    = process.env.ADMIN_PASSWORD_HASH ?? '';
const ADMIN_PLAIN   = process.env.ADMIN_PASSWORD      ?? 'changeme';

const TOKEN_TTL_S   = 60 * 60 * 24;  // 24 hours
const MAX_ATTEMPTS  = 5;
const LOCKOUT_MS    = 15 * 60 * 1_000; // 15 minutes

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

  const email = String(body.email ?? '').trim().toLowerCase();
  const ip    = getClientIP(req);
  const identifier = `${email}::${ip}`;
  const windowStart = Date.now() - LOCKOUT_MS;

  // ── Check lockout ────────────────────────────────────────────────────────────
  const failCount = (db
    .prepare(`SELECT COUNT(*) AS n FROM login_attempts
              WHERE identifier = ? AND attempted_at > ? AND success = 0`)
    .get(identifier, windowStart) as { n: number }).n;

  if (failCount >= MAX_ATTEMPTS) {
    const oldest = (db
      .prepare(`SELECT attempted_at FROM login_attempts
                WHERE identifier = ? AND attempted_at > ? AND success = 0
                ORDER BY attempted_at ASC LIMIT 1`)
      .get(identifier, windowStart) as { attempted_at: number } | undefined);

    const unlockAt    = (oldest?.attempted_at ?? Date.now()) + LOCKOUT_MS;
    const retryAfter  = Math.ceil((unlockAt - Date.now()) / 1_000);

    return NextResponse.json(
      {
        error:      'locked',
        message:    `Too many failed attempts. Try again in ${Math.ceil(retryAfter / 60)} minute${retryAfter > 60 ? 's' : ''}.`,
        retryAfter,
      },
      { status: 423 },
    );
  }

  // ── Validate email ────────────────────────────────────────────────────────────
  if (email !== ADMIN_EMAIL.toLowerCase()) {
    db.prepare('INSERT INTO login_attempts (identifier, attempted_at, success) VALUES (?, ?, 0)')
      .run(identifier, Date.now());
    return NextResponse.json(
      { error: 'invalid_credentials', message: 'Invalid email or password.' },
      { status: 401 },
    );
  }

  // ── Validate password ─────────────────────────────────────────────────────────
  let valid = false;
  if (ADMIN_HASH) {
    valid = await bcrypt.compare(String(body.password ?? ''), ADMIN_HASH);
  } else {
    valid = String(body.password ?? '') === ADMIN_PLAIN;
  }

  if (!valid) {
    db.prepare('INSERT INTO login_attempts (identifier, attempted_at, success) VALUES (?, ?, 0)')
      .run(identifier, Date.now());

    const remaining = MAX_ATTEMPTS - (failCount + 1);
    const msg = remaining > 0
      ? `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`
      : 'Invalid email or password. Account is now locked for 15 minutes.';

    return NextResponse.json({ error: 'invalid_credentials', message: msg }, { status: 401 });
  }

  // ── Success — record attempt and issue JWT ────────────────────────────────────
  db.prepare('INSERT INTO login_attempts (identifier, attempted_at, success) VALUES (?, ?, 1)')
    .run(identifier, Date.now());

  const token = jwt.sign(
    { role: 'admin', email: ADMIN_EMAIL },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL_S },
  );

  return NextResponse.json({ success: true, token });
}
