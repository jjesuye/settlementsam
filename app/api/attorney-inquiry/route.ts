/**
 * POST /api/attorney-inquiry
 *
 * Saves an attorney inquiry to Firestore (attorney_inquiries collection)
 * and triggers the pricing reveal on the /attorneys page.
 *
 * Body: { name, firm, email, phone, state, case_volume }
 * Response 200: { success: true, id: string }
 * Response 400: { error: string, message: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { validateEmailServer } from '@/lib/validate-email-server';

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

  const { name, firm, email, phone, state, case_volume, bar_number, source } = body;

  // ── Basic validation ──────────────────────────────────────────────────────────
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'invalid_input', message: 'Name is required.' }, { status: 400 });
  }
  if (!firm || typeof firm !== 'string' || !firm.trim()) {
    return NextResponse.json({ error: 'invalid_input', message: 'Law firm name is required.' }, { status: 400 });
  }
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'invalid_input', message: 'Email is required.' }, { status: 400 });
  }
  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ error: 'invalid_input', message: 'Phone is required.' }, { status: 400 });
  }
  if (!state || typeof state !== 'string') {
    return NextResponse.json({ error: 'invalid_input', message: 'State is required.' }, { status: 400 });
  }
  if (!case_volume || typeof case_volume !== 'string') {
    return NextResponse.json({ error: 'invalid_input', message: 'Case volume is required.' }, { status: 400 });
  }

  // ── Email validation (format + MX) ───────────────────────────────────────────
  const emailError = await validateEmailServer(email);
  if (emailError) {
    return NextResponse.json({ error: 'invalid_email', message: emailError }, { status: 400 });
  }

  // ── Save to Firestore ─────────────────────────────────────────────────────────
  try {
    const docRef = await adminDb.collection('attorney_inquiries').add({
      name:           name.trim(),
      firm:           firm.trim(),
      email:          email.trim().toLowerCase(),
      phone:          phone.trim(),
      state:          state.trim(),
      case_volume:    case_volume.trim(),
      bar_number:     typeof bar_number === 'string' ? bar_number.trim() : '',
      timestamp:      Date.now(),
      source:         typeof source === 'string' && source.trim() ? source.trim() : 'attorneys_page',
      contacted:      false,
      pricing_viewed: true,
      notes:          '',
    });

    console.log(`[attorney-inquiry] New inquiry: ${name.trim()} @ ${firm.trim()} (${state})`);
    return NextResponse.json({ success: true, id: docRef.id });
  } catch (err: unknown) {
    console.error('[attorney-inquiry] Firestore error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'server_error', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
