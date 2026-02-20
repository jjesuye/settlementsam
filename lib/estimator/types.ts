/**
 * lib/estimator/types.ts
 * Shared types for the Case Value Estimator.
 * Used by both lib/estimator/logic.ts and the widget UI components.
 */

/** The four injury categories shown in the widget. */
export type InjuryType = 'soft_tissue' | 'fracture' | 'tbi' | 'spinal';

/** All user-controlled widget inputs. */
export interface EstimatorInputs {
  injuryType:  InjuryType | null;
  hasSurgery:  boolean;
  lostWages:   number;   // dollars, integer, 0–50000 (slider max = "$50k+")
}

/** Calculated {low, high} dollar range. null until injuryType is set. */
export interface EstimateRange {
  low:  number;
  high: number;
}

/** Discriminated union for useEstimator reducer. */
export type EstimatorAction =
  | { type: 'SET_INJURY_TYPE'; payload: InjuryType }
  | { type: 'SET_SURGERY';     payload: boolean     }
  | { type: 'SET_LOST_WAGES';  payload: number      }
  | { type: 'RESET' };
