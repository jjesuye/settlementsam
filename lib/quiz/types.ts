/**
 * lib/quiz/types.ts
 * All types for the 11-question quiz funnel.
 */

/** Incident categories */
export type IncidentType =
  | 'motor_vehicle'
  | 'slip_fall'
  | 'workplace'
  | 'med_mal'
  | 'other';

/** When incident occurred (4 options) */
export type IncidentTimeframe =
  | 'under_6_months'
  | '6_to_12_months'
  | '1_to_2_years'
  | 'over_2_years';

/** Medical treatment received */
export type TreatmentStatus = 'er_doctor' | 'self_treated' | 'none';

/** Ongoing treatment status */
export type TreatmentOngoing = 'yes' | 'no' | 'sometimes';

/** Missed work status */
export type MissedWorkStatus = 'yes_missed' | 'yes_cant_work' | 'no';

/** Insurance contact status */
export type InsuranceContactStatus = 'they_contacted' | 'got_letter' | 'not_yet';

/** Attorney status */
export type AttorneyStatus = 'no' | 'yes';

/** All quiz answers collected across the 11 questions */
export interface QuizAnswers {
  // Q1
  incidentType:      IncidentType | null;
  // Q2
  state:             string | null;
  // Q3
  incidentTimeframe: IncidentTimeframe | null;
  // Q4
  atFault:           boolean | null;
  // Q5
  receivedTreatment: TreatmentStatus | null;
  // Q6
  hospitalized:      boolean | null;
  // Q7
  hasSurgery:        boolean | null;
  // Q8
  stillInTreatment:  TreatmentOngoing | null;
  // Q9 (combined: work status + wages slider)
  missedWork:        MissedWorkStatus | null;
  lostWages:         number;
  // Q10
  insuranceContact:  InsuranceContactStatus | null;
  // Q11
  hasAttorney:       AttorneyStatus | null;
}

export const INITIAL_ANSWERS: QuizAnswers = {
  incidentType:      null,
  state:             null,
  incidentTimeframe: null,
  atFault:           null,
  receivedTreatment: null,
  hospitalized:      null,
  hasSurgery:        null,
  stillInTreatment:  null,
  missedWork:        null,
  lostWages:         0,
  insuranceContact:  null,
  hasAttorney:       null,
};

/** Only one hard disqualifier: at fault */
export type DisqualReason = 'at_fault';

/** The final scored result */
export interface QuizResult {
  answers:      QuizAnswers;
  score:        number;
  tier:         'HOT' | 'WARM' | 'COLD';
  estimateLow:  number;
  estimateHigh: number;
}
