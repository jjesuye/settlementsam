/**
 * GET /api/admin/stats
 * Returns pipeline overview stats for the dashboard header cards.
 * Requires admin JWT.
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

  const total     = (db.prepare('SELECT COUNT(*) AS n FROM leads').get() as { n: number }).n;
  const verified  = (db.prepare('SELECT COUNT(*) AS n FROM leads WHERE verified = 1').get() as { n: number }).n;
  const hot       = (db.prepare("SELECT COUNT(*) AS n FROM leads WHERE tier = 'HOT'").get() as { n: number }).n;
  const warm      = (db.prepare("SELECT COUNT(*) AS n FROM leads WHERE tier = 'WARM'").get() as { n: number }).n;
  const cold      = (db.prepare("SELECT COUNT(*) AS n FROM leads WHERE tier = 'COLD'").get() as { n: number }).n;
  const delivered = (db.prepare('SELECT COUNT(*) AS n FROM leads WHERE delivered = 1').get() as { n: number }).n;
  const disputed  = (db.prepare('SELECT COUNT(*) AS n FROM leads WHERE disputed = 1').get() as { n: number }).n;

  // Last 7 days
  const since7d  = Date.now() - 7 * 24 * 60 * 60 * 1_000;
  const recent7d = (db.prepare('SELECT COUNT(*) AS n FROM leads WHERE timestamp > ?').get(since7d) as { n: number }).n;

  // SMS stats
  const smsSent  = (db.prepare('SELECT COUNT(*) AS n FROM verification_codes').get() as { n: number }).n;
  const smsUsed  = (db.prepare('SELECT COUNT(*) AS n FROM verification_codes WHERE used = 1').get() as { n: number }).n;

  // Avg score
  const avgScore = (db.prepare('SELECT AVG(score) AS avg FROM leads WHERE verified = 1').get() as { avg: number | null }).avg ?? 0;

  return NextResponse.json({
    total, verified, hot, warm, cold,
    delivered, disputed, recent7d,
    smsSent, smsUsed,
    avgScore: Math.round(avgScore),
    conversionRate: total > 0 ? Math.round((verified / total) * 100) : 0,
  });
}
