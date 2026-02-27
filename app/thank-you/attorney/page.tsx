'use client';
/**
 * app/thank-you/attorney/page.tsx
 *
 * Thank you page for attorneys after submitting the inquiry form.
 * Shows confirmation + custom booking calendar.
 *
 * URL: /thank-you/attorney?name=Jane&firm=Smith+%26+Associates&email=...&state=California&case_volume=5-15
 */

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { format, addMonths, startOfMonth, getDaysInMonth, getDay, isBefore, startOfToday, addDays } from 'date-fns';

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};
const stagger = { visible: { transition: { staggerChildren: 0.12 } } };

// ── Available time slots ──────────────────────────────────────────────────────

const ALL_SLOTS = ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'];

/**
 * Deterministically block slots for "social proof" — shows demand.
 * Uses date as seed so the same day always shows the same blocked slots.
 * Always blocks: first slot + one afternoon slot per day.
 */
function getBlockedSlots(date: Date): Set<string> {
  const day  = date.getDate();
  const seed = day % 3; // 0, 1, 2 rotation
  const blocked = new Set<string>();
  blocked.add(ALL_SLOTS[0]); // always block first (9 AM)
  // Block one afternoon slot (2, 3, or 4 PM) in rotation
  blocked.add(ALL_SLOTS[3 + seed]);
  return blocked;
}

// ── Calendar widget ───────────────────────────────────────────────────────────

function CalendarBooking({
  name, firm, email, phone, state, caseVolume,
}: {
  name: string; firm: string; email: string;
  phone: string; state: string; caseVolume: string;
}) {
  const today      = startOfToday();
  const [viewMonth, setViewMonth]      = useState(today);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookingState, setBookingState] = useState<'pick' | 'confirm' | 'done'>('pick');
  const [error,        setError]        = useState('');

  const months = [viewMonth, addMonths(viewMonth, 1)];

  function renderMonth(monthDate: Date) {
    const year        = monthDate.getFullYear();
    const month       = monthDate.getMonth();
    const daysInMonth = getDaysInMonth(monthDate);
    const firstDay    = getDay(startOfMonth(monthDate)); // 0=Sun
    const blanks      = Array.from({ length: firstDay });

    return (
      <div className="cal-month">
        <div className="cal-month-header">
          {format(monthDate, 'MMMM yyyy')}
        </div>
        <div className="cal-weekdays">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="cal-weekday">{d}</div>
          ))}
        </div>
        <div className="cal-days-grid">
          {blanks.map((_, i) => <div key={`b-${i}`} className="cal-day cal-day--blank" />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date    = new Date(year, month, i + 1);
            const dow     = date.getDay();
            const isWeekend  = dow === 0 || dow === 6;
            const isPast     = isBefore(date, today);
            const isSelected = selectedDate?.toDateString() === date.toDateString();
            const disabled   = isWeekend || isPast;

            return (
              <button
                key={i}
                className={`cal-day${disabled ? ' cal-day--disabled' : ''}${isSelected ? ' cal-day--selected' : ''}`}
                disabled={disabled}
                onClick={() => { setSelectedDate(date); setSelectedTime(null); }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  async function handleConfirm() {
    if (!selectedDate || !selectedTime) return;
    setError('');
    setBookingState('confirm');
    try {
      const res  = await fetch('/api/bookings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name, firm, email, phone, state, case_volume: caseVolume,
          date: format(selectedDate, 'yyyy-MM-dd'),
          time: selectedTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Booking failed.');
      setBookingState('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBookingState('pick');
    }
  }

  if (bookingState === 'done') {
    return (
      <motion.div
        className="cal-confirmed"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <div className="cal-confirmed-icon">✓</div>
        <h3>You're booked!</h3>
        <p>
          <strong>{format(selectedDate!, 'EEEE, MMMM d')}</strong> at{' '}
          <strong>{selectedTime}</strong> EST
        </p>
        <p className="cal-confirmed-sub">
          A confirmation email has been sent to <strong>{email}</strong>.
          We'll send a reminder 24 hours before your call.
        </p>
      </motion.div>
    );
  }

  const blockedSlots = selectedDate ? getBlockedSlots(selectedDate) : new Set<string>();

  return (
    <div className="cal-widget">
      <h3 className="cal-title">Book Your Demo Call</h3>
      <p className="cal-sub">All times are EST. Monday–Friday only.</p>

      <div className="cal-months-grid">
        {months.map((m, i) => (
          <div key={i}>{renderMonth(m)}</div>
        ))}
      </div>

      <AnimatePresence>
        {selectedDate && (
          <motion.div
            className="cal-slots"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <p className="cal-slots-title">
              {format(selectedDate, 'EEEE, MMMM d')} — available times:
            </p>
            <div className="cal-slots-grid">
              {ALL_SLOTS.map(slot => {
                const taken    = blockedSlots.has(slot);
                const selected = selectedTime === slot;
                return (
                  <button
                    key={slot}
                    className={`cal-slot${taken ? ' cal-slot--taken' : ''}${selected ? ' cal-slot--selected' : ''}`}
                    disabled={taken}
                    onClick={() => setSelectedTime(slot)}
                  >
                    {taken ? 'Taken' : slot}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDate && selectedTime && (
          <motion.div
            className="cal-confirm-bar"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
          >
            <p className="cal-confirm-label">
              Book <strong>{format(selectedDate, 'EEE, MMM d')}</strong> at <strong>{selectedTime}</strong> EST
            </p>
            {error && <p className="cal-error">{error}</p>}
            <button
              className="cal-confirm-btn"
              onClick={handleConfirm}
              disabled={bookingState === 'confirm'}
            >
              {bookingState === 'confirm' ? 'Booking…' : 'Confirm This Time →'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function AttorneyThankYouContent() {
  const params     = useSearchParams();
  const name       = params.get('name')        ?? '';
  const firm       = params.get('firm')        ?? '';
  const email      = params.get('email')       ?? '';
  const phone      = params.get('phone')       ?? '';
  const state      = params.get('state')       ?? '';
  const caseVolume = params.get('case_volume') ?? '';

  const firstName = name.split(' ')[0] || 'there';

  return (
    <div className="ty-page ty-page--attorney">
      <div className="ty-glow ty-glow--green" aria-hidden="true" />

      <motion.div
        className="ty-card ty-card--wide"
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
          Welcome, {firstName}. Let's talk leads.
        </motion.h1>

        {/* Subtext */}
        <motion.p variants={fadeUp} className="ty-sub">
          A member of the Settlement Sam team will contact you within 4 business hours
          to walk you through our current inventory and pricing
          {state ? ` for ${state}` : ''}.
        </motion.p>

        {/* What to expect */}
        <motion.div variants={fadeUp} className="ty-next-card">
          <h3 className="ty-next-title">On the call we'll cover:</h3>
          <ul className="ty-expect-list">
            <li>✓ Current verified case inventory in your state</li>
            <li>✓ Case quality samples and intake breakdown</li>
            <li>✓ Volume pricing and exclusivity terms</li>
            <li>✓ How the replacement guarantee works</li>
          </ul>
        </motion.div>

        {/* Calendar booking */}
        <motion.div variants={fadeUp} className="ty-calendar-section">
          <CalendarBooking
            name={name}
            firm={firm}
            email={email}
            phone={phone}
            state={state}
            caseVolume={caseVolume}
          />
        </motion.div>

        <motion.div variants={fadeUp}>
          <Link href="/attorneys" className="ty-home-btn">← Back to Attorneys Page</Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function AttorneyThankYouPage() {
  return (
    <Suspense fallback={<div className="ty-page ty-page--attorney" />}>
      <AttorneyThankYouContent />
    </Suspense>
  );
}
