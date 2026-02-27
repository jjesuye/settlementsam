'use client';
/**
 * components/SMSVerification.tsx
 *
 * Native SMS verification using our own carrier-gateway system.
 * No Firebase Phone Auth / reCAPTCHA.
 *
 * Props:
 *   onVerified(phone, phoneToken) — called after code confirmed.
 *   leadName?                     — personalised greeting.
 */

import React, { useRef, useState } from 'react';

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

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  onVerified: (phone: string, phoneToken: string) => void;
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
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const res  = await fetch('/api/sms/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone: digits }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? 'Failed to send code.');
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
      setError(err instanceof Error ? err.message : 'Failed to send code. Please try again.');
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
      setError(err instanceof Error ? err.message : 'Failed to resend. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleVerify(codeToVerify: string) {
    if (codeToVerify.length !== 6) return;
    setError('');
    setVerifying(true);
    try {
      const digits = rawDigits(phone);
      const res    = await fetch('/api/sms/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone: digits, code: codeToVerify }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Incorrect code.');
      onVerified(digits, data.phoneToken ?? '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Incorrect code. Please try again.');
      setVerifying(false);
    }
  }

  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(val);
    setError('');
    if (val.length === 6) handleVerify(val);
  }

  // ── Step 1: Phone input ─────────────────────────────────────────────────────

  if (!codeSent) {
    return (
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
    );
  }

  // ── Step 2: Code input ──────────────────────────────────────────────────────

  return (
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
          onClick={() => { setCodeSent(false); setCode(''); setError(''); setCooldown(0); }}
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
