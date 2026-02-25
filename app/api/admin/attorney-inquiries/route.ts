/**
 * GET  /api/admin/attorney-inquiries — list all attorney inquiries (admin only)
 * PATCH /api/admin/attorney-inquiries — update inquiry (mark contacted / add note)
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

function verifyAdmin(req: NextRequest): boolean {
  try {
    const auth = req.headers.get('authorization') ?? '';
    const tok  = auth.replace(/^Bearer\s+/i, '');
    const p    = jwt.verify(tok, JWT_SECRET) as { role?: string };
    return p.role === 'admin';
  } catch { return false; }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const state  = searchParams.get('state')  ?? '';
  const volume = searchParams.get('volume') ?? '';

  let query: FirebaseFirestore.Query = adminDb
    .collection('attorney_inquiries')
    .orderBy('timestamp', 'desc');

  if (state)  query = query.where('state',       '==', state);
  if (volume) query = query.where('case_volume', '==', volume);

  const snap = await query.get();
  const inquiries = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  return NextResponse.json({ inquiries });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { id, contacted, notes } = body;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof contacted === 'boolean') update.contacted = contacted;
  if (typeof notes     === 'string')  update.notes     = notes;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  await adminDb.collection('attorney_inquiries').doc(id).update(update);
  return NextResponse.json({ success: true });
}
