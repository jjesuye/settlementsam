'use client';
/**
 * components/widget/VerificationGate.tsx
 *
 * Firebase Phone Authentication gate — Step 3 of the widget flow.
 * Collects name + phone, sends a Firebase OTP, then verifies the 6-digit code.
 * On success calls onSuccess(token, firstName).
 *
 * Resend: 60-second cooldown, max 3 resends per session.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/estimator/logic';
import type { EstimateRange, EstimatorInputs } from '@/lib/estimator/types';
import {
  sendVerificationCode,
  verifyCode,
  mapFirebaseAuthError,
} from '@/lib/firebase/phone-auth';

// ── Phone formatter ────────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3)  return d;
  if (d.length <= 6)  return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

// ── Sam avatar ─────────────────────────────────────────────────────────────────

function SamAvatar() {
  return (
    <img src="/images/sam-icons/sam-logo.png" width={72} height={72} alt="Settlement Sam" />
  );
}

// ── 6-digit OTP input ──────────────────────────────────────────────────────────

const CODE_LENGTH = 6;

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slots = value.padEnd(CODE_LENGTH, ' ').split('').slice(0, CODE_LENGTH);

  const focusAt = (i: number) => {
    const els = containerRef.current?.querySelectorAll<HTMLInputElement>('.ss-code-digit');
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
    if (pasted) {
      onChange(pasted);
      focusAt(Math.min(pasted.length, CODE_LENGTH - 1));
    }
    e.preventDefault();
  };

  return (
    <div ref={containerRef} className="ss-code-inputs" onPaste={handlePaste}>
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
        <input
          key={i}
          className={`ss-code-digit${slots[i].trim() ? ' ss-code-digit--filled' : ''}`}
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

// ── Props ──────────────────────────────────────────────────────────────────────

export interface VerificationGateProps {
  estimate:    EstimateRange;
  inputs:      EstimatorInputs;
  apiBase:     string;
  /** Called with the session JWT and the user's first name on success */
  onSuccess:   (token: string, firstName: string) => void;
  onBack:      () => void;
  /** When true, sends full quiz answers to verify-code for a richer lead record */
  isQuizMode?: boolean;
  quizAnswers?: Record<string, unknown>;
}

const MAX_RESENDS = 3;
const COOLDOWN_S  = 60;

// ── VerificationGate ───────────────────────────────────────────────────────────

export function VerificationGate({
  estimate, inputs, apiBase, onSuccess, onBack,
  isQuizMode = false, quizAnswers,
}: VerificationGateProps) {
  const [subStep,      setSubStep]      = useState<'phone' | 'code'>('phone');
  const [name,         setName]         = useState('');
  const [phone,        setPhone]        = useState('');
  const [code,         setCode]         = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [cooldown,     setCooldown]     = useState(0);
  const [resendCount,  setResendCount]  = useState(0);
  const [codeAttempts, setCodeAttempts] = useState(0);

  const MAX_CODE_ATTEMPTS = 5;

  // Resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1_000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const formatCooldown = (s: number) => `0:${String(s).padStart(2, '0')}`;

  // ── Send verification code ─────────────────────────────────────────────────

  const handleSendCode = async (isResend = false) => {
    setError('');
    if (isResend && resendCount >= MAX_RESENDS) {
      setError('Too many attempts. Please try again later.');
      return;
    }
    setLoading(true);
    try {
      await sendVerificationCode(phone);
      setSubStep('code');
      setCooldown(COOLDOWN_S);
      if (isResend) setResendCount(r => r + 1);
    } catch (err: unknown) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP and save lead ───────────────────────────────────────────────

  const handleVerifyCode = async () => {
    if (codeAttempts >= MAX_CODE_ATTEMPTS) {
      setError('Too many wrong attempts. Please request a new code.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { idToken } = await verifyCode(code);

      // Save lead + get JWT from our server
      const body: Record<string, unknown> = {
        idToken,
        name:         name.trim(),
        injuryType:   inputs.injuryType,
        surgery:      inputs.hasSurgery,
        lostWages:    inputs.lostWages,
        estimateLow:  estimate.low,
        estimateHigh: estimate.high,
        source:       isQuizMode ? 'quiz' : 'widget',
        ...(isQuizMode && quizAnswers ? quizAnswers : {}),
      };
      const res  = await fetch(`${apiBase}/verify-code`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Verification failed.');
      onSuccess(data.token ?? '', name.trim());
    } catch (err: unknown) {
      const msg = mapFirebaseAuthError(err);
      if (msg.includes("didn't match")) {
        const newAttempts = codeAttempts + 1;
        setCodeAttempts(newAttempts);
        const left = MAX_CODE_ATTEMPTS - newAttempts;
        setError(
          left > 0
            ? `${msg} ${left} attempt${left !== 1 ? 's' : ''} remaining.`
            : 'No attempts left. Please request a new code.',
        );
      } else {
        setError(err instanceof Error ? err.message : msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const canSend   = name.trim().length >= 1 && phone.replace(/\D/g, '').length === 10;
  const canVerify = code.replace(/\s/g, '').length === CODE_LENGTH;

  // Blurred estimate preview shown behind the lock form
  const BlurredPreview = (
    <div className="ss-gate-preview">
      <div className="ss-gate-preview__blur" aria-hidden="true">
        <div className="ss-result-label">Your case may be worth</div>
        <div className="ss-range-main">
          {formatCurrency(estimate.low)}&nbsp;–&nbsp;{formatCurrency(estimate.high)}
        </div>
      </div>
      <div className="ss-gate-preview__overlay">
        <span className="ss-gate-lock-icon">🔒</span>
        <span>Verify to unlock your estimate</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Invisible reCAPTCHA anchor — required by Firebase Phone Auth */}
      <div id="recaptcha-container" />

      <AnimatePresence mode="wait">
        {subStep === 'phone' ? (
          <motion.div
            key="phone"
            className="ss-step ss-gate-step"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
          >
            {BlurredPreview}

            <div className="ss-lock-card">
              <div className="ss-sam-wrap"><SamAvatar /></div>
              <h3 className="ss-lock-headline">Almost there!</h3>
              <p className="ss-lock-sub">
                Just need to confirm it's really you.&nbsp;👋
              </p>

              <div className="ss-fields">
                <div className="ss-field">
                  <label className="ss-field-label" htmlFor="ss-name">First Name</label>
                  <input
                    id="ss-name"
                    className="ss-field-input"
                    type="text"
                    placeholder="Sam"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoComplete="given-name"
                  />
                </div>

                <div className="ss-field">
                  <label className="ss-field-label" htmlFor="ss-phone">Phone Number</label>
                  <input
                    id="ss-phone"
                    className="ss-field-input"
                    type="tel"
                    placeholder="(555) 867-5309"
                    value={phone}
                    onChange={e => setPhone(formatPhone(e.target.value))}
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>
              </div>

              {error && <p className="ss-verify-error" role="alert">{error}</p>}

              <button
                className="ss-bridge-cta"
                onClick={() => handleSendCode(false)}
                disabled={!canSend || loading}
              >
                {loading ? 'Sending…' : 'Text Me My Code 📱'}
              </button>

              <p className="ss-gate-fine">
                Standard message rates may apply. Sam doesn't sell your info — ever.
              </p>
            </div>

            <div className="ss-nav" style={{ marginTop: 16 }}>
              <button className="ss-btn-back" onClick={onBack}>← Back</button>
            </div>
          </motion.div>

        ) : (
          <motion.div
            key="code"
            className="ss-step ss-gate-step"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
          >
            {BlurredPreview}

            <div className="ss-lock-card">
              <div className="ss-sam-wrap"><SamAvatar /></div>
              <h3 className="ss-lock-headline">Check your texts!</h3>
              <p className="ss-lock-sub">
                Sam just sent a 6-digit code to&nbsp;
                <span className="ss-lock-phone">{phone}</span>.
              </p>

              <CodeInput value={code} onChange={setCode} />

              {error && (
                <p className="ss-verify-error" role="alert">{error}</p>
              )}

              <button
                className="ss-bridge-cta"
                onClick={handleVerifyCode}
                disabled={!canVerify || loading}
                style={{ marginTop: 22 }}
              >
                {loading ? 'Checking…' : 'Unlock My Estimate 🔓'}
              </button>

              {resendCount < MAX_RESENDS ? (
                <button
                  className="ss-resend"
                  onClick={() => handleSendCode(true)}
                  disabled={cooldown > 0 || loading}
                >
                  {cooldown > 0
                    ? `Resend code in ${formatCooldown(cooldown)}`
                    : "Didn't get it? Resend →"}
                </button>
              ) : (
                <p className="ss-resend" style={{ cursor: 'default', opacity: 0.5 }}>
                  Too many attempts. Please try again later.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
