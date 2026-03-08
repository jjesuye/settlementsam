'use client';

import { useState } from 'react';

interface Props {
  onComplete: (prefs: ContactPrefs) => void;
  leadName?: string;
}

export interface ContactPrefs {
  urgency: string;
  preferredHours: string[];
  timezone: string;
}

const URGENCY_OPTIONS = [
  { value: 'asap',      label: 'As soon as possible', sub: 'I need help right away' },
  { value: 'today',     label: 'Today',               sub: 'Sometime in the next few hours' },
  { value: 'this_week', label: 'This week',            sub: 'No rush, within a few days' },
];

const HOUR_SLOTS = [
  { value: 'morning',   label: 'Morning',   sub: '8am – 12pm' },
  { value: 'afternoon', label: 'Afternoon', sub: '12pm – 5pm' },
  { value: 'evening',   label: 'Evening',   sub: '5pm – 8pm' },
];

const BRAND = {
  amber:  '#E8A838',
  green:  '#4A7C59',
  text:   '#2C3E35',
  light:  '#6B7C74',
  border: '#E8DCC8',
  bg:     '#FDF6E9',
};

export default function ContactPreference({ onComplete, leadName }: Props) {
  const [urgency, setUrgency] = useState('');
  const [hours,   setHours]   = useState<string[]>([]);

  function toggleHour(val: string) {
    setHours(prev =>
      prev.includes(val)
        ? prev.filter(h => h !== val)
        : [...prev, val],
    );
  }

  function handleSubmit() {
    if (!urgency || hours.length === 0) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    onComplete({ urgency, preferredHours: hours, timezone });
  }

  const cardStyle = (selected: boolean): React.CSSProperties => ({
    padding:        '14px 16px',
    borderRadius:   12,
    border:         `2px solid ${selected ? BRAND.amber : BRAND.border}`,
    background:     selected ? '#FFF8EC' : '#FFFFFF',
    cursor:         'pointer',
    marginBottom:   8,
    textAlign:      'left',
    width:          '100%',
    transition:     'all 0.15s ease',
  });

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <p style={{ color: BRAND.text, fontWeight: 700, fontSize: 18, marginBottom: 4, textAlign: 'center' }}>
        {leadName ? `Almost done, ${leadName}!` : 'Almost done!'}
      </p>
      <p style={{ color: BRAND.light, fontSize: 14, marginBottom: 24, textAlign: 'center' }}>
        When is the best time for an attorney to reach you?
      </p>

      {/* Urgency */}
      <p style={{ color: BRAND.text, fontWeight: 600, fontSize: 13, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
        How soon do you need help?
      </p>
      {URGENCY_OPTIONS.map(opt => (
        <button key={opt.value} onClick={() => setUrgency(opt.value)} style={cardStyle(urgency === opt.value)}>
          <div style={{ fontWeight: 600, color: BRAND.text, fontSize: 15 }}>{opt.label}</div>
          <div style={{ fontSize: 12, color: BRAND.light, marginTop: 2 }}>{opt.sub}</div>
        </button>
      ))}

      {/* Time of day */}
      <p style={{ color: BRAND.text, fontWeight: 600, fontSize: 13, marginBottom: 8, marginTop: 20, textTransform: 'uppercase', letterSpacing: 1 }}>
        Best time of day? <span style={{ fontWeight: 400, textTransform: 'none' }}>(select all that apply)</span>
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        {HOUR_SLOTS.map(slot => (
          <button
            key={slot.value}
            onClick={() => toggleHour(slot.value)}
            style={{
              flex:        1,
              padding:     '12px 8px',
              borderRadius: 12,
              border:      `2px solid ${hours.includes(slot.value) ? BRAND.amber : BRAND.border}`,
              background:  hours.includes(slot.value) ? '#FFF8EC' : '#FFFFFF',
              cursor:      'pointer',
              textAlign:   'center',
            }}
          >
            <div style={{ fontWeight: 600, color: BRAND.text, fontSize: 13 }}>{slot.label}</div>
            <div style={{ fontSize: 11, color: BRAND.light, marginTop: 2 }}>{slot.sub}</div>
          </button>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!urgency || hours.length === 0}
        style={{
          width:        '100%',
          padding:      '14px',
          background:   (!urgency || hours.length === 0) ? '#D1D5DB' : BRAND.amber,
          color:        '#FFFFFF',
          fontSize:     16,
          fontWeight:   700,
          border:       'none',
          borderRadius: 12,
          cursor:       (!urgency || hours.length === 0) ? 'not-allowed' : 'pointer',
          marginTop:    24,
          transition:   'background 0.15s',
        }}
      >
        Get My Results →
      </button>
    </div>
  );
}
