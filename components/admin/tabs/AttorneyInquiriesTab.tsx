'use client';
/**
 * components/admin/tabs/AttorneyInquiriesTab.tsx
 * Tab 6 — Attorney Inquiries
 *   Table: Name | Firm | Email | Phone | State | Volume | Date | Contacted | Actions
 *   Filters: state, case volume
 *   Actions: Mark Contacted, Add Note, CSV export
 */

import React, { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Inquiry {
  id:            string;
  name:          string;
  firm:          string;
  email:         string;
  phone:         string;
  state:         string;
  case_volume:   string;
  timestamp:     number;
  contacted:     boolean;
  pricing_viewed: boolean;
  notes:         string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function csvExport(rows: Inquiry[]) {
  const header = ['Name', 'Firm', 'Email', 'Phone', 'State', 'Case Volume', 'Date', 'Contacted', 'Notes'];
  const lines  = rows.map(r => [
    r.name, r.firm, r.email, r.phone, r.state, r.case_volume,
    fmtDate(r.timestamp), r.contacted ? 'Yes' : 'No', r.notes,
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
  const [notes, setNotes] = useState(inquiry.notes ?? '');
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

// ── AttorneyInquiriesTab ──────────────────────────────────────────────────────

export function AttorneyInquiriesTab() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [stateFilter,  setStateFilter]  = useState('');
  const [volumeFilter, setVolumeFilter] = useState('');
  const [noteModal, setNoteModal] = useState<Inquiry | null>(null);

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

  const contacted   = inquiries.filter(i => i.contacted).length;
  const notContacted = inquiries.length - contacted;

  return (
    <div>
      <h1 className="sa-page-title">Attorney Inquiries</h1>

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="sa-stats" style={{ marginBottom: 24 }}>
        <div className="sa-stat-card">
          <div className="sa-stat-label">Total Inquiries</div>
          <div className="sa-stat-value">{inquiries.length}</div>
          <div className="sa-stat-sub">via attorneys page</div>
        </div>
        <div className="sa-stat-card sa-stat-card--warm">
          <div className="sa-stat-label">Awaiting Contact</div>
          <div className="sa-stat-value">{notContacted}</div>
          <div className="sa-stat-sub">need follow-up</div>
        </div>
        <div className="sa-stat-card sa-stat-card--hot">
          <div className="sa-stat-label">Contacted</div>
          <div className="sa-stat-value">{contacted}</div>
          <div className="sa-stat-sub">follow-up done</div>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="sa-table-wrap">
        <div className="sa-table-header">
          <span className="sa-table-title">Inquiries ({inquiries.length})</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
            <button
              className="sa-btn sa-btn--ghost"
              onClick={() => csvExport(inquiries)}
              disabled={inquiries.length === 0}
            >
              ↓ CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="sa-empty">Loading inquiries…</div>
        ) : inquiries.length === 0 ? (
          <div className="sa-empty">No inquiries yet.</div>
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
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map(inq => (
                  <tr key={inq.id} className={inq.contacted ? 'sa-row--muted' : ''}>
                    <td>
                      <div className="sa-lead-name">{inq.name}</div>
                      <div className="sa-lead-sub">{inq.firm}</div>
                    </td>
                    <td>
                      <div>{inq.email}</div>
                      <div className="sa-lead-sub">{inq.phone}</div>
                    </td>
                    <td>{inq.state}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{inq.case_volume}/mo</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(inq.timestamp)}</td>
                    <td>
                      <span className={`sa-badge ${inq.contacted ? 'sa-badge--green' : 'sa-badge--amber'}`}>
                        {inq.contacted ? '✓ Contacted' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ maxWidth: 160 }}>
                      <span className="sa-notes-preview">{inq.notes || '—'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className={`sa-btn sa-btn--xs ${inq.contacted ? 'sa-btn--ghost' : 'sa-btn--primary'}`}
                          onClick={() => markContacted(inq.id, !inq.contacted)}
                        >
                          {inq.contacted ? 'Unmark' : 'Mark Contacted'}
                        </button>
                        <button
                          className="sa-btn sa-btn--xs sa-btn--ghost"
                          onClick={() => setNoteModal(inq)}
                        >
                          Note
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Note modal ────────────────────────────────────────────────────── */}
      {noteModal && (
        <NoteModal
          inquiry={noteModal}
          onClose={() => setNoteModal(null)}
          onSave={saveNote}
        />
      )}
    </div>
  );
}
