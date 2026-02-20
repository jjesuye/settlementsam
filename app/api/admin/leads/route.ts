/**
 * GET /api/admin/leads
 *
 * Returns paginated, filtered lead list for the pipeline tab.
 * Query params:
 *   tier      – HOT | WARM | COLD (optional)
 *   source    – widget | quiz (optional)
 *   verified  – 1 | 0 (optional)
 *   search    – name/phone substring (optional)
 *   page      – page number (default 1)
 *   limit     – page size (default 50, max 200)
 *
 * Requires Authorization: Bearer <admin-jwt>
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

function verifyAdmin(req: NextRequest): boolean {
  try {
    const auth = req.headers.get('authorization') ?? '';
    const tok  = auth.replace(/^Bearer\s+/i, '');
    const payload = jwt.verify(tok, JWT_SECRET) as { role?: string };
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tier     = searchParams.get('tier')     ?? '';
  const source   = searchParams.get('source')   ?? '';
  const verified = searchParams.get('verified') ?? '';
  const search   = searchParams.get('search')   ?? '';
  const page     = Math.max(1, parseInt(searchParams.get('page')  ?? '1'));
  const limit    = Math.min(200, parseInt(searchParams.get('limit') ?? '50'));
  const offset   = (page - 1) * limit;

  const conditions: string[] = [];
  const params: (string | number | null)[] = [];

  if (tier)     { conditions.push('tier = ?');     params.push(tier); }
  if (source)   { conditions.push('source = ?');   params.push(source); }
  if (verified !== '') { conditions.push('verified = ?'); params.push(Number(verified)); }
  if (search)   {
    conditions.push('(name LIKE ? OR phone LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = (db.prepare(`SELECT COUNT(*) AS n FROM leads ${where}`).get(...params) as { n: number }).n;

  const rows = db.prepare(
    `SELECT id, name, phone, injury_type, surgery, hospitalized,
            lost_wages, estimate_low, estimate_high,
            score, tier, verified, source, timestamp, delivered, disputed
     FROM leads ${where}
     ORDER BY timestamp DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return NextResponse.json({ leads: rows, total, page, limit });
}
