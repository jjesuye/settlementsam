'use client';
/**
 * components/widget/CaseEstimatorWidget.tsx
 *
 * The full 4-step widget:
 *   Step 0 — Injury type (pill buttons)
 *   Step 1 — Surgery toggle (oversized satisfying cards)
 *   Step 2 — Lost wages (styled slider)
 *   Step 3 — Verification gate (SMS OTP)
 *   Step 4 — Unlocked result (Gauge + confetti + CTA bridge)
 *
 * Brand: warm slate bg, coral CTAs, amber Sam signature.
 * Framer Motion spring physics throughout.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEstimator } from '@/lib/estimator/useEstimator';
import { formatCurrency, LOST_WAGES_MAX } from '@/lib/estimator/logic';
import type { InjuryType } from '@/lib/estimator/types';
import { Gauge } from './Gauge';
import { VerificationGate } from './VerificationGate';

// ── Step index ─────────────────────────────────────────────────────────────────
// 0 = injury  |  1 = surgery  |  2 = wages  |  3 = verify  |  4 = result
type Step = 0 | 1 | 2 | 3 | 4;

// ── Injury options ─────────────────────────────────────────────────────────────
const INJURY_OPTIONS: { type: InjuryType; emoji: string; label: string; sub: string }[] = [
  { type: 'soft_tissue', emoji: '🩹', label: 'Soft Tissue',  sub: 'Sprains & whiplash'     },
  { type: 'fracture',    emoji: '🦴', label: 'Fracture',     sub: 'Broken bone'             },
  { type: 'tbi',         emoji: '🧠', label: 'Head / TBI',   sub: 'Concussion, TBI'         },
  { type: 'spinal',      emoji: '⚡', label: 'Spinal Cord',  sub: 'Spinal cord injury'      },
];

// ── Wage slider ticks ─────────────────────────────────────────────────────────
const WAGE_TICKS = ['$0', '$10k', '$25k', '$50k+'];

// ── Confetti (computed once, SSR-safe) ────────────────────────────────────────
const PARTICLES = Array.from({ length: 22 }, (_, i) => {
  const angle    = (360 / 22) * i;
  const angleRad = (angle * Math.PI) / 180;
  const distance = [90, 68, 55][i % 3];
  const colors   = ['#E8A838', '#4A7C59', '#8FB88A', '#D4922A', '#FDF6E9'];
  return {
    id:       i,
    dx:       Math.cos(angleRad) * distance,
    dy:       Math.sin(angleRad) * distance,
    size:     [8, 6, 5, 4][i % 4],
    color:    colors[i % colors.length],
    delay:    (i / 22) * 0.22,
    duration: [0.7, 0.85, 1.0][i % 3],
    spin:     (i % 2 === 0 ? 1 : -1) * (80 + i * 14),
    shape:    i % 6 === 0 ? '3px' : '50%',
  };
});

function Confetti() {
  return (
    <div className="ss-confetti" aria-hidden="true">
      {PARTICLES.map(p => (
        <motion.div
          key={p.id}
          className="ss-confetti-particle"
          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0.4, rotate: p.spin }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
          style={{
            width:        p.size,
            height:       p.size,
            background:   p.color,
            borderRadius: p.shape,
            position:     'absolute',
            top: '50%',
            left: '50%',
            marginLeft: -p.size / 2,
            marginTop:  -p.size / 2,
          }}
        />
      ))}
    </div>
  );
}

// ── Nav row ───────────────────────────────────────────────────────────────────
function Nav({
  onBack,
  onNext,
  nextLabel    = 'Next →',
  nextDisabled = false,
}: {
  onBack?:       () => void;
  onNext:        () => void;
  nextLabel?:    string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="ss-nav">
      {onBack
        ? <button className="ss-btn-back" onClick={onBack}>← Back</button>
        : <span />
      }
      <button className="ss-btn-next" onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </button>
    </div>
  );
}

// ── Widget props ──────────────────────────────────────────────────────────────
export interface CaseEstimatorWidgetProps {
  /** URL for "Get My Full Case Review with Sam →" CTA. Defaults to /quiz. */
  funnelHref?: string;
  /** Base URL for verification API. Defaults to /api. */
  apiBase?: string;
}

// ── Widget ────────────────────────────────────────────────────────────────────
export function CaseEstimatorWidget({
  funnelHref = '/quiz',
  apiBase    = '/api',
}: CaseEstimatorWidgetProps) {
  const [step,           setStep]           = useState<Step>(0);
  const [stepKey,        setStepKey]        = useState(0);
  const [isDragging,     setIsDragging]     = useState(false);
  const [surgeryTouched, setSurgeryTouched] = useState(false);
  const [_token,         setToken]          = useState('');

  const {
    inputs, estimate, summaryText,
    setInjuryType, setSurgery, setLostWages, reset,
  } = useEstimator();

  const goTo = useCallback((next: Step) => {
    setStep(next);
    setStepKey(k => k + 1);
  }, []);

  const handleReset = useCallback(() => {
    reset();
    setSurgeryTouched(false);
    setToken('');
    goTo(0);
  }, [reset, goTo]);

  const sliderFillPct = (inputs.lostWages / LOST_WAGES_MAX) * 100;
  const sliderBg = `linear-gradient(to right, #E8A838 0%, #E8A838 ${sliderFillPct}%, #E8DCC8 ${sliderFillPct}%, #E8DCC8 100%)`;

  // Page-level step transition variants — simple fade, no carousel slide
  const stepVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit:    { opacity: 0 },
  };

  return (
    <div className="ss-widget">

      {/* ── Sam icon ────────────────────────────────────────────────────── */}
      <img
        src="/images/sam-icons/sam-logo.png"
        alt="Sam"
        width="64"
        height="64"
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          objectFit: 'contain',
          display: 'block',
          margin: '0 auto 12px auto',
        }}
      />

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="ss-body">
        <AnimatePresence mode="wait">

          {/* ── Step 0: Injury type ───────────────────────────────────── */}
          {step === 0 && (
            <motion.div
              key={`s0-${stepKey}`}
              className="ss-step"
              variants={stepVariants}
              initial="initial" animate="animate" exit="exit"
              transition={{ duration: 0.18 }}
            >
              <p className="ss-question">What's the main injury?</p>
              <p className="ss-sub">Pick the one that best describes your situation.</p>

              <div className="ss-injury-grid">
                {INJURY_OPTIONS.map(opt => (
                  <button
                    key={opt.type}
                    className={`ss-card${inputs.injuryType === opt.type ? ' ss-card--selected' : ''}`}
                    onClick={() => setInjuryType(opt.type)}
                  >
                    <span className="ss-card__emoji">{opt.emoji}</span>
                    <span className="ss-card__label">{opt.label}</span>
                    <span className="ss-card__sub">{opt.sub}</span>
                  </button>
                ))}
              </div>

              <Nav onNext={() => goTo(1)} nextDisabled={!inputs.injuryType} />
            </motion.div>
          )}

          {/* ── Step 1: Surgery ───────────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key={`s1-${stepKey}`}
              className="ss-step"
              variants={stepVariants}
              initial="initial" animate="animate" exit="exit"
              transition={{ duration: 0.18 }}
            >
              <p className="ss-question">Did you have surgery?</p>
              <p className="ss-sub">Surgery is the single biggest driver of case value.</p>

              <div className="ss-surgery-grid">
                {([
                  { val: true,  cls: 'ss-surgery-card--yes', icon: '🏥',
                    label: 'Yes, I had surgery',      sub: 'Or surgery has been recommended' },
                  { val: false, cls: 'ss-surgery-card--no',  icon: '💊',
                    label: 'No surgery',              sub: 'Treated with medication or therapy' },
                ] as const).map(opt => (
                  <button
                    key={String(opt.val)}
                    className={[
                      'ss-surgery-card',
                      opt.cls,
                      surgeryTouched && inputs.hasSurgery === opt.val
                        ? 'ss-surgery-card--selected'
                        : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => { setSurgery(opt.val); setSurgeryTouched(true); }}
                  >
                    <span className="ss-surgery-icon">{opt.icon}</span>
                    <div>
                      <div className="ss-surgery-label">{opt.label}</div>
                      <div className="ss-surgery-sub">{opt.sub}</div>
                    </div>
                  </button>
                ))}
              </div>

              <Nav onBack={() => goTo(0)} onNext={() => goTo(2)} />
            </motion.div>
          )}

          {/* ── Step 2: Lost wages ────────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key={`s2-${stepKey}`}
              className="ss-step"
              variants={stepVariants}
              initial="initial" animate="animate" exit="exit"
              transition={{ duration: 0.18 }}
            >
              <p className="ss-question">How much income did you lose?</p>
              <p className="ss-sub">Include wages, salary, or self-employment. Set $0 if none.</p>

              <div className="ss-wages-display">
                <motion.div
                  className="ss-wages-amount"
                  key={inputs.lostWages}
                  initial={{ scale: 0.94 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  {inputs.lostWages >= LOST_WAGES_MAX
                    ? '$50k+'
                    : formatCurrency(inputs.lostWages)}
                </motion.div>
                <div className="ss-wages-label">estimated lost income</div>
              </div>

              <div className="ss-slider-wrap">
                <input
                  type="range"
                  className="ss-slider"
                  min={0}
                  max={LOST_WAGES_MAX}
                  step={500}
                  value={inputs.lostWages}
                  style={{ background: sliderBg }}
                  onChange={e   => setLostWages(Number(e.target.value))}
                  onMouseDown={() => setIsDragging(true)}
                  onMouseUp={()   => setIsDragging(false)}
                  onTouchStart={() => setIsDragging(true)}
                  onTouchEnd={()   => setIsDragging(false)}
                />
                <div className="ss-slider-ticks">
                  {WAGE_TICKS.map(t => <span key={t}>{t}</span>)}
                </div>
              </div>

              <Nav
                onBack={() => goTo(1)}
                onNext={() => goTo(3)}
                nextLabel="See My Estimate →"
              />
            </motion.div>
          )}

          {/* ── Step 3: Verification gate ─────────────────────────────── */}
          {step === 3 && estimate && (
            <VerificationGate
              key={`s3-${stepKey}`}
              estimate={estimate}
              inputs={inputs}
              apiBase={apiBase}
              onSuccess={(token, _name) => { setToken(token); goTo(4); }}
              onBack={() => goTo(2)}
            />
          )}

          {/* ── Step 4: Unlocked result ───────────────────────────────── */}
          {step === 4 && estimate && (
            <motion.div
              key={`s4-${stepKey}`}
              className="ss-result"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1   }}
              transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            >
              {/* Gauge + confetti */}
              <div className="ss-gauge-outer">
                <div className="ss-gauge-wrap">
                  <Gauge estimate={estimate} isDragging={isDragging} />
                </div>
                <Confetti />
              </div>

              {/* Dollar range */}
              <div className="ss-range-glow-wrap">
                <div className="ss-range-glow" aria-hidden="true" />
                <div className="ss-result-label">Your case may be worth</div>
                <motion.div
                  className="ss-range-main"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1,    opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 180, damping: 16, delay: 0.12 }}
                >
                  {formatCurrency(estimate.low)}&nbsp;–&nbsp;{formatCurrency(estimate.high)}
                </motion.div>
              </div>

              {summaryText && (
                <p className="ss-summary-text">{summaryText}</p>
              )}

              <div className="ss-divider" />

              {/* Bridge CTA */}
              <div className="ss-bridge">
                <img src="/images/sam-icons/sam-logo.png" width={56} height={56} alt="" aria-hidden="true" style={{ display: 'block', margin: '0 auto 10px', borderRadius: '50%', objectFit: 'contain' }} />
                <h3 className="ss-bridge-headline">Here's what I found for you.</h3>
                <p className="ss-bridge-sub">
                  This is just the starting point — a 3-minute full review with Sam
                  could be the difference between $18k and $180k.
                </p>

                <motion.a
                  className="ss-bridge-cta ss-bridge-cta--pulse"
                  href={funnelHref}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Get My Full Case Review with Sam →
                </motion.a>

                <p className="ss-bridge-urgency">
                  🗓 Sam reviews cases Monday–Friday. Spots fill by noon most days.
                </p>
              </div>

              <div className="ss-divider" />

              <button className="ss-restart" onClick={handleReset}>
                ↺ Start over
              </button>

              <p className="ss-disclaimer">
                This estimate is based on general settlement data and is not legal
                advice. Every case is different. Actual results depend on the
                specific facts, applicable law, and many other factors. Talk to a
                licensed attorney for a real evaluation.
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

export default CaseEstimatorWidget;
