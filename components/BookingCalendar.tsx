'use client';

import { useState } from 'react';

interface Props {
  attorneyName:  string;
  attorneyEmail: string;
  firmName:      string;
  onBooked:      (slot: BookingSlot) => void;
}

export interface BookingSlot {
  date:        string; // "2026-03-15"
  time:        string; // "10:00 AM"
  displayDate: string; // "Sat, Mar 15"
}

const BRAND = {
  amber:  '#E8A838',
  green:  '#4A7C59',
  navy:   '#0A1628',
  text:   '#2C3E35',
  light:  '#6B7C74',
  border: '#E8DCC8',
  bg:     '#FDF6E9',
  card:   '#FFFFFF',
};

// Generate next 14 weekdays from today
function getAvailableDays(): { date: Date; label: string; value: string }[] {
  const days: { date: Date; label: string; value: string }[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1); // start tomorrow

  while (days.length < 14) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push({
        date:  new Date(d),
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        value: d.toISOString().split('T')[0],
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

const ALL_SLOTS = [
  '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM',  '2:00 PM',
  '3:00 PM',  '4:00 PM',
];

// Pre-block 2 deterministic slots per day to show demand
function getAvailableSlots(dateValue: string): string[] {
  const seed    = dateValue.split('-').reduce((a, b) => a + parseInt(b), 0);
  const blocked = [seed % 8, (seed + 3) % 8];
  return ALL_SLOTS.filter((_, i) => !blocked.includes(i));
}

export default function BookingCalendar({ attorneyName, attorneyEmail, firmName, onBooked }: Props) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [booked,       setBooked]       = useState(false);
  const [error,        setError]        = useState('');

  const days           = getAvailableDays();
  const availableSlots = selectedDate ? getAvailableSlots(selectedDate) : [];
  const selectedDay    = days.find(d => d.value === selectedDate);
  const selectedDayLabel = selectedDay?.label ?? '';

  async function handleBook() {
    if (!selectedDate || !selectedTime || loading) return;
    setLoading(true);
    setError('');

    const slot: BookingSlot = { date: selectedDate, time: selectedTime, displayDate: selectedDayLabel };

    try {
      const res = await fetch('/api/bookings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:         attorneyName,
          firm:         firmName,
          email:        attorneyEmail,
          phone:        '',
          state:        '',
          case_volume:  '',
          date:         selectedDate,
          time:         selectedTime,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError('That slot was just taken — please choose another time.');
          setSelectedTime('');
        } else {
          setError(data.message ?? 'Booking failed. Please try again.');
        }
        return;
      }

      setBooked(true);
      onBooked(slot);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (booked) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 24px', background: BRAND.card, borderRadius: 16, border: `1px solid ${BRAND.border}` }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <h3 style={{ color: BRAND.green, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Call Confirmed</h3>
        <p style={{ color: BRAND.text, fontSize: 16, marginBottom: 4 }}>{selectedDayLabel} at {selectedTime} EST</p>
        <p style={{ color: BRAND.light, fontSize: 14 }}>A confirmation has been sent to {attorneyEmail}</p>
        <div style={{ marginTop: 24, padding: 16, background: BRAND.bg, borderRadius: 12, fontSize: 13, color: BRAND.light, textAlign: 'left' }}>
          <strong style={{ color: BRAND.text }}>What to expect:</strong><br />
          A 20-minute call where we walk through your market availability,
          lead quality, and how delivery works for your firm.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: BRAND.card, borderRadius: 16, border: `1px solid ${BRAND.border}`, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: BRAND.navy, padding: '20px 24px', color: '#FFFFFF' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#FFFFFF' }}>
          Schedule Your Demo Call
        </h3>
        <p style={{ fontSize: 13, color: '#9CA3AF' }}>
          20 minutes — we'll show you your market and walk through pricing
        </p>
      </div>

      <div style={{ padding: 24 }}>
        {/* Date picker */}
        <p style={{ fontWeight: 600, color: BRAND.text, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Select a Date
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
          {days.slice(0, 8).map(day => (
            <button
              key={day.value}
              onClick={() => { setSelectedDate(day.value); setSelectedTime(''); setError(''); }}
              style={{
                padding:     '10px 6px',
                borderRadius: 10,
                border:      `2px solid ${selectedDate === day.value ? BRAND.amber : BRAND.border}`,
                background:   selectedDate === day.value ? '#FFF8EC' : BRAND.card,
                cursor:      'pointer',
                fontSize:    11,
                fontWeight:   selectedDate === day.value ? 700 : 400,
                color:        BRAND.text,
                textAlign:   'center',
                lineHeight:   1.4,
              }}
            >
              {day.label.split(', ').map((part, i) => <div key={i}>{part}</div>)}
            </button>
          ))}
        </div>

        {/* Time slots */}
        {selectedDate && (
          <>
            <p style={{ fontWeight: 600, color: BRAND.text, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Available Times (EST)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
              {ALL_SLOTS.map(slot => {
                const available = availableSlots.includes(slot);
                const selected  = selectedTime === slot;
                return (
                  <button
                    key={slot}
                    onClick={() => available && setSelectedTime(slot)}
                    disabled={!available}
                    style={{
                      padding:      '10px',
                      borderRadius:  10,
                      border:       `2px solid ${!available ? '#F3F4F6' : selected ? BRAND.amber : BRAND.border}`,
                      background:    !available ? '#F9FAFB' : selected ? '#FFF8EC' : BRAND.card,
                      cursor:        available ? 'pointer' : 'not-allowed',
                      fontSize:      13,
                      fontWeight:    selected ? 700 : 400,
                      color:         !available ? '#D1D5DB' : BRAND.text,
                    }}
                  >
                    {available ? slot : 'Taken'}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {error && (
          <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</p>
        )}

        {/* Book button */}
        <button
          onClick={handleBook}
          disabled={!selectedDate || !selectedTime || loading}
          style={{
            width:        '100%',
            padding:      '14px',
            background:   (!selectedDate || !selectedTime) ? '#E5E7EB' : BRAND.amber,
            color:        (!selectedDate || !selectedTime) ? '#9CA3AF' : '#FFFFFF',
            fontSize:     16,
            fontWeight:   700,
            border:       'none',
            borderRadius:  12,
            cursor:        (!selectedDate || !selectedTime) ? 'not-allowed' : 'pointer',
            transition:   'background 0.15s',
          }}
        >
          {loading
            ? 'Confirming…'
            : selectedDate && selectedTime
              ? `Confirm — ${selectedDayLabel} at ${selectedTime}`
              : 'Select a date and time'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: BRAND.light, marginTop: 12 }}>
          Free 20-min call. No commitment required.
        </p>
      </div>
    </div>
  );
}
