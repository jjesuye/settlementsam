'use client';
/**
 * components/quiz/QuizFlow.tsx
 *
 * 11 questions → contact form → SMS verify → results
 *
 * Screens:
 *   'quiz'          — questions 1–11
 *   'contact'       — first name, last name, phone, email, carrier
 *   'verify'        — 4-digit SMS code
 *   'success'       — personalized results with tier, estimate, key factors
 *   'attorney_exit' — soft exit when hasAttorney = 'yes'
 *   'disqualified'  — hard exit when atFault = true
 */

import React, { useCallback, useReducer, useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { QUIZ_QUESTIONS, US_STATES } from '@/lib/quiz/questions';
import type { QuizQuestion, QuizOption } from '@/lib/quiz/questions';
import {
  checkDisqualifier,
  checkSoftExit,
  calculateScore,
  scoreTier,
  calculateQuizEstimate,
  getKeyFactors,
  DISQUALIFIER_MESSAGES,
} from '@/lib/quiz/scoring';
import type { QuizAnswers, DisqualReason } from '@/lib/quiz/types';
import { INITIAL_ANSWERS } from '@/lib/quiz/types';
import { formatCurrency, LOST_WAGES_MAX } from '@/lib/estimator/logic';
import { CARRIERS } from '@/components/widget/VerificationGate';

// ── Carrier list (reuse from widget) ─────────────────────────────────────────

// ── Reducer ───────────────────────────────────────────────────────────────────

type QuizAction =
  | { type: 'SET_ANSWER'; key: keyof QuizAnswers; value: unknown }
  | { type: 'RESET' };

function quizReducer(state: QuizAnswers, action: QuizAction): QuizAnswers {
  switch (action.type) {
    case 'SET_ANSWER': return { ...state, [action.key]: action.value };
    case 'RESET':      return INITIAL_ANSWERS;
    default:           return state;
  }
}

// ── Slide variants ────────────────────────────────────────────────────────────

const slideVariants = {
  initial: (dir: number) => ({ opacity: 0, x: dir > 0 ? 36 : -36 }),
  animate: { opacity: 1, x: 0 },
  exit:    (dir: number) => ({ opacity: 0, x: dir > 0 ? -36 : 36 }),
};
const springTransition = { type: 'spring' as const, stiffness: 320, damping: 30 };

// ── 4-digit code input ────────────────────────────────────────────────────────

function SqCodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slots = value.padEnd(4, ' ').split('').slice(0, 4);

  const focusAt = (i: number) => {
    const els = containerRef.current?.querySelectorAll<HTMLInputElement>('.sq-code-digit');
    els?.[i]?.focus();
  };

  const handleChange = (i: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    const next  = slots.map((s, idx) => (idx === i ? (digit || ' ') : s));
    onChange(next.join('').trimEnd());
    if (digit && i < 3) focusAt(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (slots[i].trim()) {
        const next = slots.map((s, idx) => (idx === i ? ' ' : s));
        onChange(next.join('').trimEnd());
      } else if (i > 0) {
        focusAt(i - 1);
      }
    } else if (e.key === 'ArrowLeft'  && i > 0) focusAt(i - 1);
      else if (e.key === 'ArrowRight' && i < 3) focusAt(i + 1);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted) { onChange(pasted); focusAt(Math.min(pasted.length, 3)); }
    e.preventDefault();
  };

  return (
    <div ref={containerRef} className="sq-code-input" onPaste={handlePaste}>
      {[0, 1, 2, 3].map(i => (
        <input
          key={i}
          className={`sq-code-digit${slots[i].trim() ? ' sq-code-digit--filled' : ''}`}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          value={slots[i].trim()}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          autoFocus={i === 0}
          aria-label={`Code digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ── Alert box ─────────────────────────────────────────────────────────────────

function AlertBox({ type, msg }: { type: 'warning' | 'tip' | 'success'; msg: string }) {
  const icon = type === 'warning' ? '⚠️' : type === 'tip' ? 'ℹ️' : '✅';
  return (
    <motion.div
      className={`sq-alert sq-alert--${type}`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <span className="sq-alert__icon">{icon}</span>
      <span>{msg}</span>
    </motion.div>
  );
}

// ── Screen type ───────────────────────────────────────────────────────────────

type Screen = 'quiz' | 'contact' | 'verify' | 'success' | 'attorney_exit' | 'disqualified';

// ── Main component ────────────────────────────────────────────────────────────

export function QuizFlow() {
  const [answers,    dispatch]    = useReducer(quizReducer, INITIAL_ANSWERS);
  const [stepPos,    setStepPos]  = useState(0);
  const [direction,  setDirection] = useState(1);
  const [stepKey,    setStepKey]  = useState(0);
  const [screen,     setScreen]   = useState<Screen>('quiz');
  const [disqReason, setDisqReason] = useState<DisqualReason | null>(null);
  const [alert, setAlert]         = useState<{ type: 'warning' | 'tip' | 'success'; msg: string } | null>(null);

  // Contact form
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [email,     setEmail]     = useState('');
  const [carrier,   setCarrier]   = useState('');
  const [formError, setFormError] = useState('');

  // Verify
  const [code,        setCode]        = useState('');
  const [loading,     setLoading]     = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [cooldown,    setCooldown]    = useState(0);

  const totalQuestions = QUIZ_QUESTIONS.length;
  const currentQ = QUIZ_QUESTIONS[stepPos] ?? QUIZ_QUESTIONS[0];
  const progressPct = (stepPos / totalQuestions) * 100;

  const estimate = useMemo(() => calculateQuizEstimate(answers as QuizAnswers), [answers]);

  // Cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1_000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const setAnswer = useCallback((key: keyof QuizAnswers, value: unknown) => {
    dispatch({ type: 'SET_ANSWER', key, value });
  }, []);

  const advanceStep = useCallback(() => {
    if (stepPos >= totalQuestions - 1) {
      setScreen('contact');
    } else {
      setDirection(1);
      setStepPos(p => p + 1);
      setStepKey(k => k + 1);
    }
  }, [stepPos, totalQuestions]);

  const goBack = useCallback(() => {
    if (stepPos === 0) return;
    setAlert(null);
    setDirection(-1);
    setStepPos(p => p - 1);
    setStepKey(k => k + 1);
  }, [stepPos]);

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
    setStepPos(0);
    setDirection(1);
    setStepKey(k => k + 1);
    setScreen('quiz');
    setDisqReason(null);
    setAlert(null);
    setFirstName(''); setLastName(''); setPhone('');
    setEmail(''); setCarrier(''); setFormError('');
    setCode(''); setVerifyError(''); setCooldown(0);
  }, []);

  /** Parse string option value to typed value */
  function parseValue(raw: string): unknown {
    if (raw === 'true')  return true;
    if (raw === 'false') return false;
    return raw;
  }

  /** Handle option selection for auto-advance questions */
  const handleOptionClick = (q: QuizQuestion, opt: QuizOption) => {
    const parsed = parseValue(opt.value);

    // Hard disqualifier
    if (opt.isDisq) {
      setAnswer(q.id, parsed);
      setDisqReason('at_fault');
      setScreen('disqualified');
      return;
    }

    // Soft exit (has attorney)
    if (opt.isSoftExit) {
      setAnswer(q.id, parsed);
      setScreen('attorney_exit');
      return;
    }

    setAnswer(q.id, parsed);

    // Determine alert
    const alertMsg  = opt.reaction || opt.warning || opt.tip || null;
    const alertType = opt.reaction ? 'success' : opt.warning ? 'warning' : 'tip';

    if (alertMsg) {
      setAlert({ type: alertType, msg: alertMsg });
      setTimeout(() => { setAlert(null); advanceStep(); }, 2500);
    } else {
      setTimeout(() => advanceStep(), 200);
    }
  };

  // ── Send code (from contact form) ──────────────────────────────────────────

  const handleSendCode = async () => {
    setFormError('');
    const cleanPhone = phone.replace(/\D/g, '');
    if (!firstName.trim())              return setFormError('Please enter your first name.');
    if (!lastName.trim())               return setFormError('Please enter your last name.');
    if (cleanPhone.length !== 10)       return setFormError('Please enter a valid 10-digit phone number.');
    if (!email.trim() || !email.includes('@')) return setFormError('Please enter a valid email address.');
    if (!carrier)                       return setFormError('Please select your mobile carrier.');

    setLoading(true);
    try {
      const res  = await fetch('/api/send-code', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: `${firstName.trim()} ${lastName.trim()}`, phone: cleanPhone, carrier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to send code.');
      setScreen('verify');
      setCooldown(60);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend code ────────────────────────────────────────────────────────────

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setVerifyError('');
    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const res  = await fetch('/api/send-code', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: `${firstName.trim()} ${lastName.trim()}`, phone: cleanPhone, carrier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to resend code.');
      setCooldown(60);
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : 'Failed to resend. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Verify code ────────────────────────────────────────────────────────────

  const handleVerifyCode = async () => {
    setVerifyError('');
    setLoading(true);
    const cleanPhone = phone.replace(/\D/g, '');
    const est = estimate;
    const score = calculateScore(answers as QuizAnswers);
    const tier  = scoreTier(score);

    // Derive injury type for legacy field
    let injuryType = 'soft_tissue';
    if (answers.hasSurgery)      injuryType = 'spinal';
    else if (answers.hospitalized) injuryType = 'fracture';

    try {
      const body: Record<string, unknown> = {
        ...answers,
        phone:        cleanPhone,
        code:         code.replace(/\s/g, ''),
        name:         `${firstName.trim()} ${lastName.trim()}`,
        email:        email.trim(),
        carrier,
        injuryType,
        surgery:      answers.hasSurgery,
        estimateLow:  est.low,
        estimateHigh: est.high,
        score,
        tier,
        source:       'quiz',
      };
      const res  = await fetch('/api/verify-code', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Verification failed.');
      setScreen('success');
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render question ────────────────────────────────────────────────────────

  const renderQuestion = (q: QuizQuestion) => {
    const currentVal = answers[q.id];

    // State select
    if (q.type === 'state-select') {
      return (
        <>
          <div className="sq-select-wrap">
            <select
              className="sq-select"
              value={(currentVal as string) ?? ''}
              onChange={e => setAnswer(q.id, e.target.value || null)}
            >
              <option value="">Select your state…</option>
              {US_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span className="sq-select-arrow" aria-hidden="true">▾</span>
          </div>
          <div className="sq-nav">
            <button className="sq-btn-back" onClick={goBack}>← Back</button>
            <button
              className="sq-btn-next"
              onClick={advanceStep}
              disabled={!currentVal}
            >
              Next →
            </button>
          </div>
        </>
      );
    }

    // Wages-with-slider (Q9)
    if (q.type === 'wages-with-slider') {
      const workVal = currentVal as string | null;
      const showSlider = workVal === 'yes_missed' || workVal === 'yes_cant_work';
      const wages = answers.lostWages;
      const pct   = (wages / LOST_WAGES_MAX) * 100;
      const sliderBg = `linear-gradient(to right, #E8A838 0%, #E8A838 ${pct}%, #E8DCC8 ${pct}%, #E8DCC8 100%)`;

      return (
        <>
          <div className="sq-options">
            {(q.options ?? []).map(opt => {
              const selected = String(workVal) === opt.value;
              return (
                <button
                  key={opt.value}
                  className={`sq-option${selected ? ' sq-option--selected' : ''}`}
                  onClick={() => setAnswer(q.id, opt.value)}
                >
                  {opt.icon && <span className="sq-option__icon">{opt.icon}</span>}
                  <span className="sq-option__text">
                    <span className="sq-option__label">{opt.label}</span>
                    {opt.sub && <span className="sq-option__sub">{opt.sub}</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {showSlider && (
              <motion.div
                className="sq-wages-section"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
              >
                <p className="sq-wages-label-text">How much income have you lost so far?</p>
                <div className="sq-wages-display">
                  <motion.div
                    className="sq-wages-amount"
                    key={wages}
                    initial={{ scale: 0.94 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    {wages >= LOST_WAGES_MAX ? '$50k+' : formatCurrency(wages)}
                  </motion.div>
                  <div className="sq-wages-label">estimated lost income</div>
                </div>
                <div className="sq-slider-wrap">
                  <input
                    type="range"
                    className="sq-slider"
                    min={0}
                    max={LOST_WAGES_MAX}
                    step={500}
                    value={wages}
                    style={{ background: sliderBg }}
                    onChange={e => setAnswer('lostWages', Number(e.target.value))}
                  />
                  <div className="sq-slider-ticks">
                    {['$0', '$10k', '$25k', '$50k+'].map(t => <span key={t}>{t}</span>)}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="sq-nav">
            <button className="sq-btn-back" onClick={goBack}>← Back</button>
            <button
              className="sq-btn-next"
              onClick={advanceStep}
              disabled={!workVal}
            >
              Next →
            </button>
          </div>
        </>
      );
    }

    // Standard options (auto-advance)
    if (q.type === 'options' && q.options) {
      return (
        <>
          <div className={`sq-options${q.layout === 'grid' ? ' sq-options--grid' : ''}`}>
            {q.options.map(opt => {
              const parsed   = parseValue(opt.value);
              const selected = String(currentVal) === String(parsed) || currentVal === parsed;
              return (
                <button
                  key={opt.value}
                  className={`sq-option${selected ? ' sq-option--selected' : ''}`}
                  onClick={() => handleOptionClick(q, opt)}
                >
                  {opt.icon && <span className="sq-option__icon">{opt.icon}</span>}
                  <span className="sq-option__text">
                    <span className="sq-option__label">{opt.label}</span>
                    {opt.sub && <span className="sq-option__sub">{opt.sub}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {stepPos > 0 && (
            <button className="sq-btn-back-plain" onClick={goBack}>← Back</button>
          )}
        </>
      );
    }

    return null;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SCREEN: QUIZ
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === 'quiz') {
    return (
      <div className="sq-page">
        <div className="sq-topbar">
          <div className="sq-brand">
            <img src="/images/sam-icons/sam-logo.png" height={24} alt="" aria-hidden="true" className="sq-brand-icon" style={{ borderRadius: '50%', objectFit: 'contain' }} />
          </div>
          <span className="sq-step-counter">{stepPos + 1} / {totalQuestions}</span>
        </div>

        <div className="sq-progress-bar">
          <div className="sq-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`q-${stepKey}`}
            className="sq-card"
            variants={slideVariants}
            custom={direction}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={springTransition}
          >
            <h2 className="sq-headline">{currentQ.headline}</h2>
            {currentQ.sub && <p className="sq-sub">{currentQ.sub}</p>}

            <AnimatePresence>
              {alert && <AlertBox key="alert" type={alert.type} msg={alert.msg} />}
            </AnimatePresence>

            {renderQuestion(currentQ)}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SCREEN: CONTACT FORM
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === 'contact') {
    return (
      <div className="sq-page">
        <div className="sq-topbar">
          <div className="sq-brand">
            <img src="/images/sam-icons/sam-logo.png" height={24} alt="" aria-hidden="true" className="sq-brand-icon" style={{ borderRadius: '50%', objectFit: 'contain' }} />
          </div>
          <span className="sq-step-counter">Almost done!</span>
        </div>
        <div className="sq-progress-bar">
          <div className="sq-progress-fill" style={{ width: '92%' }} />
        </div>

        <motion.div
          className="sq-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div style={{ textAlign: 'center' }}>
            <img
              src="/images/sam-icons/sam-logo.png"
              width={64} height={64}
              alt="Settlement Sam"
              style={{ borderRadius: '50%', objectFit: 'contain', display: 'block', margin: '0 auto 12px' }}
            />
            <h2 className="sq-headline" style={{ marginBottom: 4 }}>One last thing…</h2>
            <p className="sq-sub" style={{ marginBottom: 0 }}>
              Where should Sam send your results? I'll text you a quick verification code.
            </p>
          </div>

          <div className="sq-contact-form">
            <div className="sq-field-row">
              <div className="sq-field">
                <label className="sq-field-label" htmlFor="sq-first">First Name</label>
                <input
                  id="sq-first"
                  className="sq-text-input"
                  type="text"
                  placeholder="Sam"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="sq-field">
                <label className="sq-field-label" htmlFor="sq-last">Last Name</label>
                <input
                  id="sq-last"
                  className="sq-text-input"
                  type="text"
                  placeholder="Johnson"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="sq-field">
              <label className="sq-field-label" htmlFor="sq-phone">Mobile Phone</label>
              <input
                id="sq-phone"
                className="sq-text-input"
                type="tel"
                placeholder="(555) 867-5309"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                autoComplete="tel"
                inputMode="tel"
              />
            </div>

            <div className="sq-field">
              <label className="sq-field-label" htmlFor="sq-email">Email Address</label>
              <input
                id="sq-email"
                className="sq-text-input"
                type="email"
                placeholder="sam@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="sq-field">
              <label className="sq-field-label" htmlFor="sq-carrier">Mobile Carrier</label>
              <div className="sq-select-wrap">
                <select
                  id="sq-carrier"
                  className="sq-select"
                  value={carrier}
                  onChange={e => setCarrier(e.target.value)}
                >
                  <option value="">Select your carrier…</option>
                  {CARRIERS.map(c => (
                    <option key={`${c.label}-${c.gateway}`} value={c.gateway}>{c.label}</option>
                  ))}
                </select>
                <span className="sq-select-arrow" aria-hidden="true">▾</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--ss-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
                {carrier === 'MULTI_BLAST'
                  ? "📡 Sam will blast all major gateways — you'll get it on whichever matches your phone."
                  : 'Not sure? Select "I\'m not sure / Other" and Sam will figure it out.'}
              </p>
            </div>

            {formError && <p className="sq-form-error" role="alert">{formError}</p>}

            <button
              className="sq-btn-submit"
              onClick={handleSendCode}
              disabled={loading}
            >
              {loading ? 'Sending your code…' : 'Send Me My Results →'}
            </button>

            <p className="sq-privacy-note">
              🔒 Sam never sells your info. Standard SMS rates may apply.
            </p>
          </div>

          <button className="sq-btn-back-plain" onClick={() => { setDirection(-1); setScreen('quiz'); setStepPos(totalQuestions - 1); }}>
            ← Back to quiz
          </button>
        </motion.div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SCREEN: VERIFY
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === 'verify') {
    const canVerify = code.replace(/\s/g, '').length === 4;
    return (
      <div className="sq-page">
        <div className="sq-topbar">
          <div className="sq-brand">
            <img src="/images/sam-icons/sam-logo.png" height={24} alt="" aria-hidden="true" className="sq-brand-icon" style={{ borderRadius: '50%', objectFit: 'contain' }} />
          </div>
          <span className="sq-step-counter">Verify</span>
        </div>
        <div className="sq-progress-bar">
          <div className="sq-progress-fill" style={{ width: '97%' }} />
        </div>

        <motion.div
          className="sq-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="sq-verify-screen">
            <img
              src="/images/sam-icons/sam-logo.png"
              width={72} height={72}
              alt="Settlement Sam"
              style={{ borderRadius: '50%', objectFit: 'contain', display: 'block', margin: '0 auto' }}
            />

            <div>
              <h2 className="sq-headline" style={{ marginBottom: 6 }}>Check your texts!</h2>
              <p className="sq-sub" style={{ marginBottom: 0 }}>
                Sam sent a 4-digit code to <strong>{phone}</strong>.
              </p>
            </div>

            <SqCodeInput value={code} onChange={setCode} />

            {verifyError && (
              <p className="sq-form-error" role="alert" style={{ width: '100%', textAlign: 'center' }}>
                {verifyError}
              </p>
            )}

            <button
              className="sq-btn-submit"
              onClick={handleVerifyCode}
              disabled={!canVerify || loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Unlocking…' : 'Unlock My Results →'}
            </button>

            <button
              className="sq-resend-btn"
              onClick={handleResend}
              disabled={cooldown > 0 || loading}
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get it? Resend →"}
            </button>

            <button className="sq-btn-back-plain" onClick={() => setScreen('contact')}>
              ← Change my number
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SCREEN: SUCCESS
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === 'success') {
    const score    = calculateScore(answers as QuizAnswers);
    const tier     = scoreTier(score);
    const est      = calculateQuizEstimate(answers as QuizAnswers);
    const factors  = getKeyFactors(answers as QuizAnswers);

    const tierLabel = tier === 'HOT'  ? '🔥 High-Value Case'
                    : tier === 'WARM' ? '⭐ Strong Case'
                    :                   '📋 Case Logged';

    return (
      <div className="sq-page">
        <div className="sq-topbar">
          <div className="sq-brand">
            <img src="/images/sam-icons/sam-logo.png" height={24} alt="" aria-hidden="true" className="sq-brand-icon" style={{ borderRadius: '50%', objectFit: 'contain' }} />
          </div>
        </div>
        <div className="sq-progress-bar">
          <div className="sq-progress-fill" style={{ width: '100%' }} />
        </div>

        <motion.div
          className="sq-card"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        >
          <div className="sq-success">
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
            >
              <img
                src="/images/sam-icons/sam-logo.png"
                width={80} height={80}
                alt="Settlement Sam"
                style={{ borderRadius: '50%', objectFit: 'contain', display: 'block', margin: '0 auto' }}
              />
            </motion.div>

            <h2 className="sq-success-headline">
              {firstName ? `You're in, ${firstName}!` : "You're in!"}
            </h2>

            <motion.span
              className={`sq-tier sq-tier--${tier}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {tierLabel}
            </motion.span>

            <motion.div
              className="sq-estimate-block"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="sq-range-label">Your case may be worth</div>
              <div className="sq-range-value">
                {formatCurrency(est.low)} – {formatCurrency(est.high)}
              </div>
            </motion.div>

            {factors.length > 0 && (
              <motion.div
                className="sq-factors"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <p className="sq-factors-title">Factors working in your favor</p>
                <ul className="sq-factors-list">
                  {factors.map(f => (
                    <li key={f.label} className="sq-factor-check">
                      <span style={{ color: 'var(--ss-green)', fontWeight: 700 }}>✓</span>
                      <span>{f.label}</span>
                      <span style={{ marginLeft: 'auto', color: 'var(--ss-amber)', fontWeight: 700, fontSize: 12 }}>{f.points}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            <motion.div
              className="sq-next-steps"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="sq-factors-title">What happens next</p>
              <ol>
                <li>Sam shares your details with 1–2 pre-screened attorneys{answers.state ? ` in ${answers.state}` : ''}.</li>
                <li>An attorney will contact you within 1 business day.</li>
                <li>The consultation is 100% free, with no obligation.</li>
              </ol>
            </motion.div>

            <motion.a
              className="sq-btn-cta"
              href="/attorneys"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              Chat With an Attorney Now →
            </motion.a>

            <p className="sq-urgency">
              🗓 Sam's attorney network fills fast. Your spot is reserved for 24 hours.
            </p>

            <p style={{ fontSize: 11, color: 'var(--ss-muted)', margin: '4px 0 0', textAlign: 'center', lineHeight: 1.6 }}>
              This estimate is based on general settlement data and is not legal advice.
              Every case is different. Results depend on the specific facts, applicable law,
              and many other factors.
            </p>

            <button className="sq-disq-restart" onClick={handleReset} style={{ marginTop: 4 }}>
              ↺ Start a new evaluation
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SCREEN: ATTORNEY EXIT (soft exit)
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === 'attorney_exit') {
    return (
      <div className="sq-page">
        <div className="sq-topbar">
          <div className="sq-brand">
            <img src="/images/sam-icons/sam-logo.png" height={24} alt="" aria-hidden="true" className="sq-brand-icon" style={{ borderRadius: '50%', objectFit: 'contain' }} />
          </div>
        </div>

        <motion.div
          className="sq-card"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        >
          <div className="sq-attorney-exit">
            <img
              src="/images/sam-icons/sam-logo.png"
              width={72} height={72}
              alt="Settlement Sam"
              style={{ borderRadius: '50%', objectFit: 'contain', display: 'block', margin: '0 auto' }}
            />

            <h2 className="sq-success-headline" style={{ fontSize: 20 }}>
              Sounds like you're in good hands.
            </h2>
            <p className="sq-disq-sub">
              You already have an attorney fighting for you. Keep working with them —
              they're your best resource. Sam doesn't want to step on their toes.
            </p>

            <div className="sq-attorney-questions">
              <h4>Questions to ask your attorney</h4>
              <ul>
                <li>What's the realistic settlement range for my case?</li>
                <li>How much are your fees, and when do I pay?</li>
                <li>What's your strategy for dealing with the insurance adjuster?</li>
                <li>How long do you expect this case to take?</li>
                <li>What are my chances of going to trial?</li>
              </ul>
            </div>

            <Link href="/" className="sq-disq-cta" style={{ display: 'inline-block', textDecoration: 'none', borderRadius: '10px', padding: '12px 24px', background: 'var(--ss-amber)', color: '#fff', fontWeight: 700, fontSize: 14 }}>
              ← Back to Homepage
            </Link>

            <button className="sq-disq-restart" onClick={handleReset}>
              ↺ Start over
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SCREEN: DISQUALIFIED
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === 'disqualified' && disqReason) {
    const msg = DISQUALIFIER_MESSAGES[disqReason];
    return (
      <div className="sq-page">
        <div className="sq-topbar">
          <div className="sq-brand">
            <img src="/images/sam-icons/sam-logo.png" height={24} alt="" aria-hidden="true" className="sq-brand-icon" style={{ borderRadius: '50%', objectFit: 'contain' }} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key="disq"
            className="sq-card"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <div className="sq-disqualified">
              <div className="sq-disq-icon">
                <img
                  src="/images/sam-icons/sam-logo.png"
                  width={72} height={72}
                  alt="Settlement Sam"
                  style={{ borderRadius: '50%', objectFit: 'contain' }}
                />
              </div>

              <h2 className="sq-disq-headline">{msg.headline}</h2>
              <p className="sq-disq-sub">{msg.body}</p>

              <Link href="/attorneys" className="sq-disq-cta" style={{ textDecoration: 'none', borderRadius: '10px', padding: '12px 24px', background: 'var(--ss-coral)', color: '#fff', fontWeight: 700, fontSize: 14, display: 'inline-block' }}>
                Get a Free Attorney Consultation →
              </Link>

              <button className="sq-disq-restart" onClick={handleReset}>
                ← Start Over
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return null;
}
