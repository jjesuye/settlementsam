/**
 * GET /api/admin/check-setup
 *
 * Returns whether admin credentials have been configured.
 * Checks Firestore 'admins' collection first, then falls back to env vars.
 * Used by the login page to detect a first-run scenario and show setup instructions.
 *
 * Response: { configured: boolean }
 *
 * NOTE: Does NOT expose credential values — only presence.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET() {
  // Check Firestore first
  try {
    const snap = await adminDb.collection('admins').limit(1).get();
    if (!snap.empty) {
      return NextResponse.json({ configured: true });
    }
  } catch {
    // Firestore unavailable — fall through to env var check
  }

  // Fall back to env vars
  const configured = !!(
    process.env.ADMIN_EMAIL?.trim() &&
    process.env.ADMIN_PASSWORD_HASH?.trim()
  );

  return NextResponse.json({ configured });
}
