/**
 * POST /api/verify-code
 *
 * Accepts { phone, code, name, carrier, injuryType, surgery,
 *           lostWages, estimateLow, estimateHigh,
 *           source?,           -- 'widget' | 'quiz'
 *           // Quiz-only extras (spread from QuizAnswers):
 *           incidentType?, state?, incidentTimeframe?, atFault?,
 *           receivedTreatment?, hospitalized?, hasSurgery?, stillInTreatment?,
 *           missedWork?, insuranceContact?, hasAttorney? }
 *
 * Validates OTP, marks it used, saves verified lead to Firestore (with quiz
 * scoring when source='quiz'), and returns a JWT session token.
 *
 * Response 200: { success: true, token: string }
 * Response 400: { error: string, message: string }
 * Response 429: { error: 'too_many_attempts', message: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { adminDb } from '@/lib/firebase/admin';
import { normalizePhone, MAX_ATTEMPTS } from '@/lib/sms';
import { calculateScore, scoreTier, calculateQuizEstimate } from '@/lib/quiz/scoring';
import type { QuizAnswers } from '@/lib/quiz/types';

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
    phone: rawPhone,
    code,
    name,
    carrier,
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

  const phone = normalizePhone(String(rawPhone ?? ''));

  if (!phone || String(code ?? '').replace(/\D/g, '').length !== 4) {
    return NextResponse.json(
      { error: 'invalid_input', message: 'Phone number and 4-digit code are both required.' },
      { status: 400 },
    );
  }

  // ── Fetch active codes for this phone ────────────────────────────────────────
  const snap = await adminDb
    .collection('verification_codes')
    .where('phone', '==', phone)
    .where('used', '==', false)
    .get();

  const now         = Date.now();
  const activeDocs  = snap.docs
    .filter(d => (d.data().expires_at as number) > now)
    .sort((a, b) => (b.data().timestamp as number) - (a.data().timestamp as number));

  if (activeDocs.length === 0) {
    return NextResponse.json(
      { error: 'expired', message: "That code has expired. Hit 'Resend' to get a fresh one." },
      { status: 400 },
    );
  }

  const record     = activeDocs[0];
  const recordData = record.data();

  if ((recordData.attempts as number) >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: 'too_many_attempts', message: 'Too many wrong attempts. Request a new code.' },
      { status: 429 },
    );
  }

  // ── Compare codes ────────────────────────────────────────────────────────────
  if (String(recordData.code) !== String(code).trim()) {
    await record.ref.update({ attempts: (recordData.attempts as number) + 1 });
    const attemptsUsed = (recordData.attempts as number) + 1;
    const left         = MAX_ATTEMPTS - attemptsUsed;

    const message = left > 0
      ? `Hmm, that code didn't match. ${left} attempt${left !== 1 ? 's' : ''} left. Want Sam to resend it?`
      : 'No attempts left. Request a new code.';

    return NextResponse.json({ error: 'invalid_code', message }, { status: 400 });
  }

  // ── Code matched — mark used ─────────────────────────────────────────────────
  await record.ref.update({ used: true });

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

  // ── Derive boolean values ────────────────────────────────────────────────────
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
      email:               null,
      carrier:             String(carrier       ?? ''),
      state:               String(leadState     ?? '') || null,
      injury_type:         String(injuryType    ?? 'soft_tissue'),
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

  console.log(`[verify-code] ✓ ${String(source).toUpperCase()} lead verified: ${String(name ?? '').trim()} (${phone}) score=${score} tier=${tier}`);
  return NextResponse.json({ success: true, token, score, tier });
}
