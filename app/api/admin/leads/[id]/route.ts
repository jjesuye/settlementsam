/**
 * GET  /api/admin/leads/[id]  — Full lead detail
 * POST /api/admin/leads/[id]  — Update lead fields (tier, disputed, replaced, delivered, client_id, score)
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { adminDb } from '@/lib/firebase/admin';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

function verifyAdmin(req: NextRequest): boolean {
  try {
    const auth = req.headers.get('authorization') ?? '';
    const tok  = auth.replace(/^Bearer\s+/i, '');
    const p    = jwt.verify(tok, JWT_SECRET) as { role?: string };
    return p.role === 'admin';
  } catch { return false; }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const doc = await adminDb.collection('leads').doc(params.id).get();
  if (!doc.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ lead: { id: doc.id, ...doc.data() } });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const ALLOWED = ['tier', 'disputed', 'replaced', 'delivered', 'client_id', 'score'];
  const updates: Record<string, unknown> = {};

  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 });
  }

  await adminDb.collection('leads').doc(params.id).update(updates);

  const updated = await adminDb.collection('leads').doc(params.id).get();
  return NextResponse.json({ lead: { id: updated.id, ...updated.data() } });
}
