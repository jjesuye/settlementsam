'use client';
/**
 * components/SMSVerification.tsx
 * Self-contained Firebase Phone Auth gate.
 * Attaches reCAPTCHA to the send button (not a hidden div) — the correct Firebase pattern.
 * Calls onVerified(e164Phone) on success.
 */

import { useState, useEffect, useRef } from 'react';
import {
  initRecaptcha,
  sendVerificationCode,
  confirmVerificationCode,
  destroyRecaptcha,
} from '@/lib/firebase/phone-auth';

const BUTTON_ID      = 'sms-send-button';
const RESEND_COOLDOWN = 60;

interface SMSVerificationProps {
  onVerified: (phoneNumber: string) => void;
  leadName?:  string;
}

export default function SMSVerification({ onVerified, leadName }: SMSVerificationProps) {
  const [phone,       setPhone]       = useState('');
  const [codeSent,    setCodeSent]    = useState(false);
  const [code,        setCode]        = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [cooldown,    setCooldown]    = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(false);

  // Initialize reCAPTCHA after component mounts — CRITICAL: must run after DOM exists
  useEffect(() => {
    mountedRef.current = true;

    // Small delay to ensure the button is in the DOM
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        initRecaptcha(BUTTON_ID);
      }
    }, 100);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      if (timerRef.current) clearInterval(timerRef.current);
      destroyRecaptcha();
    };
  }, []);

  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSendCode() {
    if (loading || cooldown > 0) return;
    setError('');
    setLoading(true);

    const result = await sendVerificationCode(phone, BUTTON_ID);
    setLoading(false);

    if (result.success) {
      setCodeSent(true);
      startCooldown();
    } else {
      setError(result.error ?? 'Failed to send code.');
      // Reinitialize reCAPTCHA for next attempt
      setTimeout(() => initRecaptcha(BUTTON_ID), 500);
    }
  }

  async function handleResend() {
    if (resendCount >= 3) {
      setError('Too many attempts. Please refresh the page and try again.');
      return;
    }
    setResendCount(prev => prev + 1);
    setCode('');
    setError('');
    setLoading(true);

    // Reinitialize before resend
    initRecaptcha(BUTTON_ID);
    await new Promise(resolve => setTimeout(resolve, 300));

    const result = await sendVerificationCode(phone, BUTTON_ID);
    setLoading(false);

    if (result.success) {
      startCooldown();
    } else {
      setError(result.error ?? 'Failed to resend code.');
    }
  }

  async function handleVerifyCode() {
    if (code.length !== 6 || loading) return;
    setError('');
    setLoading(true);

    const result = await confirmVerificationCode(code);
    setLoading(false);

    if (result.success) {
      const digits = phone.replace(/\D/g, '');
      const e164   = digits.startsWith('1') ? `+${digits}` : `+1${digits}`;
      onVerified(e164);
    } else {
      setError(result.error ?? 'Incorrect code.');
      setCode('');
    }
  }

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (code.length === 6 && !loading) {
      handleVerifyCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!codeSent) {
    return (
      <div className="sms-gate">
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 4 }}>
            {leadName ? `One last step, ${leadName}!` : 'One last step!'}
          </p>
          <p style={{ fontSize: 13, color: '#9CA3AF' }}>
            We'll send a quick code to verify it's you.
          </p>
        </div>

        <input
          type="tel"
          value={phone}
          onChange={e => { setError(''); setPhone(formatPhone(e.target.value)); }}
          placeholder="(555) 555-5555"
          maxLength={14}
          style={{
            width: '100%', padding: '14px 16px', fontSize: 18,
            textAlign: 'center', letterSpacing: 2,
            border: `2px solid ${error ? '#EF4444' : '#E8DCC8'}`,
            borderRadius: 12, outline: 'none', marginBottom: 8,
            background: '#FFFFFF', boxSizing: 'border-box',
          }}
          inputMode="numeric"
          autoComplete="tel"
          autoFocus
        />

        {error && (
          <p style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
            {error}
          </p>
        )}

        <button
          id={BUTTON_ID}
          onClick={handleSendCode}
          disabled={phone.replace(/\D/g, '').length < 10 || loading}
          style={{
            width: '100%', padding: 14,
            background: loading ? '#D1D5DB' : '#E8A838',
            color: '#FFFFFF', fontSize: 16, fontWeight: 600,
            border: 'none', borderRadius: 12,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: 12,
          }}
        >
          {loading ? 'Sending…' : 'Text Me My Code 📱'}
        </button>

        <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>
          Standard message rates may apply. We never share your number.
        </p>
      </div>
    );
  }

  return (
    <div className="sms-verify">
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 15, color: '#2C3E35', fontWeight: 500 }}>
          Code sent to {phone}
        </p>
        <p style={{ fontSize: 13, color: '#6B7280' }}>
          Enter the 6-digit code from your text message.
        </p>
      </div>

      <input
        type="text"
        value={code}
        onChange={e => { setError(''); setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
        placeholder="000000"
        maxLength={6}
        style={{
          width: '100%', padding: 16, fontSize: 32,
          textAlign: 'center', letterSpacing: 12, fontWeight: 700,
          border: `2px solid ${error ? '#EF4444' : '#E8A838'}`,
          borderRadius: 12, outline: 'none', marginBottom: 8,
          background: '#FFFFFF', boxSizing: 'border-box',
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
      />

      {error && (
        <p style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
          {error}
        </p>
      )}

      {loading && (
        <p style={{ color: '#E8A838', fontSize: 14, textAlign: 'center', marginBottom: 8 }}>
          Verifying…
        </p>
      )}

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        {cooldown > 0 ? (
          <p style={{ fontSize: 13, color: '#9CA3AF' }}>
            Resend code in 0:{String(cooldown).padStart(2, '0')}
          </p>
        ) : resendCount < 3 ? (
          <button
            onClick={handleResend}
            disabled={loading}
            style={{
              background: 'none', border: 'none', color: '#E8A838',
              fontSize: 14, cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Didn't get it? Resend Code
          </button>
        ) : (
          <p style={{ fontSize: 13, color: '#EF4444' }}>
            Too many attempts. Please refresh and try again.
          </p>
        )}

        <button
          onClick={() => {
            setCodeSent(false);
            setCode('');
            setError('');
            setCooldown(0);
            if (timerRef.current) clearInterval(timerRef.current);
            setTimeout(() => initRecaptcha(BUTTON_ID), 300);
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
  );
}
