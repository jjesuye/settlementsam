/**
 * POST /api/verify-code
 *
 * Accepts { phone, code, name, carrier, injuryType, surgery,
 *           lostWages, estimateLow, estimateHigh,
 *           source?,           -- 'widget' | 'quiz'
 *           // Quiz-only extras:
 *           incidentType?, incidentTimeframe?, faultLevel?,
 *           receivedTreatment?, hospitalized?, stillInTreatment?,
 *           missedWork?, missedWorkDays?, hasAttorney?, insuranceContact? }
 *
 * Validates OTP, marks it used, saves verified lead to SQLite (with quiz
 * scoring when source='quiz'), and returns a JWT session token.
 *
 * Response 200: { success: true, token: string }
 * Response 400: { error: string, message: string }
 * Response 429: { error: 'too_many_attempts', message: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';
import type { DbVerificationCode } from '@/lib/db';
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
    // Quiz extras
    incidentType,
    incidentTimeframe,
    faultLevel,
    receivedTreatment,
    hospitalized,
    stillInTreatment,
    missedWork,
    missedWorkDays,
    hasAttorney,
    insuranceContact,
  } = body;

  const phone = normalizePhone(String(rawPhone ?? ''));

  if (!phone || String(code ?? '').replace(/\D/g, '').length !== 4) {
    return NextResponse.json(
      { error: 'invalid_input', message: 'Phone number and 4-digit code are both required.' },
      { status: 400 },
    );
  }

  // ── Fetch the most recent active code for this phone ────────────────────────
  const record = db
    .prepare(`
      SELECT * FROM verification_codes
      WHERE phone = ? AND used = 0 AND expires_at > ?
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(phone, Date.now()) as DbVerificationCode | undefined;

  if (!record) {
    return NextResponse.json(
      { error: 'expired', message: "That code has expired. Hit 'Resend' to get a fresh one." },
      { status: 400 },
    );
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: 'too_many_attempts', message: 'Too many wrong attempts. Request a new code.' },
      { status: 429 },
    );
  }

  // ── Compare codes ────────────────────────────────────────────────────────────
  if (String(record.code) !== String(code).trim()) {
    db.prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?').run(record.id);
    const attemptsUsed = record.attempts + 1;
    const left         = MAX_ATTEMPTS - attemptsUsed;

    const message = left > 0
      ? `Hmm, that code didn't match. ${left} attempt${left !== 1 ? 's' : ''} left. Want Sam to resend it?`
      : 'No attempts left. Request a new code.';

    return NextResponse.json({ error: 'invalid_code', message }, { status: 400 });
  }

  // ── Code matched — mark used ─────────────────────────────────────────────────
  db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(record.id);

  // ── Build quiz answers object for scoring (quiz mode only) ───────────────────
  const isQuiz = String(source) === 'quiz';

  let score    = 0;
  let tier     = 'COLD';
  let finalLow  = Number(estimateLow  ?? 0);
  let finalHigh = Number(estimateHigh ?? 0);

  if (isQuiz) {
    const qa: QuizAnswers = {
      incidentType:      (incidentType  as QuizAnswers['incidentType'])      ?? null,
      injuryType:        (injuryType    as QuizAnswers['injuryType'])        ?? null,
      incidentTimeframe: (incidentTimeframe as QuizAnswers['incidentTimeframe']) ?? null,
      faultLevel:        (faultLevel    as QuizAnswers['faultLevel'])        ?? null,
      receivedTreatment: receivedTreatment != null ? Boolean(receivedTreatment) : null,
      hospitalized:      hospitalized   != null ? Boolean(hospitalized)      : null,
      hasSurgery:        surgery        != null ? Boolean(surgery)           : null,
      stillInTreatment:  stillInTreatment != null ? Boolean(stillInTreatment) : null,
      missedWork:        missedWork     != null ? Boolean(missedWork)        : null,
      missedWorkDays:    missedWorkDays != null ? Number(missedWorkDays)     : null,
      lostWages:         Number(lostWages ?? 0),
      hasAttorney:       (hasAttorney   as QuizAnswers['hasAttorney'])       ?? null,
      insuranceContact:  (insuranceContact as QuizAnswers['insuranceContact']) ?? null,
    };

    score = calculateScore(qa);
    tier  = scoreTier(score);

    const est = calculateQuizEstimate(qa);
    if (est) { finalLow = est.low; finalHigh = est.high; }
  }

  // ── Save verified lead ───────────────────────────────────────────────────────
  let leadId: number | null = null;

  try {
    const result = db.prepare(`
      INSERT INTO leads
        (name, phone, carrier, injury_type,
         surgery, hospitalized, still_in_treatment,
         missed_work, missed_work_days, lost_wages,
         has_attorney, insurance_contacted,
         estimate_low, estimate_high,
         score, tier, verified, source, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      String(name  ?? '').trim(),
      phone,
      String(carrier   ?? ''),
      String(injuryType ?? 'soft_tissue'),
      surgery           ? 1 : 0,
      hospitalized      ? 1 : 0,
      stillInTreatment  ? 1 : 0,
      missedWork        ? 1 : 0,
      missedWorkDays != null ? Number(missedWorkDays) : null,
      Number(lostWages  ?? 0),
      hasAttorney === 'yes'               ? 1 : 0,
      insuranceContact === 'yes_i_contacted' ? 1 : 0,
      finalLow,
      finalHigh,
      score,
      tier,
      String(source ?? 'widget'),
      Date.now(),
    );
    leadId = result.lastInsertRowid as number;
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
