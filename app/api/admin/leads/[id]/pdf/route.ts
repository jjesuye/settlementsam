/**
 * GET /api/admin/leads/[id]/pdf
 *
 * Generates a professional Settlement Sam lead report PDF using PDFKit.
 * Returns the PDF as an inline binary stream.
 * Requires admin JWT.
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import PDFDocument from 'pdfkit';
import { adminDb } from '@/lib/firebase/admin';
import type { FsLead } from '@/lib/firebase/types';
import { formatCurrency } from '@/lib/estimator/logic';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

function verifyAdmin(req: NextRequest): boolean {
  try {
    const auth = req.headers.get('authorization') ?? '';
    const tok  = auth.replace(/^Bearer\s+/i, '');
    const p    = jwt.verify(tok, JWT_SECRET) as { role?: string };
    return p.role === 'admin';
  } catch { return false; }
}

function bool(v: boolean | null) { return v ? 'Yes' : 'No'; }

function urgencyLabel(u: string) {
  const map: Record<string, string> = {
    asap:      'As soon as possible',
    today:     'Today',
    this_week: 'This week',
  };
  return map[u] ?? u;
}

function injuryLabel(t: string) {
  const map: Record<string, string> = {
    soft_tissue: 'Soft Tissue (Sprains / Whiplash)',
    fracture:    'Broken Bone / Fracture',
    tbi:         'Head Injury / TBI',
    spinal:      'Spinal Cord Injury',
    other:       'Other / Multiple',
  };
  return map[t] ?? t;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const docSnap = await adminDb.collection('leads').doc(params.id).get();
  if (!docSnap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const lead = { id: docSnap.id, ...docSnap.data() } as FsLead & { id: string };

  const buffers: Buffer[] = [];
  const pdf = new PDFDocument({
    size: 'LETTER', margin: 72,
    info: {
      Title:   `Lead Report — ${lead.name}`,
      Author:  'Settlement Sam',
      Subject: `Lead ID ${lead.id}`,
    },
  });

  pdf.on('data', (chunk: Buffer) => buffers.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    pdf.on('end',   () => resolve(Buffer.concat(buffers)));
    pdf.on('error', reject);
  });

  const W    = pdf.page.width - 144; // content width (margins on both sides)
  const LEFT = 72;

  // ── Header ───────────────────────────────────────────────────────────────────
  pdf.font('Helvetica-Bold').fontSize(20).fillColor('#1A1A1A')
    .text('Settlement Sam', LEFT, 72);
  pdf.font('Helvetica').fontSize(10).fillColor('#666666')
    .text('Confidential Lead Report', LEFT, 96);
  pdf.font('Helvetica').fontSize(10).fillColor('#666666')
    .text(
      `Generated: ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`,
      LEFT, 96, { width: W, align: 'right' },
    );

  // Divider
  pdf.moveTo(LEFT, 118).lineTo(LEFT + W, 118).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
  pdf.moveDown(0.5);

  // ── Lead tier + score summary ─────────────────────────────────────────────
  pdf.y = 134;
  pdf.font('Helvetica-Bold').fontSize(13).fillColor('#1A1A1A')
    .text(`${lead.tier} — Score ${lead.score} / 150`, LEFT);
  pdf.font('Helvetica').fontSize(11).fillColor('#444444')
    .text(
      `Estimated Value: ${formatCurrency(lead.estimate_low)} – ${formatCurrency(lead.estimate_high)}`,
      LEFT,
    );
  pdf.moveDown(1.2);

  // ── Section/row helpers ───────────────────────────────────────────────────
  function sectionHeader(title: string) {
    pdf.moveDown(0.6);
    pdf.font('Helvetica-Bold').fontSize(11).fillColor('#1A1A1A').text(title.toUpperCase(), LEFT);
    pdf.moveTo(LEFT, pdf.y + 2).lineTo(LEFT + W, pdf.y + 2)
      .strokeColor('#DDDDDD').lineWidth(0.5).stroke();
    pdf.moveDown(0.8);
  }

  function row(label: string, value: string) {
    const y = pdf.y;
    pdf.font('Helvetica').fontSize(9).fillColor('#888888')
      .text(label, LEFT, y, { width: 150, continued: false });
    pdf.font('Helvetica').fontSize(10).fillColor('#1A1A1A')
      .text(value, LEFT + 160, y, { width: W - 160 });
    pdf.moveDown(0.55);
  }

  // ── Contact Information ───────────────────────────────────────────────────
  sectionHeader('Contact Information');
  row('Name',            lead.name);
  row('Phone',           lead.phone);
  row('Email',           lead.email ?? 'Not provided');
  row('Source',          lead.source === 'quiz' ? 'Online Quiz' : 'Widget');
  row('Date Submitted',  new Date(lead.timestamp).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }));
  row('Phone Verified',  bool(lead.verified));

  // ── Incident Details ──────────────────────────────────────────────────────
  sectionHeader('Incident Details');
  row('Injury Type',         injuryLabel(lead.injury_type));
  row('State',               lead.state ?? 'Not specified');
  row('Incident Timeframe',  lead.incident_timeframe ?? 'Not specified');
  row('At Fault',            bool(lead.at_fault));

  // ── Medical & Treatment ───────────────────────────────────────────────────
  sectionHeader('Medical and Treatment');
  row('Received Treatment',  bool(lead.verified));   // proxy for treatment
  row('Hospitalized',        bool(lead.hospitalized));
  row('Surgery Performed',   bool(lead.surgery));
  row('Still in Treatment',  bool(lead.still_treating));

  // ── Financial Impact ──────────────────────────────────────────────────────
  sectionHeader('Financial Impact');
  row('Missed Work',          bool(lead.missed_work));
  row('Lost Wages Estimate',  lead.lost_wages_estimate > 0 ? formatCurrency(lead.lost_wages_estimate) : 'Not reported');
  row('Has Attorney',         bool(lead.has_attorney));
  row('Insurance Contacted',  bool(lead.insurance_contacted));

  // ── Settlement Estimate ───────────────────────────────────────────────────
  sectionHeader('Settlement Estimate');
  row('Estimated Range',  `${formatCurrency(lead.estimate_low)} – ${formatCurrency(lead.estimate_high)}`);
  row('Lead Score',       `${lead.score} / 150`);
  row('Tier',             lead.tier);

  // ── Lead Status ───────────────────────────────────────────────────────────
  sectionHeader('Lead Status');
  row('Delivered',  bool(lead.delivered));
  row('Disputed',   bool(lead.disputed));
  row('Replaced',   bool(lead.replaced));
  if (lead.client_id) row('Assigned Client', String(lead.client_id));

  // ── Contact Preference ────────────────────────────────────────────────────
  sectionHeader('Contact Preference');
  const cp = (lead as typeof lead & { contact_preference?: { urgency: string; preferred_hours: string[]; timezone: string } | null }).contact_preference;
  if (cp) {
    row('Best Time to Reach', urgencyLabel(cp.urgency));
    row('Preferred Hours',    cp.preferred_hours.map(h => h.charAt(0).toUpperCase() + h.slice(1)).join(', '));
    row('Timezone',           cp.timezone || 'Not provided');
  } else {
    row('Contact Preference', 'Not collected');
  }

  // ── Disclaimer ────────────────────────────────────────────────────────────
  pdf.moveDown(2);
  pdf.moveTo(LEFT, pdf.y).lineTo(LEFT + W, pdf.y).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
  pdf.moveDown(0.5);
  pdf.font('Helvetica').fontSize(8).fillColor('#999999').text(
    'This report is confidential and intended for internal use only. Settlement estimates are derived from general case data and do not constitute legal advice. Actual results vary based on jurisdiction, specific facts, and applicable law.',
    LEFT, pdf.y, { width: W, align: 'center' },
  );

  pdf.end();
  const pdfBuffer = await done;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="lead-${lead.id}.pdf"`,
      'Content-Length':      String(pdfBuffer.length),
    },
  });
}
