'use client';
/**
 * components/widget/VerificationGate.tsx
 *
 * Step 3 of the widget flow — collects name, phone, and carrier,
 * sends the SMS OTP, then verifies it. On success calls onSuccess().
 *
 * Visual: frosted blurred estimate behind the form,
 * Sam avatar on lock card, 4-box OTP entry.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/estimator/logic';
import type { EstimateRange, EstimatorInputs } from '@/lib/estimator/types';

// ── Carrier list (most common first, "not sure" last) ──────────────────────────
export const CARRIERS: { label: string; gateway: string }[] = [
  { label: 'T-Mobile',              gateway: 'tmomail.net'                },
  { label: 'Verizon',               gateway: 'vtext.com'                  },
  { label: 'AT&T',                  gateway: 'txt.att.net'                },
  { label: 'Cricket',               gateway: 'sms.cricketwireless.net'    },
  { label: 'Boost Mobile',          gateway: 'sms.myboostmobile.com'      },
  { label: 'Metro PCS',             gateway: 'mymetropcs.com'             },
  { label: 'Google Fi',             gateway: 'msg.fi.google.com'          },
  { label: 'Mint Mobile',           gateway: 'tmomail.net'                },
  { label: 'Visible',               gateway: 'vsblmobile.com'             },
  { label: 'Tello',                 gateway: 'tellomail.com'              },
  { label: 'Consumer Cellular',     gateway: 'mailmymobile.net'           },
  { label: 'Straight Talk',         gateway: 'vtext.com'                  },
  { label: 'Ting',                  gateway: 'message.ting.com'           },
  { label: 'Republic Wireless',     gateway: 'text.republicwireless.com'  },
  { label: 'Sprint',                gateway: 'messaging.sprintpcs.com'    },
  { label: 'US Cellular',           gateway: 'email.uscc.net'             },
  { label: 'TracFone',              gateway: 'mmst5.tracfone.com'         },
  { label: "I'm not sure / Other",  gateway: 'MULTI_BLAST'                },
];

// ── Sam avatar ─────────────────────────────────────────────────────────────────
function SamAvatar() {
  return (
    <img src="/images/sam-icons/sam-logo.png" width={72} height={72} alt="Settlement Sam" />
  );
}

// ── 4-digit OTP input ──────────────────────────────────────────────────────────
function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slots = value.padEnd(4, ' ').split('').slice(0, 4);

  const focusAt = (i: number) => {
    const els = containerRef.current?.querySelectorAll<HTMLInputElement>('.ss-code-digit');
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
    if (pasted) {
      onChange(pasted);
      focusAt(Math.min(pasted.length, 3));
    }
    e.preventDefault();
  };

  return (
    <div ref={containerRef} className="ss-code-inputs" onPaste={handlePaste}>
      {[0, 1, 2, 3].map(i => (
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

// ── VerificationGate ───────────────────────────────────────────────────────────
export function VerificationGate({
  estimate, inputs, apiBase, onSuccess, onBack,
  isQuizMode = false, quizAnswers,
}: VerificationGateProps) {
  const [subStep,  setSubStep]  = useState<'phone' | 'code'>('phone');
  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [carrier,  setCarrier]  = useState('');
  const [code,     setCode]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1_000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSendCode = async () => {
    setError('');
    setLoading(true);
    try {
      const res  = await fetch(`${apiBase}/send-code`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), phone, carrier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to send code.');
      setSubStep('code');
      setCooldown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError('');
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        phone,
        code,
        name:         name.trim(),
        carrier,
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
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const canSend   = name.trim().length >= 1
    && phone.replace(/\D/g, '').length === 10
    && !!carrier;
  const canVerify = code.replace(/\s/g, '').length === 4;

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
              I just want to make sure this gets to the right person.&nbsp;👋
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
                  onChange={e => setPhone(e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                />
              </div>

              <div className="ss-field">
                <label className="ss-field-label" htmlFor="ss-carrier">Carrier</label>
                <div className="ss-select-wrap">
                  <select
                    id="ss-carrier"
                    className="ss-field-select"
                    value={carrier}
                    onChange={e => setCarrier(e.target.value)}
                  >
                    <option value="">Select your carrier…</option>
                    {CARRIERS.map(c => (
                      <option key={`${c.label}-${c.gateway}`} value={c.gateway}>{c.label}</option>
                    ))}
                  </select>
                  <span className="ss-select-arrow" aria-hidden="true">▾</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--ss-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
                  {carrier === 'MULTI_BLAST'
                    ? "📡 Sam will blast all major gateways — you'll get it on whichever matches your phone."
                    : "Not sure? Select \"I'm not sure / Other\" and Sam will figure it out."}
                </p>
              </div>
            </div>

            {error && <p className="ss-verify-error" role="alert">{error}</p>}

            <button
              className="ss-bridge-cta"
              onClick={handleSendCode}
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
              Sam just sent a 4-digit code to&nbsp;
              <span className="ss-lock-phone">{phone}</span>.
            </p>

            <CodeInput value={code} onChange={setCode} />

            {error && (
              <p className="ss-verify-error" role="alert">
                {error}&nbsp;
                {error.includes("didn't match") && (
                  <button
                    className="ss-resend-inline"
                    onClick={handleSendCode}
                    disabled={cooldown > 0 || loading}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend →'}
                  </button>
                )}
              </p>
            )}

            <button
              className="ss-bridge-cta"
              onClick={handleVerifyCode}
              disabled={!canVerify || loading}
              style={{ marginTop: 22 }}
            >
              {loading ? 'Checking…' : 'Unlock My Estimate 🔓'}
            </button>

            <button
              className="ss-resend"
              onClick={handleSendCode}
              disabled={cooldown > 0 || loading}
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get it? Resend →"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
