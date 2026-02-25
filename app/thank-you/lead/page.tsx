'use client';
/**
 * app/thank-you/lead/page.tsx
 *
 * Thank you page shown after a lead completes the quiz + SMS verification.
 * Dynamic data (first name, state, leadId) pulled from URL search params.
 *
 * URL: /thank-you/lead?name=Sam&state=California&leadId=abc123
 */

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};
const stagger = { visible: { transition: { staggerChildren: 0.12 } } };

// ── Contact preference ────────────────────────────────────────────────────────

type Timing   = 'asap' | 'later_today' | 'tomorrow';
type TimeSlot = 'morning' | 'afternoon' | 'evening';

const TIMING_OPTIONS: { value: Timing; icon: string; label: string }[] = [
  { value: 'asap',        icon: '⚡', label: 'As soon as possible' },
  { value: 'later_today', icon: '🕐', label: 'Later today'         },
  { value: 'tomorrow',    icon: '📅', label: 'Tomorrow'            },
];

const SLOT_OPTIONS: { value: TimeSlot; icon: string; label: string }[] = [
  { value: 'morning',   icon: '🌅', label: 'Early Morning (8–11 AM)' },
  { value: 'afternoon', icon: '☀️', label: 'Afternoon (12–4 PM)'     },
  { value: 'evening',   icon: '🌆', label: 'Evening (4–7 PM)'        },
];

function ContactPreference({ leadId }: { leadId: string }) {
  const [timing,   setTiming]   = useState<Timing | null>(null);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | null>(null);
  const [saved,    setSaved]    = useState(false);
  const [saving,   setSaving]   = useState(false);

  async function handleSave() {
    if (!timing || !timeSlot || !leadId) return;
    setSaving(true);
    try {
      await fetch('/api/leads/contact-preference', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ leadId, timing, time_slot: timeSlot }),
      });
      setSaved(true);
    } catch { /* non-fatal */ } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <motion.div
        className="ty-pref-saved"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <span className="ty-pref-saved-icon">✓</span>
        <p>Got it! We'll reach out at your preferred time.</p>
      </motion.div>
    );
  }

  return (
    <div className="ty-pref-widget">
      <h3 className="ty-pref-title">When should we contact you?</h3>
      <p className="ty-pref-sub">Pick your preferred time and we'll make it happen.</p>

      {/* Timing pills */}
      <div className="ty-pref-pills">
        {TIMING_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`ty-pref-pill${timing === opt.value ? ' ty-pref-pill--selected' : ''}`}
            onClick={() => { setTiming(opt.value); setTimeSlot(null); }}
          >
            <span className="ty-pref-pill-icon">{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Time slot pills (shown after timing selection) */}
      <AnimatePresence>
        {timing && (
          <motion.div
            className="ty-pref-slots"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
          >
            <p className="ty-pref-slots-label">What time of day works best?</p>
            <div className="ty-pref-pills">
              {SLOT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`ty-pref-pill${timeSlot === opt.value ? ' ty-pref-pill--selected' : ''}`}
                  onClick={() => setTimeSlot(opt.value)}
                >
                  <span className="ty-pref-pill-icon">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save button (shown when both selected) */}
      <AnimatePresence>
        {timing && timeSlot && (
          <motion.button
            className="ty-pref-save-btn"
            onClick={handleSave}
            disabled={saving}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            {saving ? 'Saving…' : 'Save My Preference →'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function LeadThankYouContent() {
  const params    = useSearchParams();
  const firstName = params.get('name')   ?? 'there';
  const state     = params.get('state')  ?? 'your state';
  const leadId    = params.get('leadId') ?? '';

  return (
    <div className="ty-page">
      {/* Ambient glow */}
      <div className="ty-glow" aria-hidden="true" />

      <motion.div
        className="ty-card"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        {/* Sam icon */}
        <motion.div variants={fadeUp} className="ty-sam-wrap">
          <motion.img
            src="/images/sam-icons/sam-logo.png"
            alt="Settlement Sam"
            className="ty-sam-icon"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.1 }}
          />
        </motion.div>

        {/* Headline */}
        <motion.h1 variants={fadeUp} className="ty-headline">
          You're all set, {firstName}! 🎉
        </motion.h1>

        {/* Subtext */}
        <motion.p variants={fadeUp} className="ty-sub">
          A licensed personal injury attorney in{' '}
          <strong>{state}</strong> will reach out to review your case.
          This is completely free — attorneys only get paid when you win.
        </motion.p>

        {/* What happens next */}
        <motion.div variants={fadeUp} className="ty-next-card">
          <h3 className="ty-next-title">What happens next</h3>
          <ol className="ty-steps">
            <li>
              <span className="ty-step-num">1</span>
              <span>An attorney reviews your case details</span>
            </li>
            <li>
              <span className="ty-step-num">2</span>
              <span>They contact you within 1 business day</span>
            </li>
            <li>
              <span className="ty-step-num">3</span>
              <span>Your free consultation is scheduled</span>
            </li>
            <li>
              <span className="ty-step-num">4</span>
              <span>You decide if you want to move forward</span>
            </li>
          </ol>
        </motion.div>

        {/* Contact preference */}
        {leadId && (
          <motion.div variants={fadeUp}>
            <ContactPreference leadId={leadId} />
          </motion.div>
        )}

        {/* Sam quote */}
        <motion.blockquote variants={fadeUp} className="ty-quote">
          <p>
            "I've seen cases like yours result in life-changing settlements.
            You deserve to know what you're really worth."
          </p>
          <cite>— Sam</cite>
        </motion.blockquote>

        {/* Back to home */}
        <motion.div variants={fadeUp}>
          <Link href="/" className="ty-home-btn">← Back to Homepage</Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function LeadThankYouPage() {
  return (
    <Suspense fallback={<div className="ty-page" />}>
      <LeadThankYouContent />
    </Suspense>
  );
}
