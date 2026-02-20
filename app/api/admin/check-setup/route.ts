/**
 * GET /api/admin/check-setup
 *
 * Returns whether admin credentials have been configured via env vars.
 * Used by the login page to detect a first-run scenario and show setup instructions.
 *
 * Response: { configured: boolean }
 *
 * NOTE: Does NOT expose credential values — only presence.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const configured = !!(
    process.env.ADMIN_EMAIL?.trim() &&
    process.env.ADMIN_PASSWORD_HASH?.trim()
  );

  return NextResponse.json({ configured });
}
