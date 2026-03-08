/**
 * PATCH /api/leads/contact-preference
 *
 * Saves the lead's contact timing preference to Firestore.
 * Body: { leadId, urgency, preferredHours, timezone }
 *   urgency       : 'asap' | 'today' | 'this_week'
 *   preferredHours: ('morning' | 'afternoon' | 'evening')[]
 *   timezone      : IANA timezone string e.g. 'America/Chicago'
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const VALID_URGENCY   = ['asap', 'today', 'this_week'] as const;
const VALID_TIMESLOTS = ['morning', 'afternoon', 'evening'] as const;

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { leadId, urgency, preferredHours, timezone } = body;

  if (!leadId || typeof leadId !== 'string') {
    return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
  }
  if (!VALID_URGENCY.includes(urgency as typeof VALID_URGENCY[number])) {
    return NextResponse.json({ error: 'invalid urgency' }, { status: 400 });
  }
  if (
    !Array.isArray(preferredHours) ||
    preferredHours.length === 0 ||
    !preferredHours.every(h => VALID_TIMESLOTS.includes(h as typeof VALID_TIMESLOTS[number]))
  ) {
    return NextResponse.json({ error: 'invalid preferredHours' }, { status: 400 });
  }

  try {
    await adminDb.collection('leads').doc(leadId).update({
      contact_preference: {
        urgency:         String(urgency),
        preferred_hours: preferredHours as string[],
        timezone:        typeof timezone === 'string' ? timezone : '',
        saved_at:        Date.now(),
      },
    });
  } catch (err) {
    console.error('[contact-preference] update error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
