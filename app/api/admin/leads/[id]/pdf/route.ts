/**
 * GET /api/admin/leads/[id]/pdf
 *
 * Generates a branded Settlement Sam lead report PDF using PDFKit.
 * Returns the PDF as an inline binary stream.
 * Requires admin JWT.
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import PDFDocument from 'pdfkit';
import { db } from '@/lib/db';
import type { DbLead } from '@/lib/db';
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

function bool(v: number | null) { return v ? 'Yes' : 'No'; }

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

function tierColor(tier: string): [number, number, number] {
  if (tier === 'HOT')  return [232, 168, 56];   // amber #E8A838
  if (tier === 'WARM') return [74,  124, 89];   // forest green #4A7C59
  return [107, 124, 116];                        // muted #6B7C74
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(params.id)) as DbLead | undefined;
  if (!lead) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Build PDF in memory
  const buffers: Buffer[] = [];
  const doc = new PDFDocument({ size: 'LETTER', margin: 60, info: {
    Title:   `Settlement Sam — Lead #${lead.id}`,
    Author:  'Settlement Sam',
    Subject: `Lead Report: ${lead.name}`,
  }});

  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  const pdfComplete = new Promise<Buffer>((resolve, reject) => {
    doc.on('end',   () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
  });

  // ── Brand header ────────────────────────────────────────────────────────────
  doc
    .rect(0, 0, doc.page.width, 80)
    .fill('#2C3E35');

  doc
    .fillColor('#E8A838')
    .fontSize(22)
    .font('Helvetica-Bold')
    .text('Settlement Sam', 60, 26);

  doc
    .fillColor('#6B7C74')
    .fontSize(10)
    .font('Helvetica')
    .text('Confidential Lead Report', 60, 52);

  doc
    .fillColor('#FDF6E9')
    .fontSize(10)
    .text(`Generated ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`, 60, 52, { align: 'right' });

  // ── Tier badge ───────────────────────────────────────────────────────────────
  const [r, g, b] = tierColor(lead.tier);
  doc.moveDown(3);

  const badgeY = doc.y;
  doc
    .roundedRect(60, badgeY, 120, 32, 8)
    .fillAndStroke(`rgb(${r},${g},${b})`, `rgb(${r},${g},${b})`);

  doc
    .fillColor('#ffffff')
    .fontSize(13)
    .font('Helvetica-Bold')
    .text(`${lead.tier} Lead`, 60, badgeY + 9, { width: 120, align: 'center' });

  // Score beside badge
  doc
    .fillColor('#2C3E35')
    .fontSize(11)
    .font('Helvetica')
    .text(`Score: ${lead.score}/150`, 200, badgeY + 10);

  doc.moveDown(2.5);

  // ── Section helper ───────────────────────────────────────────────────────────
  function section(title: string) {
    doc
      .fillColor('#E8DCC8')
      .rect(60, doc.y, doc.page.width - 120, 24)
      .fill();
    doc
      .fillColor('#4A7C59')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(title, 68, doc.y - 18);
    doc.moveDown(1);
  }

  function row(label: string, value: string) {
    const y = doc.y;
    doc.fillColor('#6B7C74').fontSize(9).font('Helvetica').text(label.toUpperCase(), 60, y);
    doc.fillColor('#2C3E35').fontSize(11).font('Helvetica').text(value, 220, y);
    doc.moveDown(0.6);
  }

  // ── Contact ──────────────────────────────────────────────────────────────────
  section('Contact Information');
  row('Name',       lead.name);
  row('Phone',      lead.phone);
  row('Carrier',    lead.carrier);
  row('Source',     lead.source.toUpperCase());
  row('Submitted',  new Date(lead.timestamp).toLocaleString());
  doc.moveDown(0.5);

  // ── Injury ───────────────────────────────────────────────────────────────────
  section('Injury Details');
  row('Injury Type',        injuryLabel(lead.injury_type));
  row('Surgery',            bool(lead.surgery));
  row('Hospitalized',       bool(lead.hospitalized));
  row('Still in Treatment', bool(lead.still_in_treatment));
  row('Missed Work',        bool(lead.missed_work));
  if (lead.missed_work_days) row('Days Missed', `${lead.missed_work_days} days`);
  row('Lost Wages',         lead.lost_wages > 0 ? formatCurrency(lead.lost_wages) : '$0');
  doc.moveDown(0.5);

  // ── Estimate ─────────────────────────────────────────────────────────────────
  section('Settlement Estimate');
  row('Range', `${formatCurrency(lead.estimate_low)} – ${formatCurrency(lead.estimate_high)}`);
  row('Score', String(lead.score));
  row('Tier',  lead.tier);
  doc.moveDown(0.5);

  // ── Status ───────────────────────────────────────────────────────────────────
  section('Lead Status');
  row('Verified',  bool(lead.verified));
  row('Delivered', bool(lead.delivered));
  row('Disputed',  bool(lead.disputed));
  row('Replaced',  bool(lead.replaced));
  doc.moveDown(2);

  // ── Disclaimer ───────────────────────────────────────────────────────────────
  doc
    .fillColor('#6B7C74')
    .fontSize(8)
    .font('Helvetica')
    .text(
      'This report is confidential and for internal use only. Settlement estimates are based on general settlement data and are not legal advice. Results vary based on jurisdiction, facts, and applicable law.',
      60,
      doc.page.height - 80,
      { width: doc.page.width - 120, align: 'center' },
    );

  doc.end();
  const pdfBuffer = await pdfComplete;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="lead-${lead.id}-${lead.name.replace(/\s+/g, '-')}.pdf"`,
      'Content-Length':      String(pdfBuffer.length),
    },
  });
}
