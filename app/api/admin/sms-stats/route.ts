/**
 * GET /api/admin/sms-stats
 * Returns SMS verification stats for the SMS Controls tab.
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';
import { CARRIERS } from '@/lib/sms';

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

  const total    = (db.prepare('SELECT COUNT(*) AS n FROM verification_codes').get() as { n: number }).n;
  const verified = (db.prepare('SELECT COUNT(*) AS n FROM verification_codes WHERE used = 1').get() as { n: number }).n;
  const expired  = (db.prepare('SELECT COUNT(*) AS n FROM verification_codes WHERE used = 0 AND expires_at < ?').get(Date.now()) as { n: number }).n;
  const pending  = total - verified - expired;

  // Carrier breakdown from leads table
  const carrierRows = db.prepare(`
    SELECT carrier, COUNT(*) AS count
    FROM leads
    WHERE carrier != ''
    GROUP BY carrier
    ORDER BY count DESC
  `).all() as { carrier: string; count: number }[];

  const carrierBreakdown = carrierRows.map(r => ({
    gateway: r.carrier,
    label:   CARRIERS[r.carrier] ?? r.carrier,
    count:   r.count,
  }));

  // Recent failed attempts
  const recentFailed = db.prepare(`
    SELECT phone, attempts, created_at, expires_at, used
    FROM verification_codes
    WHERE attempts > 2
    ORDER BY created_at DESC
    LIMIT 20
  `).all();

  return NextResponse.json({
    total, verified, expired, pending,
    conversionRate: total > 0 ? Math.round((verified / total) * 100) : 0,
    carrierBreakdown,
    recentFailed,
  });
}
