/**
 * GET /api/admin/stats
 * Returns pipeline overview stats for the dashboard header cards.
 * Requires admin JWT.
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

  const leads  = adminDb.collection('leads');
  const vcodes = adminDb.collection('verification_codes');
  const since7d = Date.now() - 7 * 24 * 60 * 60 * 1_000;

  const [
    totalSnap, verifiedSnap, hotSnap, warmSnap, coldSnap,
    deliveredSnap, disputedSnap, recent7dSnap,
    smsSentSnap, smsUsedSnap, verifiedScoreSnap,
  ] = await Promise.all([
    leads.count().get(),
    leads.where('verified', '==', true).count().get(),
    leads.where('tier', '==', 'HOT').count().get(),
    leads.where('tier', '==', 'WARM').count().get(),
    leads.where('tier', '==', 'COLD').count().get(),
    leads.where('delivered', '==', true).count().get(),
    leads.where('disputed', '==', true).count().get(),
    leads.where('timestamp', '>', since7d).count().get(),
    vcodes.count().get(),
    vcodes.where('used', '==', true).count().get(),
    leads.where('verified', '==', true).select('score').get(),
  ]);

  const total     = totalSnap.data().count;
  const verified  = verifiedSnap.data().count;
  const hot       = hotSnap.data().count;
  const warm      = warmSnap.data().count;
  const cold      = coldSnap.data().count;
  const delivered = deliveredSnap.data().count;
  const disputed  = disputedSnap.data().count;
  const recent7d  = recent7dSnap.data().count;
  const smsSent   = smsSentSnap.data().count;
  const smsUsed   = smsUsedSnap.data().count;

  const scores   = verifiedScoreSnap.docs.map(d => Number(d.data().score ?? 0));
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  return NextResponse.json({
    total, verified, hot, warm, cold,
    delivered, disputed, recent7d,
    smsSent, smsUsed,
    avgScore,
    conversionRate: total > 0 ? Math.round((verified / total) * 100) : 0,
  });
}
