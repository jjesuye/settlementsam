/**
 * GET  /api/admin/clients  — list all clients
 * POST /api/admin/clients  — create a new client
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

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const snap    = await adminDb.collection('clients').orderBy('created_at', 'desc').get();
  const clients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { name, firm, email, sheets_id } = body;

  if (!name || !firm || !email) {
    return NextResponse.json(
      { error: 'invalid_input', message: 'name, firm, and email are required.' },
      { status: 400 },
    );
  }

  // Email uniqueness check
  const existing = await adminDb
    .collection('clients')
    .where('email', '==', String(email))
    .limit(1)
    .get();

  if (!existing.empty) {
    return NextResponse.json(
      { error: 'duplicate', message: 'A client with that email already exists.' },
      { status: 409 },
    );
  }

  const docRef = await adminDb.collection('clients').add({
    name:               String(name),
    firm:               String(firm),
    email:              String(email),
    sheets_id:          sheets_id ? String(sheets_id) : null,
    leads_purchased:    0,
    leads_delivered:    0,
    leads_replaced:     0,
    balance:            0,
    stripe_customer_id: null,
    created_at:         Date.now(),
  });

  const doc = await docRef.get();
  return NextResponse.json({ client: { id: doc.id, ...doc.data() } }, { status: 201 });
}
