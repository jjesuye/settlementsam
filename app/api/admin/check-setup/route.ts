/**
 * GET /api/admin/check-setup
 *
 * Returns whether admin credentials have been configured.
 * Checks Firestore 'admins' collection first, then falls back to env vars.
 * Must be dynamic — never statically rendered.
 *
 * Response: { configured: boolean }
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET() {
  try {
    const snap = await adminDb.collection('admins').limit(1).get();
    if (!snap.empty) {
      return NextResponse.json({ configured: true });
    }
  } catch {
    // Firestore unavailable — fall through to env var check
  }

  const configured = !!(
    process.env.ADMIN_EMAIL?.trim() &&
    process.env.ADMIN_PASSWORD_HASH?.trim()
  );

  return NextResponse.json({ configured });
}
