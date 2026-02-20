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
  if (tier === 'HOT')  return [232, 168, 56];
  if (tier === 'WARM') return [74,  124, 89];
  return [107, 124, 116];
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const doc = await adminDb.collection('leads').doc(params.id).get();
  if (!doc.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const lead = { id: doc.id, ...doc.data() } as FsLead & { id: string };

  // Build PDF in memory
  const buffers: Buffer[] = [];
  const pdfDoc = new PDFDocument({ size: 'LETTER', margin: 60, info: {
    Title:   `Settlement Sam — Lead ${lead.id}`,
    Author:  'Settlement Sam',
    Subject: `Lead Report: ${lead.name}`,
  }});

  pdfDoc.on('data', (chunk: Buffer) => buffers.push(chunk));

  const pdfComplete = new Promise<Buffer>((resolve, reject) => {
    pdfDoc.on('end',   () => resolve(Buffer.concat(buffers)));
    pdfDoc.on('error', reject);
  });

  // ── Brand header ─────────────────────────────────────────────────────────────
  pdfDoc.rect(0, 0, pdfDoc.page.width, 80).fill('#2C3E35');
  pdfDoc.fillColor('#E8A838').fontSize(22).font('Helvetica-Bold').text('Settlement Sam', 60, 26);
  pdfDoc.fillColor('#6B7C74').fontSize(10).font('Helvetica').text('Confidential Lead Report', 60, 52);
  pdfDoc.fillColor('#FDF6E9').fontSize(10).text(
    `Generated ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`, 60, 52, { align: 'right' },
  );

  // ── Tier badge ────────────────────────────────────────────────────────────────
  const [r, g, b] = tierColor(lead.tier);
  pdfDoc.moveDown(3);
  const badgeY = pdfDoc.y;
  pdfDoc.roundedRect(60, badgeY, 120, 32, 8).fillAndStroke(`rgb(${r},${g},${b})`, `rgb(${r},${g},${b})`);
  pdfDoc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold')
    .text(`${lead.tier} Lead`, 60, badgeY + 9, { width: 120, align: 'center' });
  pdfDoc.fillColor('#2C3E35').fontSize(11).font('Helvetica')
    .text(`Score: ${lead.score}/150`, 200, badgeY + 10);
  pdfDoc.moveDown(2.5);

  // ── Section helper ────────────────────────────────────────────────────────────
  function section(title: string) {
    pdfDoc.fillColor('#E8DCC8').rect(60, pdfDoc.y, pdfDoc.page.width - 120, 24).fill();
    pdfDoc.fillColor('#4A7C59').fontSize(11).font('Helvetica-Bold').text(title, 68, pdfDoc.y - 18);
    pdfDoc.moveDown(1);
  }

  function row(label: string, value: string) {
    const y = pdfDoc.y;
    pdfDoc.fillColor('#6B7C74').fontSize(9).font('Helvetica').text(label.toUpperCase(), 60, y);
    pdfDoc.fillColor('#2C3E35').fontSize(11).font('Helvetica').text(value, 220, y);
    pdfDoc.moveDown(0.6);
  }

  // ── Contact ───────────────────────────────────────────────────────────────────
  section('Contact Information');
  row('Name',       lead.name);
  row('Phone',      lead.phone);
  row('Carrier',    lead.carrier);
  row('Source',     lead.source.toUpperCase());
  row('Submitted',  new Date(lead.timestamp).toLocaleString());
  pdfDoc.moveDown(0.5);

  // ── Injury ────────────────────────────────────────────────────────────────────
  section('Injury Details');
  row('Injury Type',        injuryLabel(lead.injury_type));
  row('Surgery',            bool(lead.surgery));
  row('Hospitalized',       bool(lead.hospitalized));
  row('Still in Treatment', bool(lead.still_treating));
  row('Missed Work',        bool(lead.missed_work));
  row('Lost Wages',         lead.lost_wages_estimate > 0 ? formatCurrency(lead.lost_wages_estimate) : '$0');
  pdfDoc.moveDown(0.5);

  // ── Estimate ──────────────────────────────────────────────────────────────────
  section('Settlement Estimate');
  row('Range', `${formatCurrency(lead.estimate_low)} – ${formatCurrency(lead.estimate_high)}`);
  row('Score', String(lead.score));
  row('Tier',  lead.tier);
  pdfDoc.moveDown(0.5);

  // ── Status ────────────────────────────────────────────────────────────────────
  section('Lead Status');
  row('Verified',  bool(lead.verified));
  row('Delivered', bool(lead.delivered));
  row('Disputed',  bool(lead.disputed));
  row('Replaced',  bool(lead.replaced));
  pdfDoc.moveDown(2);

  // ── Disclaimer ────────────────────────────────────────────────────────────────
  pdfDoc.fillColor('#6B7C74').fontSize(8).font('Helvetica').text(
    'This report is confidential and for internal use only. Settlement estimates are based on general settlement data and are not legal advice. Results vary based on jurisdiction, facts, and applicable law.',
    60, pdfDoc.page.height - 80,
    { width: pdfDoc.page.width - 120, align: 'center' },
  );

  pdfDoc.end();
  const pdfBuffer = await pdfComplete;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="lead-${lead.id}-${lead.name.replace(/\s+/g, '-')}.pdf"`,
      'Content-Length':      String(pdfBuffer.length),
    },
  });
}
