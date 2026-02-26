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
import { AnimatedText } from '../components/AnimatedText';

const BG = '#0A1628';
const GREEN = '#00E676';
const AMBER = '#E8A838';
const FPS = 30;

// Chapter boundaries (frames)
const C1 = 0;
const C2 = 45  * FPS;
const C3 = 120 * FPS;
const C4 = 180 * FPS;
const C5 = 240 * FPS;
const TOTAL = 300 * FPS; // 5 minutes

function sp(frame: number, delay: number = 0) {
  return spring({ frame: frame - delay, fps: FPS, config: { damping: 14, stiffness: 100 }, durationInFrames: 22 });
}

function ChapterLabel({ number, title, frame }: { number: string; title: string; frame: number }) {
  const p = sp(frame, 0);
  return (
    <div style={{ position: 'absolute', top: 40, left: 60, opacity: p, transform: `translateX(${(1-p)*-20}px)` }}>
      <div style={{ color: GREEN, fontSize: 13, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Chapter {number}</div>
      <div style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 700 }}>{title}</div>
    </div>
  );
}

function PainSlides({ frame }: { frame: number }) {
  const lf = frame - C1;
  const points = [
    'Your intake team is wasting hours on unqualified callers',
    'Shared leads mean 5 firms calling the same person',
    "You're paying for clicks, not cases",
  ];
  const idx = Math.floor(lf / (15 * FPS));
  const pointFrame = lf - idx * 15 * FPS;
  const p = sp(pointFrame, 10);
  const point = points[Math.min(idx, points.length - 1)];

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <ChapterLabel number="1" title="The Problem" frame={lf} />
      <div style={{ color: '#FFFFFF', fontSize: 44, fontWeight: 700, textAlign: 'center', maxWidth: 900, opacity: p, transform: `translateY(${(1-p)*20}px)`, lineHeight: 1.3 }}>
        "{point}"
      </div>
    </AbsoluteFill>
  );
}

function QuizScreen({ step }: { step: number }) {
  const questions = [
    { q: 'What type of injury?', a: 'Auto accident injury' },
    { q: 'Were you at fault?', a: 'Not at fault' },
    { q: 'Did you have surgery?', a: 'Yes — spinal surgery' },
    { q: 'Were you hospitalized?', a: 'Yes, 3+ days' },
  ];
  const s = questions[Math.min(step, questions.length - 1)];
  return (
    <div style={{ width: '100%', padding: 16, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ color: '#9CA3AF', fontSize: 11, marginBottom: 12, textAlign: 'center' }}>Settlement Sam — Quiz</div>
      <div style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600, marginBottom: 12, textAlign: 'center', lineHeight: 1.3 }}>{s.q}</div>
      <div style={{ background: GREEN, color: '#0A1628', padding: '8px 12px', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>
        {s.a} ✓
      </div>
      <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.05)', height: 4, borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${((Math.min(step, 3) + 1) / 4) * 100}%`, background: AMBER, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function HowItWorks({ frame }: { frame: number }) {
  const lf = frame - C2;
  const quizStep = Math.min(3, Math.floor(lf / (15 * FPS)));
  const phoneP = sp(lf, 20);

  const overlays = [
    'Every lead answers 12 qualification questions',
    'SMS verification eliminates fake submissions',
    'Only verified, qualified leads enter the system',
  ];
  const oIdx = Math.min(2, Math.floor(lf / (25 * FPS)));
  const oP = sp(lf - oIdx * 25 * FPS, 10);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 80 }}>
      <ChapterLabel number="2" title="How Settlement Sam Works" frame={lf} />
      <div style={{ opacity: phoneP, transform: `scale(${0.8 + 0.2 * phoneP})` }}>
        <PhoneMockup screenContent={<QuizScreen step={quizStep} />} delay={20} />
      </div>
      <div style={{ maxWidth: 420 }}>
        <div style={{ color: '#FFFFFF', fontSize: 26, fontWeight: 700, opacity: oP, transform: `translateX(${(1-oP)*30}px)`, lineHeight: 1.4 }}>
          "{overlays[oIdx]}"
        </div>
      </div>
    </AbsoluteFill>
  );
}

function LeadQuality({ frame }: { frame: number }) {
  const lf = frame - C3;
  const header = sp(lf, 0);

  const profile = [
    { label: 'Name', value: 'Sarah M. (anonymized)' },
    { label: 'Injury', value: 'Spinal injury' },
    { label: 'Surgery', value: 'Yes' },
    { label: 'Hospitalized', value: 'Yes' },
    { label: 'Lost wages', value: '$15,000+' },
    { label: 'Insurance contacted', value: 'Yes' },
    { label: 'SMS Verified', value: '✓ Confirmed' },
    { label: 'Estimated case value', value: '$75,000 – $200,000' },
  ];

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 60 }}>
      <ChapterLabel number="3" title="Lead Quality" frame={lf} />
      <div style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 600, marginBottom: 20, opacity: header }}>This is what you receive.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 800 }}>
        {profile.map((p, i) => (
          <StatCard key={i} label={p.label} value={p.value} delay={i * 8} accent={p.label === 'SMS Verified' ? GREEN : AMBER} />
        ))}
      </div>
      <div style={{ color: '#9CA3AF', fontSize: 16, marginTop: 16, opacity: sp(lf, 80) }}>
        Not a name and phone number. A full injury profile.
      </div>
    </AbsoluteFill>
  );
}

function Exclusivity({ frame }: { frame: number }) {
  const lf = frame - C4;
  const p = sp(lf, 0);

  const specs = [
    { label: 'Exclusive Rights', value: '90 Days ✓', accent: GREEN },
    { label: 'Replacement Guarantee', value: '100% on disconnects ✓', accent: GREEN },
    { label: 'Delivery', value: 'Real-time to your CRM ✓', accent: GREEN },
  ];

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 80 }}>
      <ChapterLabel number="4" title="Exclusivity & Guarantee" frame={lf} />
      <div style={{ border: `2px solid ${GREEN}`, borderRadius: 20, padding: '32px 48px', opacity: p, transform: `scale(${0.9 + 0.1 * p})`, boxShadow: `0 0 40px rgba(0,230,118,${0.2 * p})` }}>
        <div style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 20 }}>25-Lead Access Pass</div>
        {specs.map((s, i) => <StatCard key={i} label={s.label} value={s.value} delay={i * 12} accent={s.accent} />)}
      </div>
      <div style={{ color: '#9CA3AF', fontSize: 17, textAlign: 'center', maxWidth: 600, marginTop: 24, opacity: sp(lf, 60) }}>
        No other firm in your geography gets this lead.<br />
        If a lead doesn't answer, we replace it. No questions.
      </div>
    </AbsoluteFill>
  );
}

function Close({ frame }: { frame: number }) {
  const lf = frame - C5;
  const p1 = sp(lf, 0);
  const p2 = sp(lf, 20);
  const p3 = sp(lf, 40);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <ChapterLabel number="5" title="The Close" frame={lf} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#FFFFFF', fontSize: 36, fontWeight: 700, opacity: p1, marginBottom: 8 }}>25-lead minimum. No contracts.</div>
        <div style={{ color: GREEN, fontSize: 28, fontWeight: 600, opacity: p2, marginBottom: 24 }}>Replace any bad lead.</div>
        <div style={{ color: GREEN, fontSize: 20, fontWeight: 700, opacity: p3, marginBottom: 12 }}>settlingsam.com/attorneys</div>
        <div style={{ color: '#FFFFFF', fontSize: 32, fontWeight: 800, opacity: p3, transform: `scale(${0.85 + 0.15*p3})` }}>
          Settlement Sam
        </div>
      </div>
    </AbsoluteFill>
  );
}

export const LoomDemo: React.FC = () => {
  const frame = useCurrentFrame();

  let audioEl: React.ReactNode = null;
  try { audioEl = <Audio src={staticFile('audio/loom-demo.mp3')} />; } catch { /* no audio */ }

  const fade = (s: number, e: number) =>
    interpolate(frame, [s, s + 10, e - 10, e], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      {audioEl}
      <ProgressBar />
      {frame < C2 + 10 && <div style={{ opacity: fade(C1, C2 + 10), position: 'absolute', inset: 0 }}><PainSlides frame={frame} /></div>}
      {frame >= C2 - 10 && frame < C3 + 10 && <div style={{ opacity: fade(C2, C3 + 10), position: 'absolute', inset: 0 }}><HowItWorks frame={frame} /></div>}
      {frame >= C3 - 10 && frame < C4 + 10 && <div style={{ opacity: fade(C3, C4 + 10), position: 'absolute', inset: 0 }}><LeadQuality frame={frame} /></div>}
      {frame >= C4 - 10 && frame < C5 + 10 && <div style={{ opacity: fade(C4, C5 + 10), position: 'absolute', inset: 0 }}><Exclusivity frame={frame} /></div>}
      {frame >= C5 - 10 && <div style={{ opacity: fade(C5, TOTAL), position: 'absolute', inset: 0 }}><Close frame={frame} /></div>}
    </AbsoluteFill>
  );
};
