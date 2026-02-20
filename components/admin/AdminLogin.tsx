'use client';
/**
 * components/admin/AdminLogin.tsx
 *
 * Secure admin login screen with:
 *   - Sam character SVG
 *   - Brute-force lockout display (shows countdown)
 *   - Full Settlement Sam brand aesthetic
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { setToken } from '@/lib/admin/auth';

// ── Sam avatar (admin variant — wearing glasses) ─────────────────────────────
function SamAdmin() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64} xmlns="http://www.w3.org/2000/svg" aria-label="Settlement Sam" role="img">
      <ellipse cx="40" cy="31"  rx="27" ry="20" fill="#b8721e" />
      <ellipse cx="16" cy="42" rx="9"  ry="16" fill="#b8721e" />
      <ellipse cx="64" cy="42" rx="9"  ry="16" fill="#b8721e" />
      <circle  cx="40" cy="47" r="26"  fill="#f5c87a" />
      <ellipse cx="40" cy="24" rx="22" ry="10" fill="#c4832a" />
      <path d="M28 39 Q32 36.5 36 39" stroke="#7a4f18" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M44 39 Q48 36.5 52 39" stroke="#7a4f18" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* Glasses */}
      <rect x="25" y="42" width="14" height="9" rx="4" fill="none" stroke="#2d3142" strokeWidth="1.5" />
      <rect x="41" y="42" width="14" height="9" rx="4" fill="none" stroke="#2d3142" strokeWidth="1.5" />
      <line x1="39" y1="46.5" x2="41" y2="46.5" stroke="#2d3142" strokeWidth="1.5" />
      <line x1="25" y1="46.5" x2="22" y2="44" stroke="#2d3142" strokeWidth="1.5" />
      <line x1="55" y1="46.5" x2="58" y2="44" stroke="#2d3142" strokeWidth="1.5" />
      <circle cx="32" cy="46" r="2" fill="#2d3142" />
      <circle cx="48" cy="46" r="2" fill="#2d3142" />
      <path d="M33 54 Q40 62 47 54" stroke="#7a4f18" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="27" cy="52" r="5.5" fill="#e8735a" opacity="0.26" />
      <circle cx="53" cy="52" r="5.5" fill="#e8735a" opacity="0.26" />
    </svg>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
export function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [lockout,    setLockout]    = useState(0);  // seconds remaining in lockout

  // Countdown timer when locked out
  useEffect(() => {
    if (lockout <= 0) return;
    const t = setTimeout(() => setLockout(s => s - 1), 1_000);
    return () => clearTimeout(t);
  }, [lockout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockout > 0) return;
    setError('');
    setLoading(true);

    try {
      const res  = await fetch('/api/admin/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (res.status === 423) {
        // Locked out
        setLockout(data.retryAfter ?? 900);
        setError(data.message);
        return;
      }

      if (!res.ok) {
        setError(data.message ?? 'Invalid credentials.');
        return;
      }

      setToken(data.token);
      onLogin();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const lockoutMins = Math.ceil(lockout / 60);

  return (
    <div className="sa-login-page">
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 30%, rgba(196,131,42,0.12) 0%, transparent 60%)',
      }} />

      <motion.div
        className="sa-login-card"
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
          >
            <SamAdmin />
          </motion.div>
          <div className="sa-login-brand" style={{ justifyContent: 'center' }}>
            <span>⚖️</span> Settlement Sam
          </div>
          <p className="sa-login-sub">Admin dashboard. Authorized access only.</p>
        </div>

        {/* Form */}
        <form className="sa-form" onSubmit={handleSubmit}>
          <div>
            <label className="sa-label" htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              className="sa-input"
              type="email"
              autoComplete="username"
              placeholder="admin@settlementsam.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={lockout > 0}
              required
            />
          </div>
          <div>
            <label className="sa-label" htmlFor="admin-pw">Password</label>
            <input
              id="admin-pw"
              className="sa-input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={lockout > 0}
              required
            />
          </div>

          {error && (
            <motion.p
              className="sa-error-msg"
              role="alert"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0  }}
              transition={{ duration: 0.2 }}
            >
              {error}
            </motion.p>
          )}

          {lockout > 0 && (
            <div style={{
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 12,
              color: '#f87171',
              textAlign: 'center',
            }}>
              🔒 Locked for {lockoutMins} more minute{lockoutMins !== 1 ? 's' : ''} ({lockout}s)
            </div>
          )}

          <button
            className="sa-submit"
            type="submit"
            disabled={loading || lockout > 0 || !email || !password}
          >
            {loading ? 'Signing in…' : lockout > 0 ? `Locked (${lockout}s)` : 'Sign In →'}
          </button>
        </form>

        <p style={{ fontSize: 11, color: 'var(--ss-muted)', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
          Forgot your password? Run{' '}
          <code style={{ background: 'var(--ss-bg)', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>
            npm run admin:reset-password
          </code>{' '}
          on the server.
        </p>
      </motion.div>
    </div>
  );
}
