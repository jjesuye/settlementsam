'use client';
/**
 * app/admin/page.tsx
 *
 * Main admin dashboard shell.
 * Auth gate: redirects to /admin/login when unauthenticated.
 * Handles inactivity logout, tab routing, and sidebar nav.
 * All tabs are lazy-mounted via conditional rendering (no router needed).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { isLoggedIn, clearToken, startActivityWatcher } from '@/lib/admin/auth';
import { PipelineTab }            from '@/components/admin/tabs/PipelineTab';
import { LeadProfileTab }         from '@/components/admin/tabs/LeadProfileTab';
import { SmsControlsTab }         from '@/components/admin/tabs/SmsControlsTab';
import { AdPerformanceTab }       from '@/components/admin/tabs/AdPerformanceTab';
import { ClientManagementTab }    from '@/components/admin/tabs/ClientManagementTab';
import { AttorneyInquiriesTab }   from '@/components/admin/tabs/AttorneyInquiriesTab';

type Tab = 'pipeline' | 'leads' | 'sms' | 'ads' | 'clients' | 'attorneys';

const NAV_ITEMS: { id: Tab; icon: string; label: string }[] = [
  { id: 'pipeline',  icon: '📊', label: 'Pipeline'          },
  { id: 'leads',     icon: '👤', label: 'Lead Profile'      },
  { id: 'sms',       icon: '📱', label: 'SMS Controls'      },
  { id: 'ads',       icon: '📈', label: 'Ad Performance'    },
  { id: 'clients',   icon: '🏢', label: 'Clients'           },
  { id: 'attorneys', icon: '⚖️', label: 'Attorney Inquiries' },
];

export default function AdminPage() {
  const router = useRouter();
  const [authed,   setAuthed]   = useState<boolean | null>(null); // null = checking
  const [tab,      setTab]      = useState<Tab>('pipeline');
  const [leadId,   setLeadId]   = useState<string | null>(null);

  // Auth check on mount — redirect to /admin/login if not authenticated
  useEffect(() => {
    const ok = isLoggedIn();
    if (!ok) {
      router.replace('/admin/login');
    } else {
      setAuthed(true);
    }
  }, [router]);

  // Inactivity watcher
  const handleLogout = useCallback(() => {
    clearToken();
    setAuthed(false);
    router.replace('/admin/login');
  }, [router]);

  useEffect(() => {
    if (!authed) return;
    const cleanup = startActivityWatcher(handleLogout);
    return cleanup;
  }, [authed, handleLogout]);

  // ── Loading / redirecting ─────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ss-bg)' }}>
        <div style={{ color: 'var(--ss-muted)', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  // ── Navigate to a lead's profile ─────────────────────────────────────────────
  const viewLead = (id: string) => {
    setLeadId(id);
    setTab('leads');
  };

  // ── Dashboard shell ───────────────────────────────────────────────────────────
  return (
    <div className="sa-layout">
      {/* Sidebar */}
      <nav className="sa-sidebar">
        <div className="sa-sidebar-brand">
          <img src="/images/sam-icons/sam-logo.png" height={24} alt="" aria-hidden="true" />
          <span>Sam Admin</span>
        </div>

        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`sa-nav-item${tab === item.id ? ' sa-nav-item--active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <span className="sa-nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        <button
          className="sa-nav-item"
          onClick={handleLogout}
          style={{ color: '#f87171' }}
        >
          <span className="sa-nav-icon">🚪</span>
          Sign Out
        </button>
      </nav>

      {/* Main content */}
      <main className="sa-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'pipeline'  && <PipelineTab onViewLead={viewLead} />}
            {tab === 'leads'     && <LeadProfileTab leadId={leadId} onBack={() => setTab('pipeline')} />}
            {tab === 'sms'       && <SmsControlsTab />}
            {tab === 'ads'       && <AdPerformanceTab />}
            {tab === 'clients'   && <ClientManagementTab />}
            {tab === 'attorneys' && <AttorneyInquiriesTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
