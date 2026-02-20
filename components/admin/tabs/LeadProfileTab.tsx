'use client';
/**
 * components/admin/tabs/LeadProfileTab.tsx
 * Tab 2 — Full lead detail with PDF download and email-to-client action.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminFetch } from '@/lib/admin/auth';
import { formatCurrency } from '@/lib/estimator/logic';
import type { DbLead } from '@/lib/db';

// ── Helpers ───────────────────────────────────────────────────────────────────

const INJURY_LABELS: Record<string, string> = {
  soft_tissue: 'Soft Tissue (Sprains / Whiplash)',
  fracture:    'Broken Bone / Fracture',
  tbi:         'Head Injury / TBI',
  spinal:      'Spinal Cord Injury',
  other:       'Other / Multiple',
};
const bool = (v: number | null) => v ? 'Yes' : 'No';

function FieldPair({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="sa-field">
      <div className="sa-field-key">{label}</div>
      <div className="sa-field-value">{value}</div>
    </div>
  );
}

// ── LeadProfileTab ────────────────────────────────────────────────────────────

export function LeadProfileTab({ leadId, onBack }: { leadId: number | null; onBack: () => void }) {
  const [lead,    setLead]    = useState<DbLead | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg,     setMsg]     = useState('');

  const fetchLead = useCallback(async (id: number) => {
    setLoading(true);
    setMsg('');
    const res  = await adminFetch(`/api/admin/leads/${id}`);
    const data = await res.json();
    if (res.ok) setLead(data.lead);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (leadId != null) fetchLead(leadId);
    else setLead(null);
  }, [leadId, fetchLead]);

  const handlePdf = () => {
    if (!lead) return;
    window.open(`/api/admin/leads/${lead.id}/pdf`, '_blank');
  };

  const handleSend = async () => {
    if (!lead) return;
    setSending(true);
    setMsg('');
    try {
      const res  = await adminFetch('/api/distribute', {
        method: 'POST',
        body: JSON.stringify({ leadId: lead.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg('✅ Lead sent to client successfully.');
        fetchLead(lead.id);
      } else {
        setMsg(`❌ ${data.message ?? 'Delivery failed.'}`);
      }
    } catch {
      setMsg('❌ Network error.');
    } finally {
      setSending(false);
    }
  };

  const handleMarkDisputed = async () => {
    if (!lead) return;
    const res = await adminFetch(`/api/admin/leads/${lead.id}`, {
      method: 'POST',
      body: JSON.stringify({ disputed: lead.disputed ? 0 : 1 }),
    });
    if (res.ok) fetchLead(lead.id);
  };

  // ── No lead selected ────────────────────────────────────────────────────────
  if (leadId == null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 className="sa-page-title">Lead Profile</h1>
        <div className="sa-panel" style={{ textAlign: 'center', color: 'var(--ss-muted)', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👈</div>
          <p style={{ margin: 0 }}>Select a lead from the Pipeline tab to view their full profile here.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h1 className="sa-page-title">Lead Profile</h1>
        <p style={{ color: 'var(--ss-muted)' }}>Loading…</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div>
        <h1 className="sa-page-title">Lead Profile</h1>
        <p style={{ color: '#f87171' }}>Lead not found.</p>
        <button className="sa-btn" onClick={onBack}>← Back</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="sa-btn" onClick={onBack}>← Back</button>
          <h1 className="sa-page-title" style={{ margin: 0 }}>
            {lead.name}
            <span className="sa-stat-sub" style={{ marginLeft: 10, fontSize: 14 }}>#{lead.id}</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="sa-btn sa-btn--primary" onClick={handlePdf}>📄 Download PDF</button>
          <button
            className="sa-btn sa-btn--success"
            onClick={handleSend}
            disabled={sending || !!lead.delivered}
          >
            {sending ? 'Sending…' : lead.delivered ? '✅ Already Sent' : '📤 Send to Client'}
          </button>
          <button
            className={`sa-btn${lead.disputed ? '' : ' sa-btn--danger'}`}
            onClick={handleMarkDisputed}
          >
            {lead.disputed ? 'Undo Dispute' : '⚠️ Mark Disputed'}
          </button>
        </div>
      </div>

      {msg && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '12px 16px', borderRadius: 12, fontSize: 13,
            background: msg.startsWith('✅') ? 'rgba(240,180,41,0.10)' : 'rgba(248,113,113,0.10)',
            border: `1px solid ${msg.startsWith('✅') ? 'rgba(240,180,41,0.3)' : 'rgba(248,113,113,0.3)'}`,
            color: msg.startsWith('✅') ? 'var(--ss-gold)' : '#f87171',
          }}
        >
          {msg}
        </motion.div>
      )}

      {/* Tier + score banner */}
      <div className="sa-panel" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span className={`sq-tier sq-tier--${lead.tier}`} style={{ fontSize: 13 }}>
            {lead.tier === 'HOT' ? '🔥' : lead.tier === 'WARM' ? '⭐' : '🧊'} {lead.tier}
          </span>
          <div>
            <div className="sa-field-key">Lead Score</div>
            <div className="sa-field-value" style={{ fontSize: 20, fontWeight: 800 }}>{lead.score} / 150</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="sa-field-key">Estimated Value</div>
          <div className="sa-field-value" style={{ fontSize: 20, fontWeight: 800, color: 'var(--ss-gold)' }}>
            {formatCurrency(lead.estimate_low)} – {formatCurrency(lead.estimate_high)}
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="sa-panel">
        <p className="sa-panel-title">Contact Information</p>
        <div className="sa-field-row">
          <FieldPair label="Name"      value={lead.name} />
          <FieldPair label="Phone"     value={lead.phone} />
          <FieldPair label="Carrier"   value={lead.carrier || '—'} />
          <FieldPair label="Source"    value={lead.source.toUpperCase()} />
          <FieldPair label="Submitted" value={new Date(lead.timestamp).toLocaleString()} />
          <FieldPair label="Verified"  value={bool(lead.verified)} />
        </div>
      </div>

      {/* Injury details */}
      <div className="sa-panel">
        <p className="sa-panel-title">Injury Details</p>
        <div className="sa-field-row">
          <FieldPair label="Injury Type"       value={INJURY_LABELS[lead.injury_type] ?? lead.injury_type} />
          <FieldPair label="Surgery"           value={bool(lead.surgery)} />
          <FieldPair label="Hospitalized"      value={bool(lead.hospitalized)} />
          <FieldPair label="Still in Treatment" value={bool(lead.still_in_treatment)} />
          <FieldPair label="Missed Work"       value={bool(lead.missed_work)} />
          {lead.missed_work_days != null && (
            <FieldPair label="Days Missed" value={`${lead.missed_work_days} days`} />
          )}
          <FieldPair label="Lost Wages"        value={lead.lost_wages > 0 ? formatCurrency(lead.lost_wages) : '$0'} />
          <FieldPair label="Has Attorney"      value={bool(lead.has_attorney)} />
          <FieldPair label="Insurance Contacted" value={bool(lead.insurance_contacted)} />
        </div>
      </div>

      {/* Lifecycle */}
      <div className="sa-panel">
        <p className="sa-panel-title">Lifecycle Status</p>
        <div className="sa-field-row">
          <FieldPair label="Delivered" value={bool(lead.delivered)} />
          <FieldPair label="Disputed"  value={bool(lead.disputed)} />
          <FieldPair label="Replaced"  value={bool(lead.replaced)} />
          <FieldPair label="Client ID" value={lead.client_id != null ? String(lead.client_id) : 'Unassigned'} />
        </div>
      </div>
    </div>
  );
}
