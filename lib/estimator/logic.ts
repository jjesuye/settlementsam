/**
 * lib/estimator/logic.ts
 * Pure calculation functions for the Case Value Estimator.
 *
 * No React. No side effects. Fully unit-testable in isolation.
 * Numbers come from the PRD spec (Phase 1 Ranges, updated).
 */

import type { EstimatorInputs, EstimateRange, InjuryType } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Applied to both ends of the base range when hasSurgery is true. */
export const SURGERY_MULTIPLIER = 5;

/** Slider ceiling. Values at this number display as "$50k+" in the UI. */
export const LOST_WAGES_MAX = 50_000;

// ── Base settlement ranges by injury type ─────────────────────────────────────

interface InjuryBaseRange {
  low:   number;
  high:  number;
  label: string;
}

/**
 * Floor/ceiling estimates per injury category — before surgery or wages adjustments.
 * Per PRD spec (Phase 2 / Step 5 ranges).
 *
 * To tune: edit only this map. calculateEstimate() stays unchanged.
 */
export const INJURY_BASE_VALUES: Record<InjuryType, InjuryBaseRange> = {
  soft_tissue: { low:   8_000, high:   25_000, label: 'soft tissue (sprains & whiplash)' },
  fracture:    { low:  20_000, high:   75_000, label: 'broken bone / fracture'            },
  spinal:      { low:  50_000, high:  200_000, label: 'spinal cord injury'                },
  tbi:         { low:  75_000, high:  500_000, label: 'head injury / concussion / TBI'   },
};

// ── Core calculation ──────────────────────────────────────────────────────────

/**
 * Returns { low, high } or null when no injury type has been chosen.
 *
 * Formula:
 *   low  = baseLow  × surgeryMultiplier + lostWages
 *   high = baseHigh × surgeryMultiplier + lostWages
 *
 * Surgery multiplies the pain-and-suffering component only.
 * Lost wages are economic damages added directly on top.
 */
export function calculateEstimate(inputs: EstimatorInputs): EstimateRange | null {
  if (!inputs.injuryType) return null;

  const base       = INJURY_BASE_VALUES[inputs.injuryType];
  const multiplier = inputs.hasSurgery ? SURGERY_MULTIPLIER : 1;
  const wages      = Math.max(0, Math.round(inputs.lostWages));

  return {
    low:  Math.round(base.low  * multiplier) + wages,
    high: Math.round(base.high * multiplier) + wages,
  };
}

// ── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Compact dollar format.
 * 8000  → "$8k"
 * 75000 → "$75k"
 * 1500000 → "$1.5M"
 * 500 → "$500"
 */
export function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }
  return `$${amount.toLocaleString()}`;
}

/**
 * Plain-English one-liner shown beneath the result range.
 * Returns null if no injury type selected.
 *
 * Example:
 *   "Based on a spinal cord injury with surgery and $12k in lost income,
 *    here's what similar cases have settled for."
 */
export function buildSummaryText(inputs: EstimatorInputs): string | null {
  if (!inputs.injuryType) return null;

  const injury = INJURY_BASE_VALUES[inputs.injuryType].label;
  const parts: string[] = [`Based on a ${injury}`];

  if (inputs.hasSurgery) parts.push('with surgery');

  if (inputs.lostWages > 0) {
    const wagesLabel =
      inputs.lostWages >= LOST_WAGES_MAX
        ? '$50k+ in lost income'
        : `${formatCurrency(inputs.lostWages)} in lost income`;
    parts.push(`and ${wagesLabel}`);
  }

  return `${parts.join(' ')}, here's what similar cases have settled for.`;
}

/** True once the minimum required input (injury type) has been selected. */
export function isReadyToEstimate(inputs: EstimatorInputs): boolean {
  return inputs.injuryType !== null;
}
