'use client';
/**
 * app/admin/login/page.tsx
 *
 * Dedicated admin login page at /admin/login.
 *
 * On mount:
 *   1. If already authenticated → redirect to /admin
 *   2. Check /api/admin/check-setup → if not configured, show first-run wizard
 *   3. Otherwise render the full login form with brand aesthetic
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { isLoggedIn, setToken } from '@/lib/admin/auth';


// ── Setup Required screen ─────────────────────────────────────────────────────
function SetupRequired() {
  const [copied, setCopied] = useState(false);
  const cmd = 'npm run admin:setup';

  const copy = () => {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    });
  };

  return (
    <div className="sa-login-page">
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 30%, rgba(74,124,89,0.10) 0%, transparent 60%)',
      }} />

      <motion.div
        className="sa-login-card"
        style={{ maxWidth: 420, gap: 24 }}
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
            <img src="/images/sam-icons/sam-logo.png" width={72} height={72} alt="Settlement Sam" />
          </motion.div>
          <div className="sa-login-brand">
            <img src="/images/sam-icons/sam-logo.png" height={28} alt="Settlement Sam" />
          </div>
        </div>

        {/* Setup prompt */}
        <div style={{
          background: 'rgba(74,124,89,0.08)',
          border: '1px solid rgba(74,124,89,0.25)',
          borderRadius: 14,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--ss-amber)', fontSize: 14 }}>
            First-Time Setup Required
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ss-text)', lineHeight: 1.6 }}>
            No admin credentials are configured yet. Run the setup wizard on your server to create your admin account:
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{
              flex: 1,
              background: 'var(--ss-bg)',
              color: 'var(--ss-coral)',
              padding: '9px 12px',
              borderRadius: 8,
              fontSize: 13,
              fontFamily: 'monospace',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}>
              {cmd}
            </code>
            <button
              onClick={copy}
              style={{
                background: copied ? 'var(--ss-gold)' : 'var(--ss-border)',
                border: 'none',
                borderRadius: 8,
                padding: '9px 12px',
                cursor: 'pointer',
                fontSize: 12,
                color: copied ? 'var(--ss-text)' : 'var(--ss-text)',
                fontWeight: 600,
                transition: 'background 0.2s, color 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--ss-muted)', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
          The wizard will prompt for an email and password, generate a bcrypt hash, and print the environment variables to add to your <code style={{ background: 'var(--ss-bg)', padding: '1px 5px', borderRadius: 4 }}>.env</code> file.
        </p>

        <p style={{ fontSize: 11, color: 'var(--ss-muted)', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
          After updating .env, restart the server and refresh this page.
        </p>
      </motion.div>
    </div>
  );
}

// ── Login form ────────────────────────────────────────────────────────────────
function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [lockout,  setLockout]  = useState(0); // seconds remaining

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
        body:    JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();

      if (res.status === 423) {
        setLockout(data.retryAfter ?? 900);
        setError(data.message);
        return;
      }

      if (!res.ok) {
        setError(data.message ?? 'Invalid credentials.');
        return;
      }

      setToken(data.token);
      onSuccess();
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
        background: 'radial-gradient(ellipse at 50% 30%, rgba(74,124,89,0.10) 0%, transparent 60%)',
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
            <img src="/images/sam-icons/sam-logo.png" width={72} height={72} alt="Settlement Sam" />
          </motion.div>
          <div className="sa-login-brand">
            <img src="/images/sam-icons/sam-logo.png" height={28} alt="Settlement Sam" />
          </div>
          <p className="sa-login-sub">Admin dashboard. Authorized access only.</p>
        </div>

        {/* Form */}
        <form className="sa-form" onSubmit={handleSubmit}>
          <div>
            <label className="sa-label" htmlFor="admin-username">Username</label>
            <input
              id="admin-username"
              className="sa-input"
              type="text"
              autoComplete="username"
              placeholder="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
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
              Locked for {lockoutMins} more minute{lockoutMins !== 1 ? 's' : ''} ({lockout}s)
            </div>
          )}

          <button
            className="sa-submit"
            type="submit"
            disabled={loading || lockout > 0 || !username || !password}
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

// ── Page shell ────────────────────────────────────────────────────────────────
type Status = 'checking' | 'unconfigured' | 'login';

export default function AdminLoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    // Already logged in → go straight to dashboard
    if (isLoggedIn()) {
      router.replace('/admin');
      return;
    }

    // Check whether admin credentials exist in env
    fetch('/api/admin/check-setup')
      .then(r => r.json())
      .then(({ configured }: { configured: boolean }) => {
        setStatus(configured ? 'login' : 'unconfigured');
      })
      .catch(() => setStatus('login')); // on error, show login (server will reject anyway)
  }, [router]);

  if (status === 'checking') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--ss-bg)',
      }}>
        <div style={{ color: 'var(--ss-muted)', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (status === 'unconfigured') {
    return <SetupRequired />;
  }

  return <LoginForm onSuccess={() => router.push('/admin')} />;
}
