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
import { adminDb } from '@/lib/firebase/admin';
import type { FsLead } from '@/lib/firebase/types';

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

  // Fetch all leads ordered by timestamp, then filter in memory
  const snap = await adminDb.collection('leads').orderBy('timestamp', 'desc').get();
  let leads  = snap.docs.map(d => ({ id: d.id, ...d.data() } as FsLead & { id: string }));

  if (tier)             leads = leads.filter(l => l.tier === tier);
  if (source)           leads = leads.filter(l => l.source === source);
  if (verified !== '')  leads = leads.filter(l => l.verified === (verified === '1'));
  if (search) {
    const s = search.toLowerCase();
    leads = leads.filter(l => l.name.toLowerCase().includes(s) || l.phone.includes(s));
  }

  const total     = leads.length;
  const offset    = (page - 1) * limit;
  const pageLeads = leads.slice(offset, offset + limit).map(l => ({
    id:                  l.id,
    name:                l.name,
    phone:               l.phone,
    injury_type:         l.injury_type,
    surgery:             l.surgery,
    hospitalized:        l.hospitalized,
    lost_wages_estimate: l.lost_wages_estimate,
    estimate_low:        l.estimate_low,
    estimate_high:       l.estimate_high,
    score:               l.score,
    tier:                l.tier,
    verified:            l.verified,
    source:              l.source,
    timestamp:           l.timestamp,
    delivered:           l.delivered,
    disputed:            l.disputed,
  }));

  return NextResponse.json({ leads: pageLeads, total, page, limit });
}
