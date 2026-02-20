/**
 * POST /api/distribute/sheets
 *
 * Pushes all undelivered leads for a given client to their Google Sheet.
 * Does NOT mark leads as delivered (Sheets push is supplemental to email).
 *
 * Body: { clientId: number }
 * Response 200: { success: true, pushed: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';
import type { DbLead, DbClient } from '@/lib/db';
import { pushUndeliveredLeadsToSheet } from '@/lib/distribution/sheets';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

function verifyAdmin(req: NextRequest): boolean {
  try {
    const auth = req.headers.get('authorization') ?? '';
    const tok  = auth.replace(/^Bearer\s+/i, '');
    const p    = jwt.verify(tok, JWT_SECRET) as { role?: string };
    return p.role === 'admin';
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { clientId } = body;
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(clientId)) as DbClient | undefined;
  if (!client) return NextResponse.json({ error: 'client_not_found' }, { status: 404 });
  if (!client.sheets_id) return NextResponse.json({ error: 'no_sheets_id', message: 'Client has no Google Sheets ID configured.' }, { status: 400 });

  const leads = db.prepare(
    'SELECT * FROM leads WHERE verified = 1 ORDER BY timestamp DESC'
  ).all() as unknown as DbLead[];

  try {
    const pushed = await pushUndeliveredLeadsToSheet(client.sheets_id, leads);
    return NextResponse.json({ success: true, pushed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Sheets push failed';
    return NextResponse.json({ error: 'sheets_error', message: msg }, { status: 500 });
  }
}
