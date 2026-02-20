/**
 * tests/quiz/scoring.test.ts
 * Unit tests for the quiz scoring, tier assignment, disqualifiers, and estimate.
 * Runs in Node environment (no browser APIs needed).
 */

import {
  calculateScore,
  scoreTier,
  checkDisqualifier,
  calculateQuizEstimate,
  DISQUALIFIER_MESSAGES,
} from '@/lib/quiz/scoring';
import type { QuizAnswers } from '@/lib/quiz/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_ANSWERS: QuizAnswers = {
  incidentType:      'motor_vehicle',
  injuryType:        'soft_tissue',
  incidentTimeframe: '1_to_6_months',
  faultLevel:        'not_at_fault',
  receivedTreatment: true,
  hospitalized:      false,
  hasSurgery:        false,
  stillInTreatment:  false,
  missedWork:        false,
  missedWorkDays:    null,
  lostWages:         0,
  hasAttorney:       'no',
  insuranceContact:  'not_yet',
};

// ── checkDisqualifier ─────────────────────────────────────────────────────────

describe('checkDisqualifier', () => {
  it('returns null for a clean lead', () => {
    expect(checkDisqualifier(BASE_ANSWERS)).toBeNull();
  });

  it('disqualifies has_attorney = yes', () => {
    expect(checkDisqualifier({ ...BASE_ANSWERS, hasAttorney: 'yes' }))
      .toBe('has_attorney');
  });

  it('disqualifies fully_at_fault', () => {
    expect(checkDisqualifier({ ...BASE_ANSWERS, faultLevel: 'fully_at_fault' }))
      .toBe('fully_at_fault');
  });

  it('disqualifies over_3_years', () => {
    expect(checkDisqualifier({ ...BASE_ANSWERS, incidentTimeframe: 'over_3_years' }))
      .toBe('over_3_years');
  });

  it('disqualifies no_treatment', () => {
    expect(checkDisqualifier({ ...BASE_ANSWERS, receivedTreatment: false }))
      .toBe('no_treatment');
  });

  it('has_attorney takes priority over other disqualifiers', () => {
    const answers = {
      ...BASE_ANSWERS,
      hasAttorney: 'yes' as const,
      faultLevel:  'fully_at_fault' as const,
    };
    expect(checkDisqualifier(answers)).toBe('has_attorney');
  });

  it('partial fault does NOT disqualify', () => {
    expect(checkDisqualifier({ ...BASE_ANSWERS, faultLevel: 'partial' }))
      .toBeNull();
  });
});

// ── calculateScore ────────────────────────────────────────────────────────────

describe('calculateScore', () => {
  it('returns a positive score for a basic valid lead', () => {
    const score = calculateScore(BASE_ANSWERS);
    // not_at_fault(5) + soft_tissue(10) + not_yet(10) + 1-6 months(4) = 29+
    expect(score).toBeGreaterThan(0);
  });

  it('soft tissue + no surgery baseline', () => {
    const score = calculateScore(BASE_ANSWERS);
    // soft_tissue=10, not_at_fault=5, not_yet=10, timeframe(1-6mo)=4 = 29
    expect(score).toBe(29);
  });

  it('adds 40 points for surgery', () => {
    const withSurgery    = calculateScore({ ...BASE_ANSWERS, hasSurgery: true  });
    const withoutSurgery = calculateScore({ ...BASE_ANSWERS, hasSurgery: false });
    expect(withSurgery - withoutSurgery).toBe(40);
  });

  it('adds 20 points for hospitalization', () => {
    const with_    = calculateScore({ ...BASE_ANSWERS, hospitalized: true  });
    const without_ = calculateScore({ ...BASE_ANSWERS, hospitalized: false });
    expect(with_ - without_).toBe(20);
  });

  it('adds correct wage points: ≥50k → 25 pts', () => {
    const score = calculateScore({ ...BASE_ANSWERS, lostWages: 50_000 });
    const base  = calculateScore({ ...BASE_ANSWERS, lostWages: 0 });
    expect(score - base).toBe(25);
  });

  it('adds correct wage points: ≥10k → 15 pts', () => {
    const score = calculateScore({ ...BASE_ANSWERS, lostWages: 12_000 });
    const base  = calculateScore({ ...BASE_ANSWERS, lostWages: 0 });
    expect(score - base).toBe(15);
  });

  it('adds 15 days-missed bonus for >30 days', () => {
    const a = calculateScore({ ...BASE_ANSWERS, missedWork: true, missedWorkDays: 45 });
    const b = calculateScore({ ...BASE_ANSWERS, missedWork: true, missedWorkDays: null });
    // >30 days adds 15, missedWork already adds 10
    expect(a - b).toBe(15);
  });

  it('adds 10 days-missed bonus for >7 days', () => {
    const a = calculateScore({ ...BASE_ANSWERS, missedWork: true, missedWorkDays: 10 });
    const b = calculateScore({ ...BASE_ANSWERS, missedWork: true, missedWorkDays: null });
    expect(a - b).toBe(10);
  });

  it('skips days bonus when missedWork is false', () => {
    const a = calculateScore({ ...BASE_ANSWERS, missedWork: false, missedWorkDays: 60 });
    const b = calculateScore({ ...BASE_ANSWERS, missedWork: false, missedWorkDays: null });
    expect(a).toBe(b);
  });

  it('TBI scores higher than soft tissue', () => {
    const tbi  = calculateScore({ ...BASE_ANSWERS, injuryType: 'tbi'         });
    const soft = calculateScore({ ...BASE_ANSWERS, injuryType: 'soft_tissue' });
    expect(tbi).toBeGreaterThan(soft);
  });

  it('spinal scores highest', () => {
    const spinal = calculateScore({ ...BASE_ANSWERS, injuryType: 'spinal'      });
    const tbi    = calculateScore({ ...BASE_ANSWERS, injuryType: 'tbi'         });
    expect(spinal).toBeGreaterThan(tbi);
  });

  it('maximum HOT lead: spinal + surgery + hospitalized + still treating + big wages', () => {
    const hot: QuizAnswers = {
      ...BASE_ANSWERS,
      injuryType:       'spinal',
      hasSurgery:       true,
      hospitalized:     true,
      stillInTreatment: true,
      missedWork:       true,
      missedWorkDays:   60,
      lostWages:        50_000,
      insuranceContact: 'not_yet',
      incidentTimeframe: 'within_30_days',
    };
    const score = calculateScore(hot);
    expect(score).toBeGreaterThanOrEqual(85);
  });
});

// ── scoreTier ─────────────────────────────────────────────────────────────────

describe('scoreTier', () => {
  it('returns HOT for score ≥ 85',  () => expect(scoreTier(85)).toBe('HOT'));
  it('returns HOT for score 100',   () => expect(scoreTier(100)).toBe('HOT'));
  it('returns WARM for score 84',   () => expect(scoreTier(84)).toBe('WARM'));
  it('returns WARM for score 45',   () => expect(scoreTier(45)).toBe('WARM'));
  it('returns COLD for score 44',   () => expect(scoreTier(44)).toBe('COLD'));
  it('returns COLD for score 0',    () => expect(scoreTier(0)).toBe('COLD'));
});

// ── calculateQuizEstimate ─────────────────────────────────────────────────────

describe('calculateQuizEstimate', () => {
  it('returns null when no injury type', () => {
    expect(calculateQuizEstimate({ ...BASE_ANSWERS, injuryType: null })).toBeNull();
  });

  it('low is less than high', () => {
    const est = calculateQuizEstimate(BASE_ANSWERS);
    expect(est).not.toBeNull();
    expect(est!.low).toBeLessThan(est!.high);
  });

  it('surgery multiplies base range by 5', () => {
    const withSurgery    = calculateQuizEstimate({ ...BASE_ANSWERS, hasSurgery: true  })!;
    const withoutSurgery = calculateQuizEstimate({ ...BASE_ANSWERS, hasSurgery: false })!;
    expect(withSurgery.low).toBeGreaterThan(withoutSurgery.low);
    // For soft_tissue: base low=8000, surgery multiplier=5
    expect(withSurgery.low).toBe(40_000); // 8000 * 5
  });

  it('lost wages add directly to both ends', () => {
    const withWages    = calculateQuizEstimate({ ...BASE_ANSWERS, lostWages: 10_000 })!;
    const withoutWages = calculateQuizEstimate({ ...BASE_ANSWERS, lostWages: 0      })!;
    expect(withWages.low  - withoutWages.low).toBe(10_000);
    expect(withWages.high - withoutWages.high).toBe(10_000);
  });

  it('maps "other" injury type to soft_tissue conservatively', () => {
    const other = calculateQuizEstimate({ ...BASE_ANSWERS, injuryType: 'other' })!;
    const soft  = calculateQuizEstimate({ ...BASE_ANSWERS, injuryType: 'soft_tissue' })!;
    expect(other.low).toBe(soft.low);
    expect(other.high).toBe(soft.high);
  });
});

// ── DISQUALIFIER_MESSAGES ─────────────────────────────────────────────────────

describe('DISQUALIFIER_MESSAGES', () => {
  const reasons = ['has_attorney', 'fully_at_fault', 'over_3_years', 'no_treatment'] as const;

  reasons.forEach(reason => {
    it(`has headline and body for "${reason}"`, () => {
      const msg = DISQUALIFIER_MESSAGES[reason];
      expect(typeof msg.headline).toBe('string');
      expect(msg.headline.length).toBeGreaterThan(0);
      expect(typeof msg.body).toBe('string');
      expect(msg.body.length).toBeGreaterThan(0);
    });
  });
});
