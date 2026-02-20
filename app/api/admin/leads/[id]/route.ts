/**
 * GET  /api/admin/leads/[id]  — Full lead detail
 * POST /api/admin/leads/[id]  — Update lead (tier, disputed, replaced, delivered)
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';
import type { DbLead } from '@/lib/db';

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

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(params.id)) as DbLead | undefined;
  if (!lead) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ lead });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const ALLOWED = ['tier', 'disputed', 'replaced', 'delivered', 'client_id', 'score'];
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];

  for (const key of ALLOWED) {
    if (key in body) { sets.push(`${key} = ?`); vals.push(body[key] as string | number | null); }
  }

  if (sets.length === 0) return NextResponse.json({ error: 'no_fields' }, { status: 400 });

  vals.push(Number(params.id));
  db.prepare(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

  const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(params.id)) as unknown as DbLead;
  return NextResponse.json({ lead: updated });
}
