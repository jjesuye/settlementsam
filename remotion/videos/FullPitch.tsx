import React from 'react';
import {
  useCurrentFrame,
  interpolate,
  spring,
  Audio,
  staticFile,
  AbsoluteFill,
} from 'remotion';
import { CountUp } from '../components/CountUp';
import { PhoneMockup } from '../components/PhoneMockup';
import { StatCard } from '../components/StatCard';
import { ProgressBar } from '../components/ProgressBar';

const BG = '#0A1628';
const GREEN = '#00E676';
const FPS = 30;

const S1 = 0;
const S2 = 5  * FPS;
const S3 = 20 * FPS;
const S4 = 40 * FPS;
const S5 = 65 * FPS;
const S6 = 80 * FPS;
const TOTAL = 90 * FPS;

function sp(frame: number, delay: number = 0) {
  return spring({ frame: frame - delay, fps: FPS, config: { damping: 14, stiffness: 100 }, durationInFrames: 22 });
}

// Letter-by-letter reveal
function LetterReveal({ text, frame, delay = 0, style }: { text: string; frame: number; delay?: number; style?: React.CSSProperties }) {
  const charsPerFrame = 1.5;
  const startFrame = delay;
  return (
    <span style={style}>
      {text.split('').map((char, i) => {
        const p = Math.max(0, Math.min(1, (frame - startFrame - i / charsPerFrame) / 8));
        return (
          <span key={i} style={{ opacity: p, display: 'inline-block' }}>
            {char === ' ' ? '\u00A0' : char}
          </span>
        );
      })}
    </span>
  );
}

function Scene1({ frame }: { frame: number }) {
  const lf = frame - S1;
  const line2P = sp(lf, 40);
  return (
    <AbsoluteFill style={{ background: '#000000', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <LetterReveal
        text="Stop paying for effort."
        frame={lf}
        delay={15}
        style={{ color: '#FFFFFF', fontSize: 56, fontWeight: 800, display: 'block', textAlign: 'center', marginBottom: 16 }}
      />
      <div style={{ color: GREEN, fontSize: 48, fontWeight: 700, opacity: line2P, transform: `translateY(${(1-line2P)*16}px)`, textAlign: 'center' }}>
        Start paying for outcomes.
      </div>
    </AbsoluteFill>
  );
}

function Scene2({ frame }: { frame: number }) {
  const lf = frame - S2;
  const stats = [
    'The average PI firm spends $8,000/month on marketing',
    'Less than 3% of leads become signed cases',
    'Most leads are shared with 5+ competing firms',
    "You don't know what you're getting until it's too late",
  ];
  const statDuration = Math.floor((S3 - S2) / stats.length);
  const idx = Math.min(stats.length - 1, Math.floor(lf / statDuration));
  const localFrame = lf - idx * statDuration;
  const p = sp(localFrame, 5);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        color: '#FFFFFF', fontSize: 40, fontWeight: 700, textAlign: 'center', maxWidth: 900,
        opacity: p, transform: `translateY(${(1-p)*20}px)`, lineHeight: 1.3,
      }}>
        {stats[idx]}
      </div>
    </AbsoluteFill>
  );
}

function Scene3({ frame }: { frame: number }) {
  const lf = frame - S3;
  const logoP = sp(lf, 0);
  const subtitleP = sp(lf, 20);
  const pillars = [
    { icon: '🔒', text: 'SMS-Verified Humans Only' },
    { icon: '👤', text: 'Full Injury Profiles, Pre-Screened' },
    { icon: '⚡', text: 'Exclusive 90-Day Rights' },
  ];

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ color: GREEN, fontSize: 42, fontWeight: 800, opacity: logoP, transform: `scale(${0.8 + 0.2*logoP})`, marginBottom: 12 }}>
        Settlement Sam
      </div>
      <div style={{ color: '#9CA3AF', fontSize: 20, opacity: subtitleP, marginBottom: 32 }}>
        Introducing a different model.
      </div>
      <div style={{ display: 'flex', gap: 32 }}>
        {pillars.map((p, i) => {
          const pp = sp(lf, 30 + i * 15);
          return (
            <div key={i} style={{
              background: '#0F1E35', border: `2px solid ${GREEN}`, borderRadius: 16,
              padding: '24px 32px', textAlign: 'center', opacity: pp,
              transform: `translateY(${(1-pp)*30}px)`, minWidth: 220,
            }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>{p.icon}</div>
              <div style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{p.text}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function VerifyScreen() {
  return (
    <div style={{ width: '100%', padding: 16, fontFamily: "'Inter', sans-serif", textAlign: 'center' }}>
      <div style={{ color: '#9CA3AF', fontSize: 11, marginBottom: 8 }}>Settlement Sam</div>
      <div style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Verify to unlock your estimate</div>
      <div style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid #00E676', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
        <div style={{ color: '#00E676', fontSize: 11, fontWeight: 600 }}>SMS Code: ••••••</div>
      </div>
      <div style={{ background: '#00E676', color: '#0A1628', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
        ✓ Verified
      </div>
    </div>
  );
}

function Scene4({ frame }: { frame: number }) {
  const lf = frame - S4;
  const headerP = sp(lf, 0);
  const phoneP  = sp(lf, 15);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 80, padding: 80 }}>
      <div>
        <div style={{ color: '#FFFFFF', fontSize: 26, fontWeight: 600, opacity: headerP, marginBottom: 24 }}>
          Here's what a Settlement Sam lead looks like:
        </div>
        <StatCard label="Injury Type" value="Spinal injury — surgery confirmed" delay={20} accent={GREEN} />
        <StatCard label="SMS Verified" value="✓ Phone confirmed" delay={30} accent={GREEN} />
        <StatCard label="Case value range" value="$75,000 – $200,000" delay={40} accent="#E8A838" />
        <div style={{ marginTop: 24, opacity: sp(lf, 60) }}>
          <CountUp from={0} to={800} prefix="" suffix="% ROI" delay={Math.max(0, lf - 65)} duration={50} fontSize={56} />
          <div style={{ color: '#9CA3AF', fontSize: 15, marginTop: 6 }}>on your first batch</div>
        </div>
      </div>
      <div style={{ opacity: phoneP, transform: `scale(${0.85 + 0.15*phoneP})` }}>
        <PhoneMockup screenContent={<VerifyScreen />} delay={15} />
      </div>
    </AbsoluteFill>
  );
}

function Scene5({ frame }: { frame: number }) {
  const lf = frame - S5;
  const p1 = sp(lf, 0);
  const p2 = sp(lf, 20);

  // Light up states one by one
  const states = ['CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI'];
  const statePositions: Record<string, [number, number]> = {
    CA: [12, 55], TX: [38, 70], FL: [68, 75], NY: [80, 30], PA: [77, 38],
    IL: [60, 42], OH: [70, 40], GA: [67, 62], NC: [73, 55], MI: [65, 33],
  };

  const lit = Math.min(states.length, Math.floor(lf / 8));

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 60 }}>
      <div style={{ color: '#FFFFFF', fontSize: 32, fontWeight: 700, textAlign: 'center', opacity: p1, marginBottom: 8 }}>
        We operate first-come, first-served by geography.
      </div>
      <div style={{ color: '#EF4444', fontSize: 22, textAlign: 'center', opacity: p2, marginBottom: 32 }}>
        When your state fills, it's closed.
      </div>

      {/* Simple US map placeholder with state dots */}
      <div style={{ position: 'relative', width: 600, height: 300, background: '#0F1E35', borderRadius: 16, border: '1px solid #1A2A3A', overflow: 'hidden' }}>
        <div style={{ color: '#1A2A3A', fontSize: 13, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', lineHeight: 1.5 }}>
          United States
        </div>
        {states.slice(0, lit).map((state, i) => {
          const [x, y] = statePositions[state];
          const dotP = sp(lf, i * 8);
          return (
            <div key={state} style={{
              position: 'absolute',
              left: `${x}%`, top: `${y}%`,
              transform: 'translate(-50%,-50%)',
              width: 28, height: 28,
              background: GREEN,
              borderRadius: '50%',
              opacity: dotP,
              boxShadow: `0 0 12px ${GREEN}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: '#0A1628' }}>{state}</span>
            </div>
          );
        })}
      </div>
      <div style={{ color: GREEN, fontSize: 18, marginTop: 20, opacity: sp(lf, 60) }}>
        {lit} states currently open
      </div>
    </AbsoluteFill>
  );
}

function Scene6({ frame }: { frame: number }) {
  const lf = frame - S6;
  const logoP = sp(lf, 0);
  const line1P = sp(lf, 15);
  const ctaP   = sp(lf, 35);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ color: '#FFFFFF', fontSize: 54, fontWeight: 900, opacity: logoP, transform: `scale(${0.85 + 0.15*logoP})`, textAlign: 'center', marginBottom: 24 }}>
        Settlement Sam
      </div>
      <div style={{ color: '#9CA3AF', fontSize: 20, textAlign: 'center', opacity: line1P, marginBottom: 32 }}>
        25-lead minimum. No contracts. Replace any bad lead.
      </div>
      <div style={{
        background: GREEN, color: '#0A1628', padding: '18px 48px',
        borderRadius: 60, fontSize: 22, fontWeight: 800,
        opacity: ctaP, transform: `scale(${0.85 + 0.15 * ctaP})`,
        boxShadow: `0 0 32px rgba(0,230,118,${0.4 * ctaP})`,
        marginBottom: 20,
      }}>
        Secure Your Territory →
      </div>
      <div style={{ color: '#6B7280', fontSize: 16, opacity: ctaP }}>settlementsam.com/attorneys</div>
    </AbsoluteFill>
  );
}

export const FullPitch: React.FC = () => {
  const frame = useCurrentFrame();

  let audioEl: React.ReactNode = null;
  try { audioEl = <Audio src={staticFile('audio/full-pitch.mp3')} />; } catch { /* no audio */ }

  const fade = (s: number, e: number) =>
    interpolate(frame, [s, s + 8, e - 8, e], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      {audioEl}
      <ProgressBar />
      {frame < S2 + 8  && <div style={{ opacity: fade(S1, S2 + 8),  position: 'absolute', inset: 0 }}><Scene1 frame={frame} /></div>}
      {frame >= S2 - 8 && frame < S3 + 8 && <div style={{ opacity: fade(S2, S3 + 8), position: 'absolute', inset: 0 }}><Scene2 frame={frame} /></div>}
      {frame >= S3 - 8 && frame < S4 + 8 && <div style={{ opacity: fade(S3, S4 + 8), position: 'absolute', inset: 0 }}><Scene3 frame={frame} /></div>}
      {frame >= S4 - 8 && frame < S5 + 8 && <div style={{ opacity: fade(S4, S5 + 8), position: 'absolute', inset: 0 }}><Scene4 frame={frame} /></div>}
      {frame >= S5 - 8 && frame < S6 + 8 && <div style={{ opacity: fade(S5, S6 + 8), position: 'absolute', inset: 0 }}><Scene5 frame={frame} /></div>}
      {frame >= S6 - 8 && <div style={{ opacity: fade(S6, TOTAL), position: 'absolute', inset: 0 }}><Scene6 frame={frame} /></div>}
    </AbsoluteFill>
  );
};
