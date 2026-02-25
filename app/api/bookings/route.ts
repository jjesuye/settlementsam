/**
 * POST /api/bookings
 * GET  /api/bookings  (admin only — returns all bookings)
 *
 * POST: Save a new attorney booking to Firestore and send confirmation email.
 *       Also checks for reminders on upcoming bookings (24hr before).
 *
 * Body: { name, firm, email, phone, state, case_volume, date, time }
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;

function verifyAdmin(req: NextRequest): boolean {
  try {
    const auth = req.headers.get('authorization') ?? '';
    const tok  = auth.replace(/^Bearer\s+/i, '');
    const p    = jwt.verify(tok, JWT_SECRET) as { role?: string };
    return p.role === 'admin';
  } catch { return false; }
}

function createMailer() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });
}

// ── Send reminder for upcoming bookings ──────────────────────────────────────

async function sendPendingReminders() {
  const now         = Date.now();
  const in24h       = now + 24 * 60 * 60 * 1000;
  const tomorrow    = new Date(in24h).toISOString().split('T')[0];
  const today       = new Date(now).toISOString().split('T')[0];

  const snap = await adminDb
    .collection('bookings')
    .where('status', '==', 'confirmed')
    .where('reminder_sent', '==', false)
    .where('date', 'in', [today, tomorrow])
    .get();

  const mailer = GMAIL_USER && GMAIL_PASS ? createMailer() : null;

  for (const doc of snap.docs) {
    const b = doc.data();
    if (mailer) {
      try {
        await mailer.sendMail({
          from:    `"Settlement Sam" <${GMAIL_USER}>`,
          to:      b.email as string,
          subject: `Reminder: Your Settlement Sam Demo Tomorrow at ${b.time}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#2C3E35">
              <h2 style="color:#E8A838">Just a quick reminder, ${(b.name as string).split(' ')[0]}!</h2>
              <p>Your Settlement Sam demo call is scheduled for:</p>
              <div style="background:#FDF6E9;border-radius:10px;padding:16px 20px;margin:16px 0">
                <strong>${b.date}</strong> at <strong>${b.time} EST</strong>
              </div>
              <p>On the call we'll cover your current lead options, pricing, and how to get started the same day.</p>
              <p>Need to reschedule? Reply to this email and we'll find a time that works.</p>
              <p style="margin-top:24px">— Sam & the Settlement Sam Team</p>
            </div>
          `,
        });
      } catch { /* non-fatal */ }
    }
    await doc.ref.update({ reminder_sent: true });
  }
}

// ── POST — create booking ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch {
    return NextResponse.json({ error: 'invalid_json', message: 'Invalid JSON.' }, { status: 400 });
  }

  const { name, firm, email, phone, state, case_volume, date, time } = body;

  if (!name || !firm || !email || !phone || !state || !date || !time) {
    return NextResponse.json({ error: 'invalid_input', message: 'All fields are required.' }, { status: 400 });
  }

  // Slot collision check
  const existing = await adminDb
    .collection('bookings')
    .where('date', '==', String(date))
    .where('time', '==', String(time))
    .where('status', '==', 'confirmed')
    .get();

  if (!existing.empty) {
    return NextResponse.json(
      { error: 'slot_taken', message: 'That slot was just taken. Please pick another time.' },
      { status: 409 },
    );
  }

  // Save booking
  const docRef = await adminDb.collection('bookings').add({
    name:          String(name).trim(),
    firm:          String(firm).trim(),
    email:         String(email).trim().toLowerCase(),
    phone:         String(phone).trim(),
    state:         String(state).trim(),
    case_volume:   String(case_volume ?? '').trim(),
    date:          String(date),
    time:          String(time),
    status:        'confirmed',
    created_at:    Date.now(),
    reminder_sent: false,
  });

  // Send confirmation email
  if (GMAIL_USER && GMAIL_PASS) {
    const firstName = String(name).split(' ')[0];
    try {
      const mailer = createMailer();
      await mailer.sendMail({
        from:    `"Settlement Sam" <${GMAIL_USER}>`,
        to:      String(email),
        subject: `Your Settlement Sam Demo — ${date} at ${time}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#2C3E35">
            <img src="https://settlement-sam-77db2.web.app/images/sam-icons/sam-logo.png"
              alt="Settlement Sam" style="width:64px;border-radius:50%;display:block;margin:0 auto 16px" />
            <h2 style="color:#E8A838;text-align:center">You're confirmed, ${firstName}!</h2>
            <p>Your Settlement Sam demo call is booked for:</p>
            <div style="background:#FDF6E9;border-radius:10px;padding:20px 24px;margin:20px 0;text-align:center">
              <div style="font-size:22px;font-weight:700;color:#2C3E35">${date}</div>
              <div style="font-size:18px;color:#4A7C59;font-weight:600;margin-top:4px">${time} EST</div>
            </div>
            <h3 style="margin-top:24px">On the call we'll cover:</h3>
            <ul style="line-height:2">
              <li>Current lead inventory in your state (${state})</li>
              <li>Lead quality samples and how screening works</li>
              <li>Volume pricing and exclusivity terms</li>
              <li>How the replacement guarantee works</li>
            </ul>
            <p>Need to reschedule? Just reply to this email and we'll find another time.</p>
            <hr style="border:none;border-top:1px solid #E8DCC8;margin:32px 0" />
            <p style="font-size:12px;color:#6B7C74;text-align:center">
              Settlement Sam · Pre-screened PI leads for personal injury attorneys
            </p>
          </div>
        `,
      });
    } catch (err) {
      console.error('[bookings] Confirmation email error:', err instanceof Error ? err.message : err);
    }
  }

  // Check and send any pending reminders (piggyback on this request)
  try { await sendPendingReminders(); } catch { /* non-fatal */ }

  return NextResponse.json({ success: true, id: docRef.id });
}

// ── GET — list bookings (admin only) ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const snap = await adminDb
    .collection('bookings')
    .orderBy('date', 'asc')
    .orderBy('time', 'asc')
    .get();

  const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ bookings });
}

// ── PATCH — update booking status (admin only) ───────────────────────────────

export async function PATCH(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { id, status } = body;
  if (!id || !status) {
    return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
  }

  const allowed = ['confirmed', 'cancelled', 'completed'];
  if (!allowed.includes(String(status))) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  await adminDb.collection('bookings').doc(String(id)).update({ status: String(status) });
  return NextResponse.json({ success: true });
}
