/**
 * POST /api/distribute
 *
 * Distributes a verified lead to its assigned client via email (and optionally
 * Google Sheets). Enforces duplicate-delivery prevention and logs to SQLite.
 *
 * Body: { leadId: number, clientId?: number, method?: 'email' | 'sheets' | 'both' }
 *
 * Response 200: { success: true, method: string, deliveryId: number }
 * Response 400: { error: string, message: string }
 * Response 409: { error: 'already_delivered', message: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';
import type { DbLead, DbClient } from '@/lib/db';
import { sendLeadEmail }          from '@/lib/distribution/email';
import { appendLeadToSheet }      from '@/lib/distribution/sheets';

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
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(leadId)) as DbLead | undefined;
  if (!lead) return NextResponse.json({ error: 'not_found', message: 'Lead not found.' }, { status: 404 });

  // ── Duplicate check ───────────────────────────────────────────────────────────
  if (lead.delivered) {
    return NextResponse.json(
      { error: 'already_delivered', message: `Lead #${lead.id} was already delivered.` },
      { status: 409 },
    );
  }

  // ── Resolve client ────────────────────────────────────────────────────────────
  const resolvedClientId = clientId ?? lead.client_id;
  if (!resolvedClientId) {
    return NextResponse.json({ error: 'no_client', message: 'No client assigned to this lead. Set clientId or assign via lead profile.' }, { status: 400 });
  }

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(resolvedClientId)) as DbClient | undefined;
  if (!client) return NextResponse.json({ error: 'client_not_found', message: 'Client not found.' }, { status: 404 });

  // ── Deliver ───────────────────────────────────────────────────────────────────
  const deliveryMethod = String(method);
  const errors: string[] = [];

  // Email delivery
  if (deliveryMethod === 'email' || deliveryMethod === 'both') {
    try {
      await sendLeadEmail(lead, client);
    } catch (err: unknown) {
      errors.push(`Email: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  // Google Sheets delivery
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

  // ── Mark delivered in DB ─────────────────────────────────────────────────────
  const now = Date.now();
  db.prepare('UPDATE leads SET delivered = 1, client_id = ? WHERE id = ?').run(Number(resolvedClientId), lead.id);
  db.prepare('UPDATE clients SET leads_delivered = leads_delivered + 1 WHERE id = ?').run(Number(resolvedClientId));

  const deliveryResult = db.prepare(`
    INSERT INTO deliveries (lead_id, client_id, method, delivered_at, status)
    VALUES (?, ?, ?, ?, 'delivered')
  `).run(lead.id, Number(resolvedClientId), deliveryMethod, now);

  console.log(`[distribute] ✓ Lead #${lead.id} → Client #${resolvedClientId} via ${deliveryMethod}`);

  return NextResponse.json({
    success:    true,
    method:     deliveryMethod,
    deliveryId: deliveryResult.lastInsertRowid,
    errors:     errors.length > 0 ? errors : undefined,
  });
}
