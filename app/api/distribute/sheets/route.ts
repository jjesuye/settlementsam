/**
 * POST /api/distribute/sheets
 *
 * Pushes all verified leads for a given client to their Google Sheet.
 *
 * Body: { clientId: string }
 * Response 200: { success: true, pushed: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { adminDb } from '@/lib/firebase/admin';
import type { FsLead, FsClient } from '@/lib/firebase/types';
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

  const clientDoc = await adminDb.collection('clients').doc(String(clientId)).get();
  if (!clientDoc.exists) return NextResponse.json({ error: 'client_not_found' }, { status: 404 });

  const client = { id: clientDoc.id, ...clientDoc.data() } as FsClient & { id: string };
  if (!client.sheets_id) {
    return NextResponse.json(
      { error: 'no_sheets_id', message: 'Client has no Google Sheets ID configured.' },
      { status: 400 },
    );
  }

  const leadsSnap = await adminDb
    .collection('leads')
    .where('verified', '==', true)
    .orderBy('timestamp', 'desc')
    .get();

  const leads = leadsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as (FsLead & { id: string })[];

  try {
    const pushed = await pushUndeliveredLeadsToSheet(client.sheets_id, leads);
    return NextResponse.json({ success: true, pushed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Sheets push failed';
    return NextResponse.json({ error: 'sheets_error', message: msg }, { status: 500 });
  }
}
