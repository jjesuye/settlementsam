'use client';
/**
 * components/SMSVerification.tsx
 *
 * Phone verification using Firebase Phone Auth.
 * Texts come from Firebase's own short codes (22395, 44398, etc.) — not personal email.
 *
 * Props:
 *   onVerified(phone, idToken) — called after code confirmed.
 *   leadName?                  — personalised greeting.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, initializeRecaptchaConfig, type ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

// ── Phone formatter ────────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function rawDigits(formatted: string): string {
  return formatted.replace(/\D/g, '');
}

function firebaseErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    switch ((err as { code: string }).code) {
      case 'auth/invalid-phone-number':      return 'Please enter a valid 10-digit US phone number.';
      case 'auth/too-many-requests':         return 'Too many attempts. Please wait a few minutes and try again.';
      case 'auth/invalid-verification-code': return 'Incorrect code. Please try again.';
      case 'auth/code-expired':              return 'Code expired. Please request a new one.';
      case 'auth/missing-phone-number':      return 'Please enter your phone number.';
      case 'auth/quota-exceeded':            return 'SMS quota exceeded. Please try again later.';
      case 'auth/captcha-check-failed':      return 'Verification check failed. Please try again.';
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  onVerified: (phone: string, idToken: string) => void;
  leadName?:  string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SMSVerification({ onVerified, leadName }: Props) {
  const [phone,     setPhone]     = useState('');
  const [codeSent,  setCodeSent]  = useState(false);
  const [code,      setCode]      = useState('');
  const [sending,   setSending]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error,     setError]     = useState('');
  const [cooldown,  setCooldown]  = useState(0);
  const [resends,   setResends]   = useState(0);

  const cooldownRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const recaptchaVerifierRef  = useRef<RecaptchaVerifier | null>(null);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);

  /**
   * Create a fresh RecaptchaVerifier and pre-render it so the widget is fully
   * loaded before the user clicks "Send". Firebase Phone Auth requires a
   * pre-initialized verifier — creating it lazily inside a click handler causes
   * "Hostname match not found" (auth/captcha-check-failed) because the widget
   * hasn't had time to negotiate with Google's reCAPTCHA servers.
   */
  const initRecaptcha = useCallback(async () => {
    // Destroy any existing verifier first
    try { recaptchaVerifierRef.current?.clear(); } catch { /* ignore */ }
    recaptchaVerifierRef.current = null;

    if (typeof window === 'undefined') return;

    try {
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
      await verifier.render(); // blocks until widget is fully loaded
      recaptchaVerifierRef.current = verifier;
    } catch (e) {
      console.error('[reCAPTCHA] init error:', e);
    }
  }, []);

  // Initialize on mount; clean up on unmount
  useEffect(() => {
    // Ensure reCAPTCHA config is downloaded before creating the verifier.
    // This is required in Firebase SDK v10+ to resolve the correct site key
    // for the current hostname (fixes auth/captcha-check-failed).
    initializeRecaptchaConfig(auth)
      .then(() => initRecaptcha())
      .catch(() => initRecaptcha()); // still try even if config fetch fails

    return () => {
      try { recaptchaVerifierRef.current?.clear(); } catch { /* ignore */ }
      recaptchaVerifierRef.current = null;
    };
  }, [initRecaptcha]);

  function startCooldown() {
    setCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1_000);
  }

  async function doSend(digits: string) {
    const verifier = recaptchaVerifierRef.current;
    if (!verifier) throw new Error('Verification service not ready. Please refresh and try again.');
    const result = await signInWithPhoneNumber(auth, `+1${digits}`, verifier);
    confirmationResultRef.current = result;
    // Verifier is consumed after use — re-initialize for any subsequent resend
    initRecaptcha();
  }

  async function handleSend() {
    const digits = rawDigits(phone);
    if (digits.length !== 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    setError('');
    setSending(true);
    try {
      await doSend(digits);
      setCodeSent(true);
      startCooldown();
    } catch (err: unknown) {
      await initRecaptcha(); // fresh verifier for retry
      setError(firebaseErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resends >= 3) return;
    setResends(r => r + 1);
    setCode('');
    setError('');
    setSending(true);
    try {
      await doSend(rawDigits(phone));
      startCooldown();
    } catch (err: unknown) {
      await initRecaptcha();
      setError(firebaseErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function handleVerify(codeToVerify: string) {
    if (codeToVerify.length !== 6) return;
    if (!confirmationResultRef.current) {
      setError('Session expired. Please go back and request a new code.');
      return;
    }
    setError('');
    setVerifying(true);
    try {
      const credential = await confirmationResultRef.current.confirm(codeToVerify);
      const idToken    = await credential.user.getIdToken();
      onVerified(rawDigits(phone), idToken);
    } catch (err: unknown) {
      setError(firebaseErrorMessage(err));
      setVerifying(false);
    }
  }

  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(val);
    setError('');
    if (val.length === 6) handleVerify(val);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  // Single return keeps #recaptcha-container permanently in the DOM so the
  // verifier's widget is never torn down mid-session.

  return (
    <div>
      {/* Invisible reCAPTCHA — must stay mounted; do NOT use display:none */}
      <div id="recaptcha-container" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} />

      {/* ── Step 1: Phone input ─────────────────────────────────────────────── */}
      {!codeSent && (
        <div className="sms-gate">
          <div style={{ marginBottom: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 4 }}>
              {leadName ? `One last step, ${leadName}!` : 'One last step!'}
            </p>
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>
              We&apos;ll text you a 6-digit code to verify it&apos;s you.
            </p>
          </div>

          <input
            type="tel"
            value={phone}
            onChange={e => { setError(''); setPhone(formatPhone(e.target.value)); }}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder="(555) 555-5555"
            maxLength={14}
            inputMode="numeric"
            autoComplete="tel"
            autoFocus
            style={{
              width: '100%', padding: '14px 16px', fontSize: 18,
              textAlign: 'center', letterSpacing: 2,
              border: `2px solid ${error ? '#EF4444' : '#E8DCC8'}`,
              borderRadius: 12, outline: 'none', marginBottom: 8,
              background: '#FFFFFF', boxSizing: 'border-box',
            }}
          />

          {error && (
            <p style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
              {error}
            </p>
          )}

          <button
            onClick={handleSend}
            disabled={rawDigits(phone).length !== 10 || sending}
            style={{
              width: '100%', padding: 14,
              background: sending ? '#D1D5DB' : '#E8A838',
              color: '#FFFFFF', fontSize: 16, fontWeight: 600,
              border: 'none', borderRadius: 12,
              cursor: sending ? 'not-allowed' : 'pointer',
              marginBottom: 12,
            }}
          >
            {sending ? 'Sending…' : 'Text Me My Code 📱'}
          </button>

          <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>
            Standard message rates may apply. We never share your number.
          </p>
        </div>
      )}

      {/* ── Step 2: Code input ──────────────────────────────────────────────── */}
      {codeSent && (
        <div className="sms-verify">
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 15, color: '#2C3E35', fontWeight: 500 }}>
              Code sent to {formatPhone(phone)}
            </p>
            <p style={{ fontSize: 13, color: '#6B7280' }}>
              Enter the 6-digit code from your text message.
            </p>
          </div>

          <input
            type="tel"
            value={code}
            onChange={handleCodeChange}
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            disabled={verifying}
            style={{
              width: '100%', padding: 16, fontSize: 32,
              textAlign: 'center', letterSpacing: 12, fontWeight: 700,
              border: `2px solid ${error ? '#EF4444' : '#E8A838'}`,
              borderRadius: 12, outline: 'none', marginBottom: 8,
              background: '#FFFFFF', boxSizing: 'border-box',
            }}
          />

          {verifying && (
            <p style={{ color: '#E8A838', fontSize: 14, textAlign: 'center', marginBottom: 8 }}>
              Verifying…
            </p>
          )}

          {error && (
            <p style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
              {error}
            </p>
          )}

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            {cooldown > 0 ? (
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>
                Resend code in 0:{String(cooldown).padStart(2, '0')}
              </p>
            ) : resends >= 3 ? (
              <p style={{ fontSize: 13, color: '#EF4444' }}>
                Max resends reached. Please refresh and try again.
              </p>
            ) : (
              <button
                onClick={handleResend}
                disabled={sending}
                style={{
                  background: 'none', border: 'none', color: '#E8A838',
                  fontSize: 14, cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                Didn&apos;t get it? Resend Code
              </button>
            )}

            <button
              onClick={async () => {
                await initRecaptcha();
                confirmationResultRef.current = null;
                setCodeSent(false); setCode(''); setError(''); setCooldown(0);
              }}
              style={{
                display: 'block', margin: '8px auto 0',
                background: 'none', border: 'none',
                color: '#9CA3AF', fontSize: 12, cursor: 'pointer',
              }}
            >
              Wrong number? Go back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
