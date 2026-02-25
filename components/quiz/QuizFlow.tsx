'use client';
/**
 * components/quiz/QuizFlow.tsx
 *
 * 11 questions → contact form → Firebase SMS verify → results
 *
 * Screens:
 *   'quiz'          — questions 1–11
 *   'contact'       — first name, last name, phone, email
 *   'verify'        — 6-digit Firebase OTP
 *   'success'       — personalized results with estimate, key factors
 *   'attorney_exit' — soft exit when hasAttorney = 'yes'
 *   'disqualified'  — hard exit when atFault = true
 */

import React, { useCallback, useReducer, useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QUIZ_QUESTIONS, US_STATES } from '@/lib/quiz/questions';
import type { QuizQuestion, QuizOption } from '@/lib/quiz/questions';
import {
  calculateScore,
  scoreTier,
  calculateQuizEstimate,
  getKeyFactors,
  DISQUALIFIER_MESSAGES,
} from '@/lib/quiz/scoring';
import type { QuizAnswers, DisqualReason } from '@/lib/quiz/types';
import { INITIAL_ANSWERS } from '@/lib/quiz/types';
import { formatCurrency, LOST_WAGES_MAX } from '@/lib/estimator/logic';
import {
  sendVerificationCode,
  verifyCode,
  mapFirebaseAuthError,
} from '@/lib/firebase/phone-auth';
import { validateEmailFormat } from '@/lib/validate-email';

// ── Phone formatter ────────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3)  return d;
  if (d.length <= 6)  return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

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

// ── 6-digit code input ────────────────────────────────────────────────────────

const CODE_LENGTH = 6;

function SqCodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slots = value.padEnd(CODE_LENGTH, ' ').split('').slice(0, CODE_LENGTH);

  const focusAt = (i: number) => {
    const els = containerRef.current?.querySelectorAll<HTMLInputElement>('.sq-code-digit');
    els?.[i]?.focus();
  };

  const handleChange = (i: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    const next  = slots.map((s, idx) => (idx === i ? (digit || ' ') : s));
    onChange(next.join('').trimEnd());
    if (digit && i < CODE_LENGTH - 1) focusAt(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (slots[i].trim()) {
        const next = slots.map((s, idx) => (idx === i ? ' ' : s));
        onChange(next.join('').trimEnd());
      } else if (i > 0) {
        focusAt(i - 1);
      }
    } else if (e.key === 'ArrowLeft'  && i > 0)              focusAt(i - 1);
      else if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) focusAt(i + 1);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (pasted) { onChange(pasted); focusAt(Math.min(pasted.length, CODE_LENGTH - 1)); }
    e.preventDefault();
  };

  return (
    <div ref={containerRef} className="sq-code-input" onPaste={handlePaste}>
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
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
  const router = useRouter();
  const [answers,    dispatch]    = useReducer(quizReducer, INITIAL_ANSWERS);
  const [stepPos,    setStepPos]  = useState(0);
  const [direction,  setDirection] = useState(1);
  const [stepKey,    setStepKey]  = useState(0);
  const [screen,     setScreen]   = useState<Screen>('quiz');
  const [disqReason, setDisqReason] = useState<DisqualReason | null>(null);
  const [alert, setAlert]         = useState<{ type: 'warning' | 'tip' | 'success'; msg: string } | null>(null);

  // Contact form
  const [firstName,   setFirstName]  = useState('');
  const [lastName,    setLastName]   = useState('');
  const [phone,       setPhone]      = useState('');
  const [email,       setEmail]      = useState('');
  const [emailError,  setEmailError] = useState('');
  const [formError,   setFormError]  = useState('');

  // Verify
  const [code,        setCode]        = useState('');
  const [loading,     setLoading]     = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [cooldown,    setCooldown]    = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [codeAttempts, setCodeAttempts] = useState(0);

  const MAX_RESENDS       = 3;
  const MAX_CODE_ATTEMPTS = 5;

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

  const formatCooldown = (s: number) => `0:${String(s).padStart(2, '0')}`;

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
    setEmail(''); setFormError('');
    setCode(''); setVerifyError(''); setCooldown(0);
    setResendCount(0); setCodeAttempts(0); setEmailError('');
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

    if (opt.isDisq) {
      setAnswer(q.id, parsed);
      setDisqReason('at_fault');
      setScreen('disqualified');
      return;
    }

    if (opt.isSoftExit) {
      setAnswer(q.id, parsed);
      setScreen('attorney_exit');
      return;
    }

    setAnswer(q.id, parsed);

    const alertMsg  = opt.reaction || opt.warning || opt.tip || null;
    const alertType = opt.reaction ? 'success' : opt.warning ? 'warning' : 'tip';

    if (alertMsg) {
      setAlert({ type: alertType, msg: alertMsg });
      setTimeout(() => { setAlert(null); advanceStep(); }, 2500);
    } else {
      setTimeout(() => advanceStep(), 200);
    }
  };

  // ── Send Firebase OTP (from contact form) ──────────────────────────────────

  const handleSendCode = async (isResend = false) => {
    if (isResend && resendCount >= MAX_RESENDS) {
      setVerifyError('Too many attempts. Please try again later.');
      return;
    }
    setFormError('');
    setVerifyError('');

    if (!isResend) {
      // Validate contact form fields
      const cleanPhone = phone.replace(/\D/g, '');
      if (!firstName.trim())            return setFormError('Please enter your first name.');
      if (!lastName.trim())             return setFormError('Please enter your last name.');
      if (cleanPhone.length !== 10)     return setFormError('Please enter a valid 10-digit phone number.');
      const emailErr = validateEmailFormat(email);
      if (emailErr)                     return setFormError(emailErr);
    }

    setLoading(true);
    try {
      await sendVerificationCode(phone);
      if (!isResend) setScreen('verify');
      setCooldown(60);
      if (isResend) setResendCount(r => r + 1);
    } catch (err: unknown) {
      const msg = mapFirebaseAuthError(err);
      if (isResend) setVerifyError(msg);
      else          setFormError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP + save lead ──────────────────────────────────────────────────

  const handleVerifyCode = async () => {
    if (codeAttempts >= MAX_CODE_ATTEMPTS) {
      setVerifyError('Too many wrong attempts. Request a new code.');
      return;
    }
    setVerifyError('');
    setLoading(true);

    const score = calculateScore(answers as QuizAnswers);
    const tier  = scoreTier(score);
    const est   = estimate;

    let injuryType = 'soft_tissue';
    if (answers.hasSurgery)      injuryType = 'spinal';
    else if (answers.hospitalized) injuryType = 'fracture';

    try {
      const { idToken } = await verifyCode(code);

      const body: Record<string, unknown> = {
        ...answers,
        idToken,
        name:         `${firstName.trim()} ${lastName.trim()}`,
        email:        email.trim(),
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
      // Redirect to lead thank-you page with name and state
      const params = new URLSearchParams({
        name: firstName.trim(),
        state: String(answers.state ?? ''),
      });
      router.push(`/thank-you/lead?${params.toString()}`);
    } catch (err: unknown) {
      const fbMsg = mapFirebaseAuthError(err);
      if (fbMsg.includes("didn't match")) {
        const newAttempts = codeAttempts + 1;
        setCodeAttempts(newAttempts);
        const left = MAX_CODE_ATTEMPTS - newAttempts;
        setVerifyError(
          left > 0
            ? `${fbMsg} ${left} attempt${left !== 1 ? 's' : ''} remaining.`
            : 'No attempts left. Request a new code.',
        );
      } else {
        setVerifyError(err instanceof Error ? err.message : fbMsg);
      }
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
      const workVal  = currentVal as string | null;
      const showSlider = workVal === 'yes_missed' || workVal === 'yes_cant_work';
      const wages    = answers.lostWages;
      const pct      = (wages / LOST_WAGES_MAX) * 100;
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
        {/* Invisible reCAPTCHA anchor */}
        <div id="recaptcha-container" />

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
              Where should we send your results? We'll text you a quick verification code.
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
                onChange={e => setPhone(formatPhone(e.target.value))}
                autoComplete="tel"
                inputMode="tel"
              />
            </div>

            <div className="sq-field">
              <label className="sq-field-label" htmlFor="sq-email">Email Address</label>
              <input
                id="sq-email"
                className={`sq-text-input${emailError ? ' sq-input--error' : ''}`}
                type="email"
                placeholder="sam@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                onBlur={() => {
                  if (email) {
                    const err = validateEmailFormat(email);
                    setEmailError(err ?? '');
                  }
                }}
                autoComplete="email"
              />
              {emailError && (
                <p className="sq-field-error" role="alert">{emailError}</p>
              )}
            </div>

            {formError && <p className="sq-form-error" role="alert">{formError}</p>}

            <button
              className="sq-btn-submit"
              onClick={() => handleSendCode(false)}
              disabled={loading}
            >
              {loading ? 'Sending your code…' : 'Send Me My Results →'}
            </button>

            <p className="sq-privacy-note">
              🔒 Your info is safe. Standard SMS rates may apply.
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
    const canVerify = code.replace(/\s/g, '').length === CODE_LENGTH;
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
                We sent a 6-digit code to <strong>{phone}</strong>.
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

            {resendCount < MAX_RESENDS ? (
              <button
                className="sq-resend-btn"
                onClick={() => handleSendCode(true)}
                disabled={cooldown > 0 || loading}
              >
                {cooldown > 0
                  ? `Resend code in ${formatCooldown(cooldown)}`
                  : "Didn't get it? Resend →"}
              </button>
            ) : (
              <p className="sq-resend-btn" style={{ cursor: 'default', opacity: 0.5 }}>
                Too many attempts. Please try again later.
              </p>
            )}

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
    const est     = calculateQuizEstimate(answers as QuizAnswers);
    const factors = getKeyFactors(answers as QuizAnswers);

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

            <motion.div
              className="sq-estimate-block"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
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
                transition={{ delay: 0.3 }}
              >
                <p className="sq-factors-title">Factors working in your favor</p>
                <ul className="sq-factors-list">
                  {factors.map(f => (
                    <li key={f.label} className="sq-factor-check">
                      <span style={{ color: 'var(--ss-green)', fontWeight: 700 }}>✓</span>
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            <motion.div
              className="sq-next-steps"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <p className="sq-factors-title">What happens next</p>
              <ol>
                <li>A licensed attorney reviews your case details{answers.state ? ` in ${answers.state}` : ''}.</li>
                <li>They will contact you within 1 business day.</li>
                <li>Your free consultation is 100% free, no obligation.</li>
              </ol>
            </motion.div>

            <motion.a
              className="sq-btn-cta"
              href="/attorneys"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              Chat With an Attorney Now →
            </motion.a>

            <p className="sq-urgency">
              🗓 Your case details have been submitted. An attorney will reach out within 1 business day.
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
              they're your best resource.
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
