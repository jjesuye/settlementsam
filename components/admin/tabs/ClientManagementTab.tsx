'use client';
/**
 * components/admin/tabs/ClientManagementTab.tsx
 * Tab 5 — Client records, Google Sheets push, Stripe invoice generator,
 * lead feedback / dispute inbox.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminFetch } from '@/lib/admin/auth';
import type { FsClient as DbClient } from '@/lib/firebase/types';

// ── ClientCard ────────────────────────────────────────────────────────────────
function ClientCard({
  client,
  onPushSheets,
  onInvoice,
  pushing,
  invoicing,
}: {
  client:    DbClient & { id: string };
  onPushSheets: (id: string) => void;
  onInvoice:    (id: string) => void;
  pushing:   string | null;
  invoicing: string | null;
}) {
  return (
    <motion.div
      className="sa-panel"
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ss-text)', marginBottom: 2 }}>{client.name}</div>
          <div style={{ fontSize: 13, color: 'var(--ss-muted)' }}>{client.firm}</div>
          <div style={{ fontSize: 12, color: 'var(--ss-amber)', marginTop: 4 }}>{client.email}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {client.sheets_id && (
            <button
              className="sa-btn sa-btn--success"
              onClick={() => onPushSheets(client.id)}
              disabled={pushing === client.id}
            >
              {pushing === client.id ? 'Pushing…' : '📊 Push to Sheets'}
            </button>
          )}
          <button
            className="sa-btn sa-btn--primary"
            onClick={() => onInvoice(client.id)}
            disabled={invoicing === client.id}
          >
            {invoicing === client.id ? 'Generating…' : '💳 Generate Invoice'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, marginTop: 8 }}>
        {[
          { label: 'Leads Purchased', value: client.leads_purchased },
          { label: 'Leads Delivered', value: client.leads_delivered },
          { label: 'Replaced',        value: client.leads_replaced  },
          { label: 'Balance',         value: `$${(client.balance ?? 0).toLocaleString()}`, color: 'var(--ss-gold)' },
        ].map(f => (
          <div key={f.label}>
            <div className="sa-field-key">{f.label}</div>
            <div className="sa-field-value" style={{ fontWeight: 700, color: f.color ?? 'var(--ss-text)' }}>{f.value}</div>
          </div>
        ))}
      </div>

      {client.sheets_id && (
        <div style={{ fontSize: 11, color: 'var(--ss-muted)', marginTop: 4 }}>
          Sheets ID: <code style={{ background: 'var(--ss-bg)', padding: '1px 6px', borderRadius: 4 }}>{client.sheets_id}</code>
        </div>
      )}
    </motion.div>
  );
}

// ── ClientManagementTab ───────────────────────────────────────────────────────

export function ClientManagementTab() {
  const [clients,   setClients]   = useState<(DbClient & { id: string })[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [pushing,   setPushing]   = useState<string | null>(null);
  const [invoicing, setInvoicing] = useState<string | null>(null);
  const [msg,       setMsg]       = useState('');

  const [form, setForm] = useState({
    name: '', firm: '', email: '', sheets_id: '',
  });

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const res  = await adminFetch('/api/admin/clients');
    const data = await res.json();
    if (res.ok) setClients(data.clients);
    setLoading(false);
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const res  = await adminFetch('/api/admin/clients', {
      method: 'POST',
      body:   JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg('✅ Client added.');
      setForm({ name: '', firm: '', email: '', sheets_id: '' });
      setShowForm(false);
      fetchClients();
    } else {
      setMsg(`❌ ${data.message ?? 'Failed to add client.'}`);
    }
  };

  const handlePushSheets = async (clientId: string) => {
    setPushing(clientId);
    setMsg('');
    try {
      const res  = await adminFetch('/api/distribute/sheets', {
        method: 'POST',
        body:   JSON.stringify({ clientId }),
      });
      const data = await res.json();
      setMsg(res.ok ? '✅ New leads pushed to Google Sheets.' : `❌ ${data.message ?? 'Push failed.'}`);
    } catch {
      setMsg('❌ Network error.');
    } finally {
      setPushing(null);
    }
  };

  const handleInvoice = async (clientId: string) => {
    setInvoicing(clientId);
    setMsg('');
    try {
      const res  = await adminFetch('/api/billing/invoice', {
        method: 'POST',
        body:   JSON.stringify({ clientId, quantity: 25 }),
      });
      const data = await res.json();
      if (res.ok && data.invoiceUrl) {
        window.open(data.invoiceUrl, '_blank');
        setMsg('✅ Invoice created and opened.');
      } else {
        setMsg(`❌ ${data.message ?? 'Invoice failed.'}`);
      }
    } catch {
      setMsg('❌ Network error.');
    } finally {
      setInvoicing(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="sa-page-title" style={{ margin: 0 }}>Client Management</h1>
        <button className="sa-btn sa-btn--primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? '✕ Cancel' : '+ Add Client'}
        </button>
      </div>

      {msg && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '12px 16px', borderRadius: 12, fontSize: 13,
            background: msg.startsWith('✅') ? 'rgba(240,180,41,0.10)' : 'rgba(248,113,113,0.10)',
            border:     `1px solid ${msg.startsWith('✅') ? 'rgba(240,180,41,0.3)' : 'rgba(248,113,113,0.3)'}`,
            color:      msg.startsWith('✅') ? 'var(--ss-gold)' : '#f87171',
          }}
        >
          {msg}
        </motion.div>
      )}

      {/* Add client form */}
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
            <p className="sa-panel-title">New Client</p>
            <form onSubmit={handleAddClient} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="sa-field-row">
                <div>
                  <label className="sa-label">Contact Name</label>
                  <input className="sa-input" placeholder="John Smith" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="sa-label">Law Firm</label>
                  <input className="sa-input" placeholder="Smith & Associates" value={form.firm}
                    onChange={e => setForm(f => ({ ...f, firm: e.target.value }))} required />
                </div>
              </div>
              <div className="sa-field-row">
                <div>
                  <label className="sa-label">Email</label>
                  <input className="sa-input" type="email" placeholder="john@smithlaw.com" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div>
                  <label className="sa-label">Google Sheets ID (optional)</label>
                  <input className="sa-input" placeholder="1BxiMVs0XRA..." value={form.sheets_id}
                    onChange={e => setForm(f => ({ ...f, sheets_id: e.target.value }))} />
                </div>
              </div>
              <button className="sa-submit" type="submit">Add Client</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Client list */}
      {loading ? (
        <p style={{ color: 'var(--ss-muted)' }}>Loading…</p>
      ) : clients.length === 0 ? (
        <div className="sa-panel" style={{ textAlign: 'center', color: 'var(--ss-muted)', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
          <p style={{ margin: 0 }}>No clients yet. Add your first law firm client above.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {clients.map(c => (
            <ClientCard
              key={c.id}
              client={c}
              onPushSheets={handlePushSheets}
              onInvoice={handleInvoice}
              pushing={pushing}
              invoicing={invoicing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
