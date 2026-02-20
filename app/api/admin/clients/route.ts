/**
 * GET  /api/admin/clients  — list all clients
 * POST /api/admin/clients  — create a new client
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';

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

  const clients = db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
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
    return NextResponse.json({ error: 'invalid_input', message: 'name, firm, and email are required.' }, { status: 400 });
  }

  try {
    const result = db.prepare(`
      INSERT INTO clients (name, firm, email, sheets_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      String(name), String(firm), String(email),
      sheets_id ? String(sheets_id) : null,
      Date.now(),
    );
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ client }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'duplicate', message: 'A client with that email already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'db_error', message: msg }, { status: 500 });
  }
}
