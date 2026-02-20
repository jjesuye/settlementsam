/**
 * POST /api/distribute
 *
 * Distributes a verified lead to its assigned client via email (and optionally
 * Google Sheets). Enforces duplicate-delivery prevention and logs to Firestore.
 *
 * Body: { leadId: string, clientId?: string, method?: 'email' | 'sheets' | 'both' }
 *
 * Response 200: { success: true, method: string, deliveryId: string }
 * Response 400: { error: string, message: string }
 * Response 409: { error: 'already_delivered', message: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { FsLead, FsClient } from '@/lib/firebase/types';
import { sendLeadEmail }     from '@/lib/distribution/email';
import { appendLeadToSheet } from '@/lib/distribution/sheets';

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

  const { leadId, clientId, method = 'email' } = body;

  if (!leadId) return NextResponse.json({ error: 'invalid_input', message: 'leadId is required.' }, { status: 400 });

  // ── Fetch lead ────────────────────────────────────────────────────────────────
  const leadDoc = await adminDb.collection('leads').doc(String(leadId)).get();
  if (!leadDoc.exists) return NextResponse.json({ error: 'not_found', message: 'Lead not found.' }, { status: 404 });

  const lead = { id: leadDoc.id, ...leadDoc.data() } as FsLead & { id: string };

  // ── Duplicate check ───────────────────────────────────────────────────────────
  if (lead.delivered) {
    return NextResponse.json(
      { error: 'already_delivered', message: `Lead ${lead.id} was already delivered.` },
      { status: 409 },
    );
  }

  // ── Resolve client ────────────────────────────────────────────────────────────
  const resolvedClientId = String(clientId ?? lead.client_id ?? '');
  if (!resolvedClientId) {
    return NextResponse.json(
      { error: 'no_client', message: 'No client assigned to this lead. Set clientId or assign via lead profile.' },
      { status: 400 },
    );
  }

  const clientDoc = await adminDb.collection('clients').doc(resolvedClientId).get();
  if (!clientDoc.exists) return NextResponse.json({ error: 'client_not_found', message: 'Client not found.' }, { status: 404 });

  const client = { id: clientDoc.id, ...clientDoc.data() } as FsClient & { id: string };

  // ── Deliver ───────────────────────────────────────────────────────────────────
  const deliveryMethod = String(method);
  const errors: string[] = [];

  if (deliveryMethod === 'email' || deliveryMethod === 'both') {
    try {
      await sendLeadEmail(lead, client);
    } catch (err: unknown) {
      errors.push(`Email: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  if ((deliveryMethod === 'sheets' || deliveryMethod === 'both') && client.sheets_id) {
    try {
      await appendLeadToSheet(client.sheets_id, lead);
    } catch (err: unknown) {
      errors.push(`Sheets: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  if (errors.length > 0 && deliveryMethod !== 'both') {
    return NextResponse.json({ error: 'delivery_failed', message: errors.join('; ') }, { status: 500 });
  }

  // ── Mark delivered in Firestore ───────────────────────────────────────────────
  await adminDb.collection('leads').doc(lead.id).update({
    delivered: true,
    client_id: resolvedClientId,
  });

  await adminDb.collection('clients').doc(resolvedClientId).update({
    leads_delivered: FieldValue.increment(1),
  });

  const deliveryRef = await adminDb.collection('deliveries').add({
    lead_id:      lead.id,
    client_id:    resolvedClientId,
    method:       deliveryMethod,
    delivered_at: Date.now(),
    status:       'delivered',
  });

  console.log(`[distribute] ✓ Lead ${lead.id} → Client ${resolvedClientId} via ${deliveryMethod}`);

  return NextResponse.json({
    success:    true,
    method:     deliveryMethod,
    deliveryId: deliveryRef.id,
    errors:     errors.length > 0 ? errors : undefined,
  });
}
