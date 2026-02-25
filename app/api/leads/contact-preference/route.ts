/**
 * PATCH /api/leads/contact-preference
 *
 * Saves the lead's contact timing preference to Firestore.
 * Body: { leadId, timing, time_slot }
 *   timing   : 'asap' | 'later_today' | 'tomorrow'
 *   time_slot: 'morning' | 'afternoon' | 'evening'
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const VALID_TIMINGS   = ['asap', 'later_today', 'tomorrow'] as const;
const VALID_TIMESLOTS = ['morning', 'afternoon', 'evening'] as const;

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { leadId, timing, time_slot } = body;

  if (!leadId || typeof leadId !== 'string') {
    return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
  }
  if (!VALID_TIMINGS.includes(timing as typeof VALID_TIMINGS[number])) {
    return NextResponse.json({ error: 'invalid timing' }, { status: 400 });
  }
  if (!VALID_TIMESLOTS.includes(time_slot as typeof VALID_TIMESLOTS[number])) {
    return NextResponse.json({ error: 'invalid time_slot' }, { status: 400 });
  }

  try {
    await adminDb.collection('leads').doc(leadId).update({
      contact_preference: {
        timing:    String(timing),
        time_slot: String(time_slot),
        saved_at:  Date.now(),
      },
    });
  } catch (err) {
    // Lead doc may not exist if called with bad ID — treat gracefully
    console.error('[contact-preference] update error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
