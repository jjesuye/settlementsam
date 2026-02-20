'use client';
/**
 * components/admin/tabs/SmsControlsTab.tsx
 * Tab 3 — SMS verification stats, carrier breakdown, and manual resend.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminFetch } from '@/lib/admin/auth';

interface SmsStats {
  total: number; verified: number; expired: number; pending: number;
  conversionRate: number;
  carrierBreakdown: { gateway: string; label: string; count: number }[];
  recentFailed: { phone: string; attempts: number; created_at: number; used: number }[];
}

function StatPill({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="sa-stat-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <div className="sa-stat-value" style={{ color: color ?? 'var(--ss-text)' }}>{value}</div>
      <div className="sa-stat-label" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 13 }}>{label}</div>
    </div>
  );
}

export function SmsControlsTab() {
  const [stats,    setStats]    = useState<SmsStats | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [resendPhone,   setResendPhone]   = useState('');
  const [resendCarrier, setResendCarrier] = useState('');
  const [resendName,    setResendName]    = useState('');
  const [resending,     setResending]     = useState(false);
  const [resendMsg,     setResendMsg]     = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    const res  = await adminFetch('/api/admin/sms-stats');
    const data = await res.json();
    if (res.ok) setStats(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleManualResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendMsg('');
    setResending(true);
    try {
      const res  = await adminFetch('/api/send-code', {
        method: 'POST',
        body:   JSON.stringify({ name: resendName, phone: resendPhone, carrier: resendCarrier }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendMsg('✅ Code sent successfully.');
        setResendPhone(''); setResendCarrier(''); setResendName('');
      } else {
        setResendMsg(`❌ ${data.message ?? 'Failed to send.'}`);
      }
    } catch {
      setResendMsg('❌ Network error.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1 className="sa-page-title">SMS Controls</h1>

      {/* Stats row */}
      {loading ? (
        <p style={{ color: 'var(--ss-muted)' }}>Loading…</p>
      ) : stats ? (
        <>
          <div className="sa-stats">
            <StatPill label="Total Codes Sent"  value={stats.total} />
            <StatPill label="Verified"          value={stats.verified}  color="var(--ss-gold)" />
            <StatPill label="Pending"           value={stats.pending} />
            <StatPill label="Expired"           value={stats.expired}   color="var(--ss-muted)" />
            <StatPill label="Conversion Rate"   value={`${stats.conversionRate}%`} color="var(--ss-coral)" />
          </div>

          {/* Carrier breakdown */}
          <div className="sa-panel">
            <p className="sa-panel-title">Carrier Breakdown</p>
            {stats.carrierBreakdown.length === 0 ? (
              <p style={{ color: 'var(--ss-muted)', fontSize: 13 }}>No carrier data yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats.carrierBreakdown.map(c => {
                  const pct = stats.total > 0 ? Math.round((c.count / stats.total) * 100) : 0;
                  return (
                    <div key={c.gateway} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 100, fontSize: 13, color: 'var(--ss-text)', fontWeight: 600, flexShrink: 0 }}>
                        {c.label}
                      </div>
                      <div style={{ flex: 1, background: 'var(--ss-bg)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                        <motion.div
                          style={{ height: '100%', background: 'var(--ss-coral)', borderRadius: 4 }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                      <div style={{ width: 60, fontSize: 12, color: 'var(--ss-muted)', textAlign: 'right' }}>
                        {c.count} ({pct}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent high-attempt codes */}
          {stats.recentFailed.length > 0 && (
            <div className="sa-table-wrap">
              <div className="sa-table-header">
                <span className="sa-table-title">High-Attempt Codes (3+ tries)</span>
              </div>
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Phone</th>
                    <th>Attempts</th>
                    <th>Verified</th>
                    <th>Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentFailed.map((r, i) => (
                    <tr key={i}>
                      <td>{r.phone}</td>
                      <td style={{ color: 'var(--ss-coral)' }}>{r.attempts}</td>
                      <td>{r.used ? '✅' : '❌'}</td>
                      <td style={{ color: 'var(--ss-muted)', fontSize: 12 }}>
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {/* Manual resend */}
      <div className="sa-panel">
        <p className="sa-panel-title">Manual Code Send</p>
        <p style={{ fontSize: 13, color: 'var(--ss-muted)', margin: '0 0 16px' }}>
          Send a fresh verification code to any phone number directly from the dashboard.
        </p>
        <form onSubmit={handleManualResend} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="sa-field-row">
            <div>
              <label className="sa-label">First Name</label>
              <input className="sa-input" placeholder="Sam" value={resendName} onChange={e => setResendName(e.target.value)} required />
            </div>
            <div>
              <label className="sa-label">Phone Number</label>
              <input className="sa-input" placeholder="5551234567" value={resendPhone} onChange={e => setResendPhone(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="sa-label">Carrier Gateway</label>
            <input className="sa-input" placeholder="e.g. vtext.com" value={resendCarrier} onChange={e => setResendCarrier(e.target.value)} required />
          </div>
          {resendMsg && (
            <p style={{ fontSize: 12, color: resendMsg.startsWith('✅') ? 'var(--ss-gold)' : '#f87171', margin: 0 }}>
              {resendMsg}
            </p>
          )}
          <button className="sa-submit" type="submit" disabled={resending} style={{ marginTop: 4 }}>
            {resending ? 'Sending…' : 'Send Code 📱'}
          </button>
        </form>
      </div>

      <button className="sa-btn" onClick={fetch} style={{ alignSelf: 'flex-start' }}>↺ Refresh Stats</button>
    </div>
  );
}
