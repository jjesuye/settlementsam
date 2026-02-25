/**
 * POST /api/verify-code
 *
 * Firebase Phone Auth replacement for the old email-to-SMS OTP system.
 * Accepts a Firebase ID token (from client-side Phone Auth confirmation),
 * verifies it server-side, creates a verified lead in Firestore,
 * and returns a JWT session token.
 *
 * Body: { idToken, name, email?,
 *         injuryType?, surgery?, lostWages?, estimateLow?, estimateHigh?,
 *         source?,              -- 'widget' | 'quiz'
 *         // Quiz-only extras:
 *         incidentType?, state?, incidentTimeframe?, atFault?,
 *         receivedTreatment?, hospitalized?, hasSurgery?, stillInTreatment?,
 *         missedWork?, insuranceContact?, hasAttorney? }
 *
 * Response 200: { success: true, token: string, score: number, tier: string }
 * Response 400: { error: string, message: string }
 * Response 401: { error: 'unauthorized', message: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { calculateScore, scoreTier, calculateQuizEstimate } from '@/lib/quiz/scoring';
import type { QuizAnswers } from '@/lib/quiz/types';
import { validateEmailServer } from '@/lib/validate-email-server';

export const dynamic = 'force-dynamic';

const JWT_SECRET  = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const TOKEN_TTL_S = 60 * 60 * 24; // 24-hour session

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  const {
    idToken,
    name,
    email,
    injuryType,
    surgery,
    lostWages,
    estimateLow,
    estimateHigh,
    source = 'widget',
    incidentType,
    incidentTimeframe,
    atFault,
    receivedTreatment,
    hospitalized,
    hasSurgery,
    stillInTreatment,
    missedWork,
    insuranceContact,
    hasAttorney,
    state: leadState,
  } = body;

  if (!idToken || typeof idToken !== 'string') {
    return NextResponse.json(
      { error: 'invalid_input', message: 'Firebase ID token is required.' },
      { status: 400 },
    );
  }

  // ── Email validation (server-side MX check when email is provided) ────────────
  if (email && typeof email === 'string' && email.trim()) {
    const emailError = await validateEmailServer(email);
    if (emailError) {
      return NextResponse.json(
        { error: 'invalid_email', message: emailError },
        { status: 400 },
      );
    }
  }

  // ── Verify Firebase ID token server-side ─────────────────────────────────────
  let phone: string;
  try {
    const decoded = await (adminAuth as any).verifyIdToken(idToken);
    const rawPhone = String(decoded.phone_number ?? '');
    if (!rawPhone) throw new Error('No phone_number claim in token');
    // Normalize to 10-digit (strip +1 country code)
    const digits = rawPhone.replace(/\D/g, '');
    phone = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    if (phone.length !== 10) throw new Error(`Unexpected phone length: ${phone.length}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[verify-code] Firebase token error:', msg);
    return NextResponse.json(
      { error: 'unauthorized', message: 'Phone verification failed. Please try again.' },
      { status: 401 },
    );
  }

  const now = Date.now();

  // ── Build quiz answers for scoring (quiz mode only) ───────────────────────────
  const isQuiz = String(source) === 'quiz';

  let score     = 0;
  let tier      = 'COLD';
  let finalLow  = Number(estimateLow  ?? 0);
  let finalHigh = Number(estimateHigh ?? 0);

  if (isQuiz) {
    const qa: QuizAnswers = {
      incidentType:      (incidentType      as QuizAnswers['incidentType'])      ?? null,
      state:             (leadState         as string)                           ?? null,
      incidentTimeframe: (incidentTimeframe as QuizAnswers['incidentTimeframe']) ?? null,
      atFault:           atFault            != null ? Boolean(atFault)           : null,
      receivedTreatment: (receivedTreatment as QuizAnswers['receivedTreatment']) ?? null,
      hospitalized:      hospitalized       != null ? Boolean(hospitalized)      : null,
      hasSurgery:        hasSurgery         != null ? Boolean(hasSurgery)        : null,
      stillInTreatment:  (stillInTreatment  as QuizAnswers['stillInTreatment'])  ?? null,
      missedWork:        (missedWork        as QuizAnswers['missedWork'])         ?? null,
      lostWages:         Number(lostWages   ?? 0),
      insuranceContact:  (insuranceContact  as QuizAnswers['insuranceContact'])  ?? null,
      hasAttorney:       (hasAttorney       as QuizAnswers['hasAttorney'])        ?? null,
    };

    score = calculateScore(qa);
    tier  = scoreTier(score);

    const est = calculateQuizEstimate(qa);
    finalLow  = est.low;
    finalHigh = est.high;
  }

  // ── Derive boolean field values ──────────────────────────────────────────────
  const hasSurgeryBool         = hasSurgery  != null ? Boolean(hasSurgery)  : Boolean(surgery);
  const hospitalizedBool       = hospitalized != null ? Boolean(hospitalized) : false;
  const stillTreatingBool      = stillInTreatment === 'yes';
  const missedWorkBool         = missedWork === 'yes_missed' || missedWork === 'yes_cant_work';
  const hasAttorneyBool        = hasAttorney === 'yes';
  const insuranceContactedBool = insuranceContact === 'they_contacted' || insuranceContact === 'got_letter';
  const atFaultBool            = Boolean(atFault);

  // ── Save verified lead to Firestore ──────────────────────────────────────────
  let leadId: string | null = null;

  try {
    const leadRef = await adminDb.collection('leads').add({
      name:                String(name  ?? '').trim(),
      phone,
      email:               email ? String(email).trim() : null,
      carrier:             'firebase',
      state:               String(leadState ?? '') || null,
      injury_type:         String(injuryType ?? 'soft_tissue'),
      surgery:             hasSurgeryBool,
      hospitalized:        hospitalizedBool,
      still_treating:      stillTreatingBool,
      missed_work:         missedWorkBool,
      lost_wages_estimate: Number(lostWages ?? 0),
      has_attorney:        hasAttorneyBool,
      insurance_contacted: insuranceContactedBool,
      at_fault:            atFaultBool,
      estimate_low:        finalLow,
      estimate_high:       finalHigh,
      score,
      tier,
      verified:            true,
      source:              String(source ?? 'widget'),
      timestamp:           now,
      delivered:           false,
      replaced:            false,
      disputed:            false,
      client_id:           null,
      incident_timeframe:  String(incidentTimeframe ?? '') || null,
      statute_warning:     false,
      disqualified:        false,
      disqualify_reason:   null,
    });
    leadId = leadRef.id;
  } catch (err: unknown) {
    console.error('[verify-code] Lead insert error:', err instanceof Error ? err.message : err);
  }

  // ── Issue JWT session token ──────────────────────────────────────────────────
  const token = jwt.sign(
    { phone, leadId, role: 'lead', source },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL_S },
  );

  console.log(
    `[verify-code] ✓ ${String(source).toUpperCase()} lead verified: ` +
    `${String(name ?? '').trim()} (${phone}) score=${score} tier=${tier}`,
  );

  return NextResponse.json({ success: true, token, score, tier });
}
