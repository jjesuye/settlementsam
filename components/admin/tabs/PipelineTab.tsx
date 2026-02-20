'use client';
/**
 * components/admin/tabs/PipelineTab.tsx
 * Tab 1 — Pipeline overview.
 *   Top: stat cards (total, HOT, WARM, COLD, delivered, 7-day)
 *   Below: filterable / searchable lead table with row actions
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminFetch } from '@/lib/admin/auth';
import { formatCurrency } from '@/lib/estimator/logic';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stats {
  total: number; verified: number; hot: number; warm: number; cold: number;
  delivered: number; disputed: number; recent7d: number;
  smsSent: number; smsUsed: number; avgScore: number; conversionRate: number;
}

interface LeadRow {
  id: number; name: string; phone: string; injury_type: string;
  surgery: number; lost_wages: number; estimate_low: number; estimate_high: number;
  score: number; tier: string; verified: number; source: string;
  timestamp: number; delivered: number; disputed: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIER_ICON: Record<string, string> = { HOT: '🔥', WARM: '⭐', COLD: '🧊' };

function injuryShort(t: string) {
  const m: Record<string, string> = {
    soft_tissue: 'Soft Tissue', fracture: 'Fracture',
    tbi: 'TBI', spinal: 'Spinal', other: 'Other',
  };
  return m[t] ?? t;
}

function elapsed(ts: number) {
  const h = Math.floor((Date.now() - ts) / 3_600_000);
  if (h < 1)   return 'Just now';
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, mod }: { label: string; value: string | number; sub?: string; mod?: string }) {
  return (
    <motion.div
      className={`sa-stat-card${mod ? ` sa-stat-card--${mod}` : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
    >
      <div className="sa-stat-label">{label}</div>
      <div className="sa-stat-value">{value}</div>
      {sub && <div className="sa-stat-sub">{sub}</div>}
    </motion.div>
  );
}

// ── PipelineTab ───────────────────────────────────────────────────────────────

export function PipelineTab({ onViewLead }: { onViewLead: (id: number) => void }) {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [leads,   setLeads]   = useState<LeadRow[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [tier,    setTier]    = useState('');
  const [source,  setSource]  = useState('');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const LIMIT = 20;

  const fetchStats = useCallback(async () => {
    const res  = await adminFetch('/api/admin/stats');
    const data = await res.json();
    if (res.ok) setStats(data);
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tier)   params.set('tier',   tier);
    if (source) params.set('source', source);
    if (search) params.set('search', search);
    params.set('page',  String(page));
    params.set('limit', String(LIMIT));

    const res  = await adminFetch(`/api/admin/leads?${params}`);
    const data = await res.json();
    if (res.ok) { setLeads(data.leads); setTotal(data.total); }
    setLoading(false);
  }, [tier, source, search, page]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  // Reset page on filter change
  useEffect(() => { setPage(1); }, [tier, source, search]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <h1 className="sa-page-title">Pipeline</h1>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      {stats && (
        <div className="sa-stats">
          <StatCard label="Total Leads"   value={stats.total}          sub={`${stats.verified} verified`} />
          <StatCard label="🔥 HOT"        value={stats.hot}            mod="hot"  sub="High-value cases" />
          <StatCard label="⭐ WARM"       value={stats.warm}           mod="warm" sub="Strong cases" />
          <StatCard label="🧊 COLD"       value={stats.cold}           mod="cold" sub="Needs nurturing" />
          <StatCard label="Delivered"     value={stats.delivered}      sub={`${stats.disputed} disputed`} />
          <StatCard label="Last 7 Days"   value={stats.recent7d}       sub="New leads" />
          <StatCard label="SMS Sent"      value={stats.smsSent}        sub={`${stats.conversionRate}% conversion`} />
          <StatCard label="Avg Score"     value={`${stats.avgScore}/150`} sub="Verified leads" />
        </div>
      )}

      {/* ── Lead table ───────────────────────────────────────────────────── */}
      <div className="sa-table-wrap">
        <div className="sa-table-header">
          <span className="sa-table-title">All Leads ({total})</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="sa-search"
              placeholder="Search name / phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="sa-filter-select" value={tier} onChange={e => setTier(e.target.value)}>
              <option value="">All Tiers</option>
              <option value="HOT">🔥 HOT</option>
              <option value="WARM">⭐ WARM</option>
              <option value="COLD">🧊 COLD</option>
            </select>
            <select className="sa-filter-select" value={source} onChange={e => setSource(e.target.value)}>
              <option value="">All Sources</option>
              <option value="widget">Widget</option>
              <option value="quiz">Quiz</option>
            </select>
            <button className="sa-btn sa-btn--primary" onClick={fetchLeads}>↺ Refresh</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="sa-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Injury</th>
                <th>Surgery</th>
                <th>Estimate</th>
                <th>Score</th>
                <th>Tier</th>
                <th>Source</th>
                <th>Received</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--ss-muted)', padding: 32 }}>Loading…</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--ss-muted)', padding: 32 }}>No leads found.</td></tr>
              ) : leads.map(lead => (
                <tr key={lead.id}>
                  <td style={{ color: 'var(--ss-muted)' }}>#{lead.id}</td>
                  <td style={{ fontWeight: 600 }}>{lead.name}</td>
                  <td>{lead.phone}</td>
                  <td>{injuryShort(lead.injury_type)}</td>
                  <td>{lead.surgery ? '✅' : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatCurrency(lead.estimate_low)} – {formatCurrency(lead.estimate_high)}
                  </td>
                  <td>{lead.score}</td>
                  <td>
                    <span className={`sq-tier sq-tier--${lead.tier}`} style={{ fontSize: 10 }}>
                      {TIER_ICON[lead.tier]} {lead.tier}
                    </span>
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{lead.source}</td>
                  <td style={{ color: 'var(--ss-muted)', fontSize: 12 }}>{elapsed(lead.timestamp)}</td>
                  <td>
                    {lead.delivered ? (
                      <span style={{ fontSize: 11, color: 'var(--ss-gold)' }}>Sent</span>
                    ) : lead.disputed ? (
                      <span style={{ fontSize: 11, color: '#f87171' }}>Disputed</span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--ss-muted)' }}>Pending</span>
                    )}
                  </td>
                  <td>
                    <div className="sa-actions">
                      <button className="sa-btn sa-btn--primary" onClick={() => onViewLead(lead.id)}>View</button>
                      <button
                        className="sa-btn"
                        onClick={() => window.open(`/api/admin/leads/${lead.id}/pdf`, '_blank')}
                      >PDF</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, padding: '14px 20px', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button className="sa-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 12, color: 'var(--ss-muted)' }}>Page {page} of {totalPages}</span>
            <button className="sa-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
