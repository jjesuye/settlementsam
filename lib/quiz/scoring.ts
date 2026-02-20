/**
 * lib/quiz/scoring.ts
 * Pure scoring logic for the quiz funnel. No React. Fully unit-testable.
 *
 * Score → Tier:
 *   HOT  ≥ 75
 *   WARM ≥ 50
 *   COLD  < 50
 */

import type { QuizAnswers, DisqualReason } from './types';
import { INJURY_BASE_VALUES, SURGERY_MULTIPLIER } from '../estimator/logic';

// ── Disqualifier ──────────────────────────────────────────────────────────────

/**
 * Returns the disqualification reason if this lead is unworkable, or null.
 * Only one hard disqualifier: user was at fault.
 */
export function checkDisqualifier(answers: Partial<QuizAnswers>): DisqualReason | null {
  if (answers.atFault === true) return 'at_fault';
  return null;
}

/**
 * Returns true if the user has an attorney (soft exit — not a disqualifier).
 */
export function checkSoftExit(answers: Partial<QuizAnswers>): boolean {
  return answers.hasAttorney === 'yes';
}

// ── Score calculation ─────────────────────────────────────────────────────────

/**
 * Computes a 0–150 point score from quiz answers.
 * Only call when no disqualifier is present.
 *
 * Weights:
 *   Surgery           +50
 *   Hospitalization   +30
 *   Lost wages >$10k  +25
 *   Still treating    +20
 *   Insurance contact +15
 *   ER/doctor visit   +10
 *   Can't work        +15
 *   Missed work       +10
 */
export function calculateScore(answers: QuizAnswers): number {
  let score = 0;

  if (answers.hasSurgery)                                             score += 50;
  if (answers.hospitalized)                                           score += 30;
  if (answers.lostWages > 10_000)                                     score += 25;
  if (answers.stillInTreatment === 'yes')                             score += 20;
  if (answers.insuranceContact === 'they_contacted' ||
      answers.insuranceContact === 'got_letter')                      score += 15;
  if (answers.receivedTreatment === 'er_doctor')                      score += 10;
  if (answers.missedWork === 'yes_cant_work')                         score += 15;
  else if (answers.missedWork === 'yes_missed')                       score += 10;

  return Math.round(score);
}

// ── Tier assignment ───────────────────────────────────────────────────────────

export function scoreTier(score: number): 'HOT' | 'WARM' | 'COLD' {
  if (score >= 75) return 'HOT';
  if (score >= 50) return 'WARM';
  return 'COLD';
}

// ── Estimate range ────────────────────────────────────────────────────────────

/**
 * Derives an estimate range from quiz answers.
 * Injury type is inferred (no explicit injury question in the 11-step quiz):
 *   surgery → spinal (highest base)
 *   hospitalized (no surgery) → fracture
 *   else → soft_tissue
 */
export function calculateQuizEstimate(
  answers: QuizAnswers,
): { low: number; high: number } {
  let baseKey: keyof typeof INJURY_BASE_VALUES;
  if (answers.hasSurgery)      baseKey = 'spinal';
  else if (answers.hospitalized) baseKey = 'fracture';
  else                          baseKey = 'soft_tissue';

  const base       = INJURY_BASE_VALUES[baseKey];
  const multiplier = answers.hasSurgery ? SURGERY_MULTIPLIER : 1;
  const wages      = Math.max(0, Math.round(answers.lostWages ?? 0));

  return {
    low:  Math.round(base.low  * multiplier) + wages,
    high: Math.round(base.high * multiplier) + wages,
  };
}

// ── Disqualifier messages ─────────────────────────────────────────────────────

export const DISQUALIFIER_MESSAGES: Record<DisqualReason, { headline: string; body: string }> = {
  at_fault: {
    headline: "Sam can't help with this one.",
    body:     "Cases where you were at fault are very difficult to settle. If you believe there's any shared fault involved, consider talking to an attorney — some situations are more nuanced than they first appear.",
  },
};

// ── Key factors for results screen ───────────────────────────────────────────

export interface KeyFactor {
  label:  string;
  points: string;
}

export function getKeyFactors(answers: QuizAnswers): KeyFactor[] {
  const factors: KeyFactor[] = [];
  if (answers.hasSurgery)
    factors.push({ label: 'Surgery documented', points: '+50 pts' });
  if (answers.hospitalized)
    factors.push({ label: 'Hospitalization documented', points: '+30 pts' });
  if (answers.lostWages > 10_000)
    factors.push({ label: 'Significant lost wages', points: '+25 pts' });
  if (answers.stillInTreatment === 'yes')
    factors.push({ label: 'Ongoing treatment', points: '+20 pts' });
  if (answers.insuranceContact === 'they_contacted' || answers.insuranceContact === 'got_letter')
    factors.push({ label: 'Insurance already contacted you', points: '+15 pts' });
  if (answers.missedWork === 'yes_cant_work')
    factors.push({ label: 'Unable to work', points: '+15 pts' });
  else if (answers.missedWork === 'yes_missed')
    factors.push({ label: 'Missed work documented', points: '+10 pts' });
  if (answers.receivedTreatment === 'er_doctor')
    factors.push({ label: 'ER / physician visit on record', points: '+10 pts' });
  return factors;
}
