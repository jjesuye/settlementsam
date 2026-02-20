/**
 * tests/estimator.test.ts
 * Unit tests for the Case Value Estimator logic layer.
 * Zero UI. Zero network. Pure function testing.
 */

import {
  calculateEstimate,
  formatCurrency,
  buildSummaryText,
  isReadyToEstimate,
  INJURY_BASE_VALUES,
  SURGERY_MULTIPLIER,
  LOST_WAGES_MAX,
} from '@/lib/estimator/logic';
import type { EstimatorInputs } from '@/lib/estimator/types';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const base = (overrides: Partial<EstimatorInputs> = {}): EstimatorInputs => ({
  injuryType: null,
  hasSurgery: false,
  lostWages:  0,
  ...overrides,
});

// ── calculateEstimate ─────────────────────────────────────────────────────────

describe('calculateEstimate', () => {
  it('returns null when no injury type is selected', () => {
    expect(calculateEstimate(base())).toBeNull();
  });

  it('returns floor/ceiling for soft_tissue with no surgery, no wages', () => {
    const result = calculateEstimate(base({ injuryType: 'soft_tissue' }));
    expect(result).toEqual({ low: 8_000, high: 25_000 });
  });

  it('returns correct range for fracture', () => {
    const result = calculateEstimate(base({ injuryType: 'fracture' }));
    expect(result).toEqual({ low: 20_000, high: 75_000 });
  });

  it('returns correct range for spinal', () => {
    const result = calculateEstimate(base({ injuryType: 'spinal' }));
    expect(result).toEqual({ low: 50_000, high: 200_000 });
  });

  it('returns correct range for tbi', () => {
    const result = calculateEstimate(base({ injuryType: 'tbi' }));
    expect(result).toEqual({ low: 75_000, high: 500_000 });
  });

  it('applies 5× surgery multiplier to both ends', () => {
    const result = calculateEstimate(base({ injuryType: 'soft_tissue', hasSurgery: true }));
    expect(result).toEqual({
      low:  8_000  * SURGERY_MULTIPLIER,   // 40,000
      high: 25_000 * SURGERY_MULTIPLIER,   // 125,000
    });
  });

  it('adds lost wages to both ends after surgery multiplier', () => {
    const result = calculateEstimate(base({
      injuryType: 'fracture',
      hasSurgery: true,
      lostWages:  10_000,
    }));
    expect(result).toEqual({
      low:  20_000 * 5 + 10_000,  // 110,000
      high: 75_000 * 5 + 10_000,  // 385,000
    });
  });

  it('adds lost wages without surgery multiplier (no surgery)', () => {
    const result = calculateEstimate(base({ injuryType: 'tbi', lostWages: 25_000 }));
    expect(result).toEqual({
      low:  75_000  + 25_000,  // 100,000
      high: 500_000 + 25_000,  // 525,000
    });
  });

  it('treats negative lost wages as 0', () => {
    const result = calculateEstimate(base({ injuryType: 'soft_tissue', lostWages: -500 }));
    expect(result).toEqual({ low: 8_000, high: 25_000 });
  });

  it('handles LOST_WAGES_MAX correctly (slider ceiling)', () => {
    const result = calculateEstimate(base({ injuryType: 'soft_tissue', lostWages: LOST_WAGES_MAX }));
    expect(result).toEqual({ low: 8_000 + 50_000, high: 25_000 + 50_000 });
  });

  it('rounds fractional results to integers', () => {
    // Force a fractional base by using a non-round multiplier — can't do that directly,
    // so test rounding by verifying result types are integers.
    const result = calculateEstimate(base({ injuryType: 'spinal', hasSurgery: true }))!;
    expect(Number.isInteger(result.low)).toBe(true);
    expect(Number.isInteger(result.high)).toBe(true);
  });
});

// ── formatCurrency ────────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats sub-$1k amounts with commas', () => {
    expect(formatCurrency(500)).toBe('$500');
    expect(formatCurrency(0)).toBe('$0');
  });

  it('formats thousands as $Xk', () => {
    expect(formatCurrency(8_000)).toBe('$8k');
    expect(formatCurrency(25_000)).toBe('$25k');
    expect(formatCurrency(75_000)).toBe('$75k');
    expect(formatCurrency(125_000)).toBe('$125k');
    expect(formatCurrency(500_000)).toBe('$500k');
  });

  it('rounds to nearest $1k', () => {
    expect(formatCurrency(8_400)).toBe('$8k');
    expect(formatCurrency(8_600)).toBe('$9k');
  });

  it('formats millions with 1 decimal if needed', () => {
    expect(formatCurrency(1_000_000)).toBe('$1M');
    expect(formatCurrency(1_500_000)).toBe('$1.5M');
    expect(formatCurrency(2_000_000)).toBe('$2M');
  });
});

// ── buildSummaryText ──────────────────────────────────────────────────────────

describe('buildSummaryText', () => {
  it('returns null when no injury type selected', () => {
    expect(buildSummaryText(base())).toBeNull();
  });

  it('builds summary for basic injury (no surgery, no wages)', () => {
    const text = buildSummaryText(base({ injuryType: 'soft_tissue' }));
    expect(text).toContain('soft tissue');
    expect(text).toContain("here's what similar cases have settled for");
    expect(text).not.toContain('surgery');
    expect(text).not.toContain('lost income');
  });

  it('includes "with surgery" when hasSurgery is true', () => {
    const text = buildSummaryText(base({ injuryType: 'fracture', hasSurgery: true }));
    expect(text).toContain('with surgery');
  });

  it('includes formatted wages when lostWages > 0', () => {
    const text = buildSummaryText(base({ injuryType: 'tbi', lostWages: 12_000 }));
    expect(text).toContain('$12k in lost income');
  });

  it('shows $50k+ label when wages hit the slider max', () => {
    const text = buildSummaryText(base({ injuryType: 'tbi', lostWages: LOST_WAGES_MAX }));
    expect(text).toContain('$50k+ in lost income');
  });

  it('includes all three components when all are set', () => {
    const text = buildSummaryText(base({ injuryType: 'spinal', hasSurgery: true, lostWages: 20_000 }));
    expect(text).toContain('spinal cord injury');
    expect(text).toContain('with surgery');
    expect(text).toContain('$20k in lost income');
  });
});

// ── isReadyToEstimate ─────────────────────────────────────────────────────────

describe('isReadyToEstimate', () => {
  it('returns false when injuryType is null', () => {
    expect(isReadyToEstimate(base())).toBe(false);
  });

  it('returns true for any injury type, even with defaults', () => {
    const types = ['soft_tissue', 'fracture', 'tbi', 'spinal'] as const;
    for (const t of types) {
      expect(isReadyToEstimate(base({ injuryType: t }))).toBe(true);
    }
  });
});

// ── INJURY_BASE_VALUES ────────────────────────────────────────────────────────

describe('INJURY_BASE_VALUES', () => {
  it('contains all four injury types', () => {
    expect(INJURY_BASE_VALUES.soft_tissue).toBeDefined();
    expect(INJURY_BASE_VALUES.fracture).toBeDefined();
    expect(INJURY_BASE_VALUES.tbi).toBeDefined();
    expect(INJURY_BASE_VALUES.spinal).toBeDefined();
  });

  it('soft_tissue range is $8k–$25k', () => {
    expect(INJURY_BASE_VALUES.soft_tissue.low).toBe(8_000);
    expect(INJURY_BASE_VALUES.soft_tissue.high).toBe(25_000);
  });

  it('fracture range is $20k–$75k', () => {
    expect(INJURY_BASE_VALUES.fracture.low).toBe(20_000);
    expect(INJURY_BASE_VALUES.fracture.high).toBe(75_000);
  });

  it('spinal range is $50k–$200k', () => {
    expect(INJURY_BASE_VALUES.spinal.low).toBe(50_000);
    expect(INJURY_BASE_VALUES.spinal.high).toBe(200_000);
  });

  it('tbi range is $75k–$500k', () => {
    expect(INJURY_BASE_VALUES.tbi.low).toBe(75_000);
    expect(INJURY_BASE_VALUES.tbi.high).toBe(500_000);
  });

  it('all high values exceed their corresponding low values', () => {
    for (const [, range] of Object.entries(INJURY_BASE_VALUES)) {
      expect(range.high).toBeGreaterThan(range.low);
    }
  });

  it('SURGERY_MULTIPLIER is 5', () => {
    expect(SURGERY_MULTIPLIER).toBe(5);
  });
});
