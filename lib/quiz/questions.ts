/**
 * lib/quiz/questions.ts
 * Declarative question definitions for the 11-question quiz.
 *
 * Question types:
 *   'options'           — pill/card selection, auto-advances on click
 *   'state-select'      — US state dropdown, explicit Next button
 *   'wages-with-slider' — work status options + conditional wage slider, explicit Next
 *
 * Option properties:
 *   isDisq     — selecting this triggers the disqualified screen immediately
 *   isSoftExit — selecting this triggers the attorney-exit screen
 *   warning    — yellow alert shown for 2.5s before auto-advancing
 *   tip        — blue info alert shown for 2.5s before auto-advancing
 *   reaction   — green positive alert shown for 2.5s before auto-advancing
 */

import type { QuizAnswers } from './types';

// ── US States ────────────────────────────────────────────────────────────────

export const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado',
  'Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho',
  'Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana',
  'Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
  'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey',
  'New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma',
  'Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington',
  'West Virginia','Wisconsin','Wyoming','Washington D.C.',
];

// ── Option type ───────────────────────────────────────────────────────────────

export interface QuizOption {
  value:       string;
  label:       string;
  sub?:        string;
  icon?:       string;
  isDisq?:     boolean;
  isSoftExit?: boolean;
  warning?:    string;
  tip?:        string;
  reaction?:   string;
}

export type QuizQuestionType = 'options' | 'state-select' | 'wages-with-slider';

export interface QuizQuestion {
  id:       keyof QuizAnswers;
  headline: string;
  sub?:     string;
  type:     QuizQuestionType;
  options?: QuizOption[];
  layout?:  'list' | 'grid';
}

// ── Questions ─────────────────────────────────────────────────────────────────

export const QUIZ_QUESTIONS: QuizQuestion[] = [

  // Q1 — Incident type
  {
    id:       'incidentType',
    headline: 'What type of incident are we talking about?',
    sub:      'Pick the one that best describes how you were hurt.',
    type:     'options',
    layout:   'grid',
    options: [
      { value: 'motor_vehicle', icon: '🚗', label: 'Car / Vehicle Accident', sub: 'Car, truck, motorcycle, rideshare' },
      { value: 'slip_fall',     icon: '🏢', label: 'Slip & Fall',            sub: "Trip, fall on someone else's property" },
      { value: 'workplace',     icon: '🦺', label: 'Workplace Injury',       sub: 'On-the-job accident or illness' },
      { value: 'med_mal',       icon: '🩺', label: 'Medical Malpractice',    sub: 'Surgical error, misdiagnosis' },
      { value: 'other',         icon: '⚖️', label: 'Other',                  sub: 'Dog bite, assault, product liability, etc.' },
    ],
  },

  // Q2 — State
  {
    id:       'state',
    headline: 'What state are you in?',
    sub:      'Laws and settlement averages vary significantly by state.',
    type:     'state-select',
  },

  // Q3 — Timeframe
  {
    id:       'incidentTimeframe',
    headline: 'When did this happen?',
    sub:      'Time matters because of statutes of limitations.',
    type:     'options',
    options: [
      { value: 'under_6_months',  icon: '📅', label: 'In the last 6 months' },
      { value: '6_to_12_months',  icon: '📅', label: '6 – 12 months ago' },
      { value: '1_to_2_years',    icon: '📅', label: '1 – 2 years ago' },
      {
        value:   'over_2_years',
        icon:    '⏳',
        label:   'More than 2 years ago',
        warning: 'Statutes of limitations may apply depending on your state. An attorney can still review your case — don\'t give up yet.',
      },
    ],
  },

  // Q4 — At fault
  {
    id:       'atFault',
    headline: 'Were you at fault for the incident?',
    sub:      'Be honest — it helps Sam give you a realistic picture.',
    type:     'options',
    options: [
      { value: 'false', icon: '✅', label: 'No — the other party was at fault',  sub: 'They caused the accident' },
      { value: 'true',  icon: '❌', label: 'Yes — I was at fault',               sub: 'The accident was my fault', isDisq: true },
    ],
  },

  // Q5 — Treatment received
  {
    id:       'receivedTreatment',
    headline: 'Did you receive medical treatment?',
    sub:      'Documented treatment is the backbone of any injury claim.',
    type:     'options',
    options: [
      { value: 'er_doctor',    icon: '🏥', label: 'Yes — doctor or ER',   sub: 'Includes urgent care, specialist, chiropractor' },
      { value: 'self_treated', icon: '💊', label: 'Yes — self-treated',   sub: 'OTC meds, rest, no formal care' },
      {
        value: 'none',
        icon:  '❌',
        label: 'No treatment yet',
        sub:   "Haven't seen a doctor",
        tip:   "Getting treatment documented is the most important step you can take right now. Even one doctor's visit makes a huge difference to your case.",
      },
    ],
  },

  // Q6 — Hospitalized
  {
    id:       'hospitalized',
    headline: 'Were you hospitalized?',
    sub:      'An overnight stay or ER admission significantly increases case value.',
    type:     'options',
    options: [
      { value: 'true',  icon: '🏨', label: 'Yes', sub: 'Admitted overnight or longer' },
      { value: 'false', icon: '🚶', label: 'No',  sub: 'ER/urgent care visit only' },
    ],
  },

  // Q7 — Surgery
  {
    id:       'hasSurgery',
    headline: 'Did you have (or need) surgery?',
    sub:      'Surgery is the single biggest multiplier in settlement value.',
    type:     'options',
    options: [
      {
        value:    'true',
        icon:     '🏥',
        label:    'Yes — I had surgery',
        sub:      'Or surgery has been recommended',
        reaction: "Surgery is the biggest driver of case value. That's a major factor in your favor.",
      },
      { value: 'false', icon: '💊', label: 'No surgery', sub: 'Treated with medication or therapy' },
    ],
  },

  // Q8 — Still in treatment
  {
    id:       'stillInTreatment',
    headline: 'Are you still receiving treatment?',
    sub:      'Ongoing treatment shows the injury has a lasting impact.',
    type:     'options',
    options: [
      { value: 'yes',       icon: '🔄', label: 'Yes — still treating',      sub: 'Physical therapy, specialist visits, etc.' },
      { value: 'no',        icon: '✅', label: 'Treatment is complete',      sub: "I've been discharged or recovered" },
      { value: 'sometimes', icon: '⚡', label: 'Occasional treatment',       sub: 'As needed, flare-ups' },
    ],
  },

  // Q9 — Missed work + wages (combined)
  {
    id:       'missedWork',
    headline: 'Did you miss work because of your injury?',
    sub:      'Lost income is economic damages — they add directly to your settlement.',
    type:     'wages-with-slider',
    options: [
      { value: 'yes_missed',   icon: '📋', label: 'Yes — I missed work',      sub: "I've been out or partially out" },
      { value: 'yes_cant_work',icon: '⚠️', label: "Yes — I can't work",        sub: 'Completely unable to work' },
      { value: 'no',           icon: '💼', label: 'No — I kept working',       sub: "Or I'm not employed" },
    ],
  },

  // Q10 — Insurance contact
  {
    id:       'insuranceContact',
    headline: 'Has anyone been in touch about an insurance claim?',
    sub:      'This helps Sam size up where things stand with the other side.',
    type:     'options',
    options: [
      {
        value:   'they_contacted',
        icon:    '📞',
        label:   'They reached out to me',
        sub:     'Insurance called or wrote first',
        tip:     'Be careful what you say — everything is on record. Do not give a recorded statement without an attorney.',
      },
      {
        value:   'got_letter',
        icon:    '📝',
        label:   'I got a letter or offer',
        sub:     'An adjuster has already offered something',
        tip:     "Don't sign anything without knowing your full case value. That first offer is almost always a lowball.",
      },
      { value: 'not_yet', icon: '🤐', label: 'No contact yet', sub: 'Nothing from anyone so far' },
    ],
  },

  // Q11 — Has attorney
  {
    id:       'hasAttorney',
    headline: 'Do you currently have an attorney?',
    sub:      "Just making sure Sam's not stepping on anyone's toes.",
    type:     'options',
    options: [
      { value: 'no',  icon: '👋', label: "No — I don't have an attorney", sub: "That's what Sam is for" },
      { value: 'yes', icon: '👤', label: 'Yes — I have representation',   sub: 'Currently working with a lawyer', isSoftExit: true },
    ],
  },

];

export const TOTAL_QUESTIONS = QUIZ_QUESTIONS.length;
