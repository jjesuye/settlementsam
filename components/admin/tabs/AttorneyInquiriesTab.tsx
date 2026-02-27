'use client';
/**
 * components/admin/tabs/AttorneyInquiriesTab.tsx
 * Tab 6 — Attorney Inquiries
 *   Table: Name | Firm | Email | Phone | State | Volume | Date | Pricing Viewed | Actions
 *   Filters: state, case volume, from-date (client-side)
 *   Actions: Mark Contacted, Add Note, Convert to Client
 */

import React, { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Inquiry {
  id:             string;
  name:           string;
  firm:           string;
  email:          string;
  phone:          string;
  state:          string;
  case_volume:    string;
  timestamp:      number;
  contacted:      boolean;
  pricing_viewed: boolean;
  converted?:     boolean;
  notes:          string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function csvExport(rows: Inquiry[]) {
  const header = ['Name', 'Firm', 'Email', 'Phone', 'State', 'Case Volume', 'Date', 'Pricing Viewed', 'Contacted', 'Converted', 'Notes'];
  const lines  = rows.map(r => [
    r.name, r.firm, r.email, r.phone, r.state, r.case_volume,
    fmtDate(r.timestamp),
    r.pricing_viewed ? 'Yes' : 'No',
    r.contacted  ? 'Yes' : 'No',
    r.converted  ? 'Yes' : 'No',
    r.notes,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'attorney-inquiries.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

// ── NoteModal ─────────────────────────────────────────────────────────────────

function NoteModal({
  inquiry, onClose, onSave,
}: { inquiry: Inquiry; onClose: () => void; onSave: (id: string, notes: string) => void }) {
  const [notes,  setNotes]  = useState(inquiry.notes ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(inquiry.id, notes);
    setSaving(false);
    onClose();
  }

  return (
    <div className="sa-modal-backdrop" onClick={onClose}>
      <div className="sa-modal" onClick={e => e.stopPropagation()}>
        <h3 className="sa-modal-title">Note — {inquiry.name}</h3>
        <textarea
          className="sa-modal-textarea"
          rows={5}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add internal notes about this inquiry…"
          autoFocus
        />
        <div className="sa-modal-actions">
          <button className="sa-btn sa-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="sa-btn sa-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ConvertModal ──────────────────────────────────────────────────────────────

function ConvertModal({
  inquiry, onClose, onConverted,
}: { inquiry: Inquiry; onClose: () => void; onConverted: (id: string) => void }) {
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [sheetsId, setSheetsId] = useState('');

  async function handleConvert() {
    setSaving(true);
    setError('');
    try {
      // 1. Create client record
      const res = await adminFetch('/api/admin/clients', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:      inquiry.name,
          firm:      inquiry.firm,
          email:     inquiry.email,
          sheets_id: sheetsId.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message ?? 'Failed to create client.');
      }
      // 2. Mark inquiry as converted
      await adminFetch('/api/admin/attorney-inquiries', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: inquiry.id, converted: true, contacted: true }),
      });
      onConverted(inquiry.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSaving(false);
    }
  }

  return (
    <div className="sa-modal-backdrop" onClick={onClose}>
      <div className="sa-modal" onClick={e => e.stopPropagation()}>
        <h3 className="sa-modal-title">Convert to Client</h3>
        <p style={{ fontSize: 14, color: 'var(--ss-muted)', marginBottom: 20 }}>
          This will create a client record for <strong>{inquiry.name}</strong> ({inquiry.firm})
          in the Clients tab. You can configure pricing and Stripe details there.
        </p>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <label className="sa-label">Name</label>
              <div className="sa-input" style={{ background: 'var(--ss-card)', pointerEvents: 'none', opacity: 0.7 }}>{inquiry.name}</div>
            </div>
            <div>
              <label className="sa-label">Firm</label>
              <div className="sa-input" style={{ background: 'var(--ss-card)', pointerEvents: 'none', opacity: 0.7 }}>{inquiry.firm}</div>
            </div>
            <div>
              <label className="sa-label">Email</label>
              <div className="sa-input" style={{ background: 'var(--ss-card)', pointerEvents: 'none', opacity: 0.7 }}>{inquiry.email}</div>
            </div>
            <div>
              <label className="sa-label">Google Sheets ID (optional)</label>
              <input
                className="sa-input"
                value={sheetsId}
                onChange={e => setSheetsId(e.target.value)}
                placeholder="Paste spreadsheet ID…"
              />
            </div>
          </div>
        </div>

        {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <div className="sa-modal-actions">
          <button className="sa-btn sa-btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="sa-btn sa-btn--success" onClick={handleConvert} disabled={saving}>
            {saving ? 'Converting…' : '✓ Convert to Client'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AttorneyInquiriesTab ──────────────────────────────────────────────────────

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
];

export function AttorneyInquiriesTab() {
  const [inquiries,    setInquiries]    = useState<Inquiry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [stateFilter,  setStateFilter]  = useState('');
  const [volumeFilter, setVolumeFilter] = useState('');
  const [fromDate,     setFromDate]     = useState('');   // YYYY-MM-DD
  const [noteModal,    setNoteModal]    = useState<Inquiry | null>(null);
  const [convertModal, setConvertModal] = useState<Inquiry | null>(null);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (stateFilter)  params.set('state',  stateFilter);
    if (volumeFilter) params.set('volume', volumeFilter);
    const res  = await adminFetch(`/api/admin/attorney-inquiries?${params}`);
    const data = await res.json();
    if (res.ok) setInquiries(data.inquiries ?? []);
    setLoading(false);
  }, [stateFilter, volumeFilter]);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  async function markContacted(id: string, contacted: boolean) {
    await adminFetch('/api/admin/attorney-inquiries', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, contacted }),
    });
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, contacted } : i));
  }

  async function saveNote(id: string, notes: string) {
    await adminFetch('/api/admin/attorney-inquiries', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, notes }),
    });
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, notes } : i));
  }

  function handleConverted(id: string) {
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, converted: true, contacted: true } : i));
  }

  // Client-side date filter
  const fromTs = fromDate ? new Date(fromDate).getTime() : 0;
  const visible = inquiries.filter(i => !fromTs || i.timestamp >= fromTs);

  const contacted  = inquiries.filter(i => i.contacted).length;
  const converted  = inquiries.filter(i => i.converted).length;
  const pending    = inquiries.length - contacted;

  return (
    <div>
      <h1 className="sa-page-title">Attorney Inquiries</h1>

      {/* ── Summary cards ───────────────────────────────────────────────────── */}
      <div className="sa-stats" style={{ marginBottom: 24 }}>
        <div className="sa-stat-card">
          <div className="sa-stat-label">Total Inquiries</div>
          <div className="sa-stat-value">{inquiries.length}</div>
          <div className="sa-stat-sub">via attorneys page</div>
        </div>
        <div className="sa-stat-card sa-stat-card--warm">
          <div className="sa-stat-label">Awaiting Contact</div>
          <div className="sa-stat-value">{pending}</div>
          <div className="sa-stat-sub">need follow-up</div>
        </div>
        <div className="sa-stat-card sa-stat-card--hot">
          <div className="sa-stat-label">Contacted</div>
          <div className="sa-stat-value">{contacted}</div>
          <div className="sa-stat-sub">follow-up done</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-label">Converted</div>
          <div className="sa-stat-value" style={{ color: 'var(--ss-green)' }}>{converted}</div>
          <div className="sa-stat-sub">active clients</div>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="sa-table-wrap">
        <div className="sa-table-header">
          <span className="sa-table-title">Inquiries ({visible.length})</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="sa-filter-select"
              value={stateFilter}
              onChange={e => setStateFilter(e.target.value)}
            >
              <option value="">All States</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              className="sa-filter-select"
              value={volumeFilter}
              onChange={e => setVolumeFilter(e.target.value)}
            >
              <option value="">All Volumes</option>
              <option value="1-5">1–5 / month</option>
              <option value="5-15">5–15 / month</option>
              <option value="15-30">15–30 / month</option>
              <option value="30+">30+ / month</option>
            </select>
            <input
              type="date"
              className="sa-filter-select"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              title="Show inquiries from this date"
              style={{ cursor: 'pointer' }}
            />
            <button
              className="sa-btn sa-btn--ghost"
              onClick={() => csvExport(visible)}
              disabled={visible.length === 0}
            >
              ↓ CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="sa-empty">Loading inquiries…</div>
        ) : visible.length === 0 ? (
          <div className="sa-empty">No inquiries match the current filters.</div>
        ) : (
          <div className="sa-table-scroll">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Name / Firm</th>
                  <th>Contact</th>
                  <th>State</th>
                  <th>Volume</th>
                  <th>Date</th>
                  <th>Pricing</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(inq => (
                  <tr key={inq.id} className={inq.converted ? 'sa-row--muted' : inq.contacted ? 'sa-row--muted' : ''}>
                    <td>
                      <div className="sa-lead-name">{inq.name}</div>
                      <div className="sa-lead-sub">{inq.firm}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{inq.email}</div>
                      <div className="sa-lead-sub">{inq.phone}</div>
                    </td>
                    <td>{inq.state}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{inq.case_volume}/mo</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(inq.timestamp)}</td>
                    <td>
                      {inq.pricing_viewed
                        ? <span className="sa-badge sa-badge--green">✓ Viewed</span>
                        : <span className="sa-badge">—</span>}
                    </td>
                    <td>
                      {inq.converted
                        ? <span className="sa-badge sa-badge--green">✓ Client</span>
                        : inq.contacted
                          ? <span className="sa-badge sa-badge--green">✓ Contacted</span>
                          : <span className="sa-badge sa-badge--amber">Pending</span>}
                    </td>
                    <td style={{ maxWidth: 160 }}>
                      <span className="sa-notes-preview">{inq.notes || '—'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {!inq.converted && (
                          <>
                            <button
                              className={`sa-btn sa-btn--xs ${inq.contacted ? 'sa-btn--ghost' : 'sa-btn--primary'}`}
                              onClick={() => markContacted(inq.id, !inq.contacted)}
                            >
                              {inq.contacted ? 'Unmark' : 'Contacted'}
                            </button>
                            <button
                              className="sa-btn sa-btn--xs sa-btn--ghost"
                              onClick={() => setNoteModal(inq)}
                            >
                              Note
                            </button>
                            <button
                              className="sa-btn sa-btn--xs sa-btn--success"
                              onClick={() => setConvertModal(inq)}
                            >
                              → Client
                            </button>
                          </>
                        )}
                        {inq.converted && (
                          <button
                            className="sa-btn sa-btn--xs sa-btn--ghost"
                            onClick={() => setNoteModal(inq)}
                          >
                            Note
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Note modal ──────────────────────────────────────────────────────── */}
      {noteModal && (
        <NoteModal
          inquiry={noteModal}
          onClose={() => setNoteModal(null)}
          onSave={saveNote}
        />
      )}

      {/* ── Convert to Client modal ─────────────────────────────────────────── */}
      {convertModal && (
        <ConvertModal
          inquiry={convertModal}
          onClose={() => setConvertModal(null)}
          onConverted={handleConverted}
        />
      )}
    </div>
  );
}
