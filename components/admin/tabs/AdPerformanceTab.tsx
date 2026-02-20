'use client';
/**
 * components/admin/tabs/AdPerformanceTab.tsx
 * Tab 4 — Manual campaign cards, CTR tracker, ROI calculator.
 * Data is persisted in localStorage (no backend needed for ad tracking).
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Campaign {
  id:         string;
  name:       string;
  platform:   string;
  spend:      number;
  clicks:     number;
  leads:      number;
  startDate:  string;
  active:     boolean;
}

const STORAGE_KEY = 'ss_ad_campaigns';

function loadCampaigns(): Campaign[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}

function saveCampaigns(c: Campaign[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const EMPTY_FORM: Omit<Campaign, 'id' | 'active'> = {
  name: '', platform: 'Google', spend: 0, clicks: 0, leads: 0, startDate: '',
};

function ctr(c: Campaign) { return c.clicks > 0 ? ((c.leads / c.clicks) * 100).toFixed(1) : '0.0'; }
function cpl(c: Campaign) { return c.leads  > 0 ? (c.spend / c.leads).toFixed(0) : '—'; }
function roi(c: Campaign, avgLeadValue = 250) {
  const revenue = c.leads * avgLeadValue;
  return c.spend > 0 ? (((revenue - c.spend) / c.spend) * 100).toFixed(0) : '—';
}

export function AdPerformanceTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [avgValue,  setAvgValue]  = useState(250);

  useEffect(() => { setCampaigns(loadCampaigns()); }, []);

  const save = (updated: Campaign[]) => { setCampaigns(updated); saveCampaigns(updated); };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const newC: Campaign = { ...form, id: uid(), active: true };
    save([newC, ...campaigns]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const toggle = (id: string) => save(campaigns.map(c => c.id === id ? { ...c, active: !c.active } : c));
  const remove = (id: string) => save(campaigns.filter(c => c.id !== id));

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const blendedCPL  = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(0) : '—';
  const blendedCTR  = totalClicks > 0 ? ((totalLeads / totalClicks) * 100).toFixed(1) : '0.0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="sa-page-title" style={{ margin: 0 }}>Ad Performance</h1>
        <button className="sa-btn sa-btn--primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? '✕ Cancel' : '+ Add Campaign'}
        </button>
      </div>

      {/* Summary stats */}
      <div className="sa-stats">
        <div className="sa-stat-card">
          <div className="sa-stat-label">Total Spend</div>
          <div className="sa-stat-value">${totalSpend.toLocaleString()}</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-label">Total Leads</div>
          <div className="sa-stat-value" style={{ color: 'var(--ss-coral)' }}>{totalLeads}</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-label">Blended CPL</div>
          <div className="sa-stat-value">${blendedCPL}</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-label">Blended CTR</div>
          <div className="sa-stat-value" style={{ color: 'var(--ss-gold)' }}>{blendedCTR}%</div>
        </div>
      </div>

      {/* ROI calculator input */}
      <div className="sa-panel" style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--ss-muted)' }}>Avg lead value (for ROI calc):</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--ss-muted)' }}>$</span>
          <input
            className="sa-input"
            type="number"
            min={0}
            value={avgValue}
            onChange={e => setAvgValue(Number(e.target.value))}
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 12, color: 'var(--ss-muted)' }}>per lead</span>
        </div>
      </div>

      {/* Add campaign form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="sa-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <p className="sa-panel-title">New Campaign</p>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="sa-field-row">
                <div>
                  <label className="sa-label">Campaign Name</label>
                  <input className="sa-input" placeholder="Google Brand - Jan" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="sa-label">Platform</label>
                  <select className="sa-input" value={form.platform}
                    onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                    {['Google', 'Facebook', 'Instagram', 'TikTok', 'YouTube', 'Reddit', 'Other'].map(p =>
                      <option key={p}>{p}</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="sa-field-row">
                <div>
                  <label className="sa-label">Total Spend ($)</label>
                  <input className="sa-input" type="number" min={0} placeholder="1000"
                    value={form.spend || ''}
                    onChange={e => setForm(f => ({ ...f, spend: Number(e.target.value) }))} required />
                </div>
                <div>
                  <label className="sa-label">Total Clicks</label>
                  <input className="sa-input" type="number" min={0} placeholder="500"
                    value={form.clicks || ''}
                    onChange={e => setForm(f => ({ ...f, clicks: Number(e.target.value) }))} required />
                </div>
                <div>
                  <label className="sa-label">Leads Generated</label>
                  <input className="sa-input" type="number" min={0} placeholder="12"
                    value={form.leads || ''}
                    onChange={e => setForm(f => ({ ...f, leads: Number(e.target.value) }))} required />
                </div>
              </div>
              <div>
                <label className="sa-label">Start Date</label>
                <input className="sa-input" type="date" value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <button className="sa-submit" type="submit">Add Campaign</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Campaign cards */}
      {campaigns.length === 0 ? (
        <div className="sa-panel" style={{ textAlign: 'center', color: 'var(--ss-muted)', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <p style={{ margin: 0 }}>No campaigns yet. Click "Add Campaign" to track your first ad spend.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {campaigns.map(c => (
            <motion.div
              key={c.id}
              className="sa-panel"
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ opacity: c.active ? 1 : 0.5 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ss-text)' }}>{c.name}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                      background: c.active ? 'rgba(232,115,90,0.15)' : 'rgba(157,163,184,0.12)',
                      color: c.active ? 'var(--ss-coral)' : 'var(--ss-muted)',
                    }}>
                      {c.active ? 'Active' : 'Paused'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ss-muted)' }}>{c.platform}</span>
                  </div>
                  {c.startDate && <div style={{ fontSize: 11, color: 'var(--ss-muted)' }}>Started {c.startDate}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="sa-btn" onClick={() => toggle(c.id)}>{c.active ? 'Pause' : 'Resume'}</button>
                  <button className="sa-btn sa-btn--danger" onClick={() => remove(c.id)}>Delete</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 12, marginTop: 8 }}>
                {[
                  { label: 'Spend',   value: `$${c.spend.toLocaleString()}` },
                  { label: 'Clicks',  value: c.clicks.toLocaleString() },
                  { label: 'Leads',   value: c.leads.toString(),   color: 'var(--ss-coral)' },
                  { label: 'CTR',     value: `${ctr(c)}%`,         color: 'var(--ss-gold)' },
                  { label: 'CPL',     value: `$${cpl(c)}` },
                  { label: 'ROI',     value: `${roi(c, avgValue)}%`, color: roi(c, avgValue) !== '—' && Number(roi(c, avgValue)) > 0 ? 'var(--ss-gold)' : '#f87171' },
                ].map(m => (
                  <div key={m.label}>
                    <div className="sa-field-key">{m.label}</div>
                    <div className="sa-field-value" style={{ fontSize: 18, fontWeight: 700, color: m.color ?? 'var(--ss-text)' }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
