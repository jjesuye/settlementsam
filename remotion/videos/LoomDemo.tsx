import React from 'react';
import {
  useCurrentFrame,
  interpolate,
  spring,
  Audio,
  staticFile,
  AbsoluteFill,
} from 'remotion';
import { StatCard } from '../components/StatCard';
import { PhoneMockup } from '../components/PhoneMockup';
import { ProgressBar } from '../components/ProgressBar';

const BG     = '#0A1628';
const AMBER  = '#E8A838';
const FOREST = '#4A7C59';
const FPS    = 30;

// Chapter boundaries
const C1 = 0;
const C2 = 45  * FPS;
const C3 = 120 * FPS;
const C4 = 180 * FPS;
const C5 = 240 * FPS;
const TOTAL = 300 * FPS;

function sp(frame: number, delay: number = 0, stiffness = 280) {
  return spring({ frame: frame - delay, fps: FPS, config: { stiffness, damping: 18 }, durationInFrames: 22 });
}

// ── Quiz data — defined OUTSIDE components to avoid null issues ───────────────
const QUIZ_QUESTIONS = [
  { q: 'What type of injury?', a: 'Auto accident injury' },
  { q: 'Were you at fault?', a: 'Not at fault' },
  { q: 'Did you have surgery?', a: 'Yes — spinal surgery' },
  { q: 'Were you hospitalized?', a: 'Yes, 3+ days' },
];

const LEAD_PROFILE = [
  { label: 'Name', value: 'Sarah M. (anonymized)' },
  { label: 'Injury', value: 'Spinal injury' },
  { label: 'Surgery', value: 'Yes — confirmed' },
  { label: 'Hospitalized', value: 'Yes, 3+ days' },
  { label: 'Lost wages', value: '$15,000+' },
  { label: 'Insurance contacted', value: 'Yes' },
  { label: 'SMS Verified', value: '✓ Confirmed' },
  { label: 'Estimated case value', value: '$75,000 – $200,000' },
];

// ── Chapter title card ────────────────────────────────────────────────────────
const ChapterCard: React.FC<{ number: string; title: string; frame: number }> = ({ number, title, frame }) => {
  const p = sp(frame, 0, 350);
  return (
    <div style={{ position: 'absolute', top: 36, left: 56, opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * -30}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 3, height: 36, background: AMBER, borderRadius: 2 }} />
        <div>
          <div style={{ color: AMBER, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Chapter {number}
          </div>
          <div style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700 }}>{title}</div>
        </div>
      </div>
    </div>
  );
};

// ── Typewriter effect ─────────────────────────────────────────────────────────
const TypewriterText: React.FC<{ text: string; frame: number; delay: number; style?: React.CSSProperties }> = ({ text, frame, delay, style }) => {
  const charsVisible = Math.max(0, Math.floor((frame - delay) * 2.5));
  return (
    <span style={style}>
      {text.slice(0, charsVisible)}
      {charsVisible < text.length && charsVisible >= 0 && (
        <span style={{ opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0, color: AMBER }}>|</span>
      )}
    </span>
  );
};

// ── VERIFIED stamp ────────────────────────────────────────────────────────────
const VerifiedStamp: React.FC<{ frame: number; delay: number }> = ({ frame, delay }) => {
  const p = spring({ frame: frame - delay, fps: FPS, config: { stiffness: 500, damping: 14 }, durationInFrames: 18 });
  const rotation = interpolate(p, [0, 1], [45, 0], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${p})`,
      opacity: p,
      border: `4px solid ${FOREST}`, borderRadius: 10,
      padding: '14px 28px', background: 'rgba(10,22,40,0.85)',
      color: FOREST, fontSize: 32, fontWeight: 900,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      textAlign: 'center', whiteSpace: 'nowrap',
      boxShadow: `0 0 30px rgba(74,124,89,0.4)`,
    }}>
      VERIFIED ✓
    </div>
  );
};

// ── Quiz screen component ─────────────────────────────────────────────────────
const QuizScreen: React.FC<{ step: number }> = ({ step }) => {
  if (!QUIZ_QUESTIONS || QUIZ_QUESTIONS.length === 0) return null;
  const safeStep = Math.max(0, Math.min(step, QUIZ_QUESTIONS.length - 1));
  const s = QUIZ_QUESTIONS[safeStep] ?? QUIZ_QUESTIONS[0];
  if (!s) return null;

  const progressPct = ((safeStep + 1) / QUIZ_QUESTIONS.length) * 100;

  return (
    <div style={{ width: '100%', padding: 16, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ color: AMBER, fontSize: 11, fontWeight: 700, textAlign: 'center', marginBottom: 10, letterSpacing: '0.1em' }}>
        SETTLEMENT SAM
      </div>
      <div style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 14, lineHeight: 1.4 }}>
        {s.q}
      </div>
      <div style={{ background: FOREST, color: '#FFFFFF', padding: '10px 14px', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
        {s.a} ✓
      </div>
      <div style={{ background: 'rgba(255,255,255,0.08)', height: 4, borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${progressPct}%`, background: AMBER, borderRadius: 2 }} />
      </div>
      <div style={{ color: '#9CA3AF', fontSize: 10, textAlign: 'center', marginTop: 6 }}>
        {safeStep + 1} of {QUIZ_QUESTIONS.length} questions
      </div>
    </div>
  );
};

// ── Chapter 1: The Problem ────────────────────────────────────────────────────
const PAIN_POINTS = [
  'Your intake team is wasting hours on unqualified callers.',
  'Shared leads mean 5 firms calling the same person.',
  "You're paying for clicks, not cases.",
];

const Ch1: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - C1;
  if (!PAIN_POINTS || PAIN_POINTS.length === 0) return null;

  const segDuration = 15 * FPS;
  const idx = Math.min(PAIN_POINTS.length - 1, Math.max(0, Math.floor(lf / segDuration)));
  const segFrame = lf - idx * segDuration;
  const p = sp(segFrame, 12, 350);
  const point = PAIN_POINTS[idx] ?? PAIN_POINTS[0];

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <ChapterCard number="1" title="The Problem" frame={lf} />
      <div style={{
        color: '#FFFFFF', fontSize: 44, fontWeight: 800, textAlign: 'center',
        maxWidth: 860, opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 30}px)`,
        lineHeight: 1.35, padding: '0 60px',
      }}>
        "{point}"
      </div>
    </AbsoluteFill>
  );
};

// ── Chapter 2: How It Works ───────────────────────────────────────────────────
const OVERLAY_LINES = [
  'Every lead answers 12 qualification questions',
  'SMS verification eliminates fake submissions',
  'Only verified, qualified leads enter the system',
];

const Ch2: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - C2;
  if (!OVERLAY_LINES || OVERLAY_LINES.length === 0) return null;

  const quizStep = Math.min(QUIZ_QUESTIONS.length - 1, Math.max(0, Math.floor(lf / (18 * FPS))));
  const phoneP = sp(lf, 20);

  const segDur = 25 * FPS;
  const oIdx = Math.min(OVERLAY_LINES.length - 1, Math.max(0, Math.floor(lf / segDur)));
  const oLine = OVERLAY_LINES[oIdx] ?? OVERLAY_LINES[0];
  const oP = sp(lf - oIdx * segDur, 10, 350);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 80, padding: 60 }}>
      <ChapterCard number="2" title="Inside The Lead Engine" frame={lf} />
      <div style={{ opacity: Math.min(1, phoneP * 1.5), transform: `scale(${0.75 + 0.25 * phoneP})` }}>
        <PhoneMockup screenContent={<QuizScreen step={quizStep} />} delay={20} />
      </div>
      <div style={{ maxWidth: 440 }}>
        <div style={{
          color: '#FFFFFF', fontSize: 26, fontWeight: 700, lineHeight: 1.45,
          opacity: Math.min(1, oP * 1.5), transform: `translateX(${(1 - oP) * 40}px)`,
        }}>
          "{oLine}"
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Chapter 3: Lead Quality ───────────────────────────────────────────────────
const Ch3: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - C3;
  if (!LEAD_PROFILE || LEAD_PROFILE.length === 0) return null;

  const header = sp(lf, 0);
  const stampDelay = LEAD_PROFILE.length * 10 + 20;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 60 }}>
      <ChapterCard number="3" title="Lead Quality" frame={lf} />
      <div style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 700, marginBottom: 20, marginTop: 60, opacity: Math.min(1, header * 2) }}>
        This is what you receive.
      </div>
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 840 }}>
        {LEAD_PROFILE.map((item, i) => {
          const p = sp(lf, i * 10 + 8);
          const charsVisible = Math.max(0, Math.floor((lf - (i * 10 + 8)) * 3));
          return (
            <div key={i} style={{
              background: '#0F1E35',
              borderLeft: `4px solid ${item.label === 'SMS Verified' ? FOREST : AMBER}`,
              borderRadius: 10, padding: '12px 18px',
              opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * -30}px)`,
            }}>
              <div style={{ color: '#9CA3AF', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{item.label}</div>
              <div style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 700 }}>
                {item.value.slice(0, charsVisible)}
                {charsVisible < item.value.length && charsVisible > 0 && (
                  <span style={{ opacity: Math.sin(lf * 0.4 + i) > 0 ? 1 : 0, color: AMBER }}>|</span>
                )}
              </div>
            </div>
          );
        })}
        <VerifiedStamp frame={lf} delay={stampDelay} />
      </div>
      <div style={{ color: '#9CA3AF', fontSize: 16, marginTop: 20, opacity: sp(lf, stampDelay + 20) }}>
        Not a name and phone number. A full injury profile.
      </div>
    </AbsoluteFill>
  );
};

// ── Chapter 4: Exclusivity ────────────────────────────────────────────────────
const SPECS = [
  { label: 'Exclusive Rights', value: '90 Days — your leads only' },
  { label: 'Replacement Guarantee', value: '100% on disconnects' },
  { label: 'Delivery', value: 'Real-time to your CRM' },
];

const Ch4: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - C4;
  if (!SPECS || SPECS.length === 0) return null;

  const p = sp(lf, 0, 300);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 80 }}>
      <ChapterCard number="4" title="Exclusivity & Guarantee" frame={lf} />
      <div style={{
        border: `2px solid rgba(232,168,56,0.4)`, borderRadius: 20,
        padding: '36px 56px',
        opacity: Math.min(1, p * 1.5), transform: `scale(${0.88 + 0.12 * p})`,
        boxShadow: `0 0 48px rgba(232,168,56,0.12)`,
      }}>
        <div style={{ color: '#FFFFFF', fontSize: 26, fontWeight: 800, textAlign: 'center', marginBottom: 24 }}>
          <span style={{ color: AMBER }}>25</span>-Lead Access Pass
        </div>
        {SPECS.map((s, i) => (
          <StatCard key={i} label={s.label} value={s.value} delay={i * 14} accent={FOREST} />
        ))}
      </div>
      <div style={{ color: '#CBD5E1', fontSize: 18, textAlign: 'center', maxWidth: 600, marginTop: 28, opacity: sp(lf, 60) }}>
        No other firm in your geography gets this lead.<br />
        If a lead doesn't answer, we replace it. No questions asked.
      </div>
    </AbsoluteFill>
  );
};

// ── Chapter 5: Close ──────────────────────────────────────────────────────────
const Ch5: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - C5;
  const p1 = sp(lf, 0);
  const p2 = sp(lf, 18);
  const p3 = sp(lf, 36);
  const pulse = Math.sin(lf * 0.15) * 0.5 + 0.5;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <ChapterCard number="5" title="The Close" frame={lf} />
      <div style={{ textAlign: 'center', padding: '0 80px' }}>
        <div style={{ color: '#FFFFFF', fontSize: 38, fontWeight: 800, opacity: Math.min(1, p1 * 1.5), marginBottom: 10 }}>
          25-lead minimum. No contracts.
        </div>
        <div style={{ color: AMBER, fontSize: 30, fontWeight: 700, opacity: Math.min(1, p2 * 1.5), marginBottom: 36 }}>
          Replace any bad lead.
        </div>
        <div style={{
          background: FOREST, color: '#FFFFFF', padding: '18px 52px',
          borderRadius: 50, fontSize: 22, fontWeight: 800,
          display: 'inline-block',
          opacity: Math.min(1, p3 * 1.5), transform: `scale(${0.8 + 0.2 * p3})`,
          boxShadow: `0 0 ${24 + 16 * pulse}px rgba(74,124,89,${0.45 + 0.25 * pulse})`,
        }}>
          settlementsam.com/attorneys
        </div>
        <div style={{ color: '#FFFFFF', fontSize: 40, fontWeight: 900, marginTop: 24, opacity: Math.min(1, p3 * 1.5) }}>
          <span style={{ color: '#FFFFFF' }}>Settlement</span>
          <span style={{ color: AMBER }}> Sam</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Root ──────────────────────────────────────────────────────────────────────
export const LoomDemo: React.FC = () => {
  const frame = useCurrentFrame();

  let audioEl: React.ReactNode = null;
  try { audioEl = <Audio src={staticFile('audio/loom-demo.mp3')} />; } catch { /* no audio */ }

  const fade = (s: number, e: number) =>
    interpolate(frame, [s, s + 12, e - 12, e], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      {audioEl}
      <ProgressBar />
      {frame < C2 + 12 && <div style={{ opacity: fade(C1, C2 + 12), position: 'absolute', inset: 0 }}><Ch1 frame={frame} /></div>}
      {frame >= C2 - 12 && frame < C3 + 12 && <div style={{ opacity: fade(C2, C3 + 12), position: 'absolute', inset: 0 }}><Ch2 frame={frame} /></div>}
      {frame >= C3 - 12 && frame < C4 + 12 && <div style={{ opacity: fade(C3, C4 + 12), position: 'absolute', inset: 0 }}><Ch3 frame={frame} /></div>}
      {frame >= C4 - 12 && frame < C5 + 12 && <div style={{ opacity: fade(C4, C5 + 12), position: 'absolute', inset: 0 }}><Ch4 frame={frame} /></div>}
      {frame >= C5 - 12 && <div style={{ opacity: fade(C5, TOTAL), position: 'absolute', inset: 0 }}><Ch5 frame={frame} /></div>}
    </AbsoluteFill>
  );
};
