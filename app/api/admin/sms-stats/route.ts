/**
 * GET /api/admin/sms-stats
 * Returns SMS verification stats for the SMS Controls tab.
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { adminDb } from '@/lib/firebase/admin';
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

  const vcodes = adminDb.collection('verification_codes');

  const [totalSnap, verifiedSnap, allCodesSnap, carrierSnap, failedSnap] = await Promise.all([
    vcodes.count().get(),
    vcodes.where('used', '==', true).count().get(),
    vcodes.where('used', '==', false).select('expires_at').get(),
    adminDb.collection('leads').select('carrier').get(),
    vcodes.where('attempts', '>', 2).orderBy('attempts', 'desc').limit(20).get(),
  ]);

  const total    = totalSnap.data().count;
  const verified = verifiedSnap.data().count;

  // Count expired in memory (avoids compound inequality index requirement)
  const now     = Date.now();
  const expired = allCodesSnap.docs.filter(d => (d.data().expires_at as number) < now).length;
  const pending = total - verified - expired;

  // Carrier breakdown from leads
  const carrierMap: Record<string, number> = {};
  for (const doc of carrierSnap.docs) {
    const c = String(doc.data().carrier ?? '');
    if (c) carrierMap[c] = (carrierMap[c] ?? 0) + 1;
  }

  const carrierBreakdown = Object.entries(carrierMap)
    .sort((a, b) => b[1] - a[1])
    .map(([gateway, count]) => ({
      gateway,
      label: CARRIERS[gateway] ?? gateway,
      count,
    }));

  const recentFailed = failedSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  return NextResponse.json({
    total, verified, expired, pending,
    conversionRate: total > 0 ? Math.round((verified / total) * 100) : 0,
    carrierBreakdown,
    recentFailed,
  });
}
