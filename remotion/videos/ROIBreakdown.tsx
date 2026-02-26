import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Audio,
  staticFile,
  AbsoluteFill,
} from 'remotion';
import { CountUp } from '../components/CountUp';
import { ProgressBar } from '../components/ProgressBar';

const BG = '#0A1628';
const GREEN = '#00E676';
const AMBER = '#E8A838';
const FPS = 30;

const S1 = 0;
const S2 = 5  * FPS;
const S3 = 15 * FPS;
const S4 = 30 * FPS;
const S5 = 40 * FPS;
const TOTAL = 45 * FPS;

function sp(frame: number, delay: number) {
  return spring({ frame: frame - delay, fps: FPS, config: { damping: 14, stiffness: 100 }, durationInFrames: 22 });
}

function Scene1({ frame }: { frame: number }) {
  const lf = frame - S1;
  const p1 = sp(lf, 0);
  const p2 = sp(lf, 20);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 80 }}>
      <div style={{ color: '#FFFFFF', fontSize: 52, fontWeight: 800, textAlign: 'center', opacity: p1, transform: `translateY(${(1-p1)*20}px)`, lineHeight: 1.2 }}>
        Understand The Unit Economics<br />of a $250 Lead.
      </div>
      <div style={{ color: '#9CA3AF', fontSize: 24, textAlign: 'center', marginTop: 20, opacity: p2, transform: `translateY(${(1-p2)*20}px)` }}>
        The math most attorneys have never been shown.
      </div>
    </AbsoluteFill>
  );
}

function FlowBox({ label, value, color = '#FFFFFF', delay, frame }: { label?: string; value: string; color?: string; delay: number; frame: number }) {
  const p = sp(frame, delay);
  return (
    <div style={{ opacity: p, transform: `translateY(${(1-p)*20}px)`, background: '#0F1E35', border: `2px solid ${color}`, borderRadius: 12, padding: '16px 32px', textAlign: 'center', minWidth: 320 }}>
      {label && <div style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 4 }}>{label}</div>}
      <div style={{ color, fontSize: 26, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Arrow({ delay, frame }: { delay: number; frame: number }) {
  const p = sp(frame, delay);
  const h = interpolate(p, [0, 1], [0, 40], { extrapolateRight: 'clamp' });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '8px 0' }}>
      <div style={{ width: 3, height: h, background: GREEN, borderRadius: 2 }} />
      <div style={{ color: GREEN, fontSize: 20, opacity: p }}>▼</div>
    </div>
  );
}

function Scene2({ frame }: { frame: number }) {
  const lf = frame - S2;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <FlowBox value="25 Leads × $250" delay={0} frame={lf} />
      <Arrow delay={15} frame={lf} />
      <FlowBox value="$6,250 Investment" color={AMBER} delay={20} frame={lf} />
      <Arrow delay={35} frame={lf} />
      <div style={{ opacity: sp(lf, 40), color: '#9CA3AF', fontSize: 18, textAlign: 'center', marginBottom: 8 }}>At 4% Conversion Rate (Conservative Avg)</div>
      <Arrow delay={50} frame={lf} />
      <FlowBox value="1 Signed Case" color={GREEN} delay={55} frame={lf} />
    </AbsoluteFill>
  );
}

function Scene3({ frame }: { frame: number }) {
  const lf = frame - S3;
  const p1 = sp(lf, 0);
  const p2 = sp(lf, 30);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{
        background: '#0F1E35', border: `3px solid ${GREEN}`, borderRadius: 16, padding: '24px 48px',
        textAlign: 'center', opacity: p1, transform: `scale(${0.85 + 0.15*p1})`,
        boxShadow: `0 0 40px rgba(0,230,118,${0.3 * p1})`,
      }}>
        <div style={{ color: '#9CA3AF', fontSize: 16, marginBottom: 8 }}>Average PI Case Value</div>
        <div style={{ color: GREEN, fontSize: 42, fontWeight: 800 }}>$50,000+</div>
      </div>
      <div style={{ marginTop: 32, opacity: p2 }}>
        <CountUp from={0} to={800} suffix="% ROI" delay={Math.max(0, lf - 35)} duration={60} fontSize={96} />
        <div style={{ color: '#6B7280', fontSize: 14, textAlign: 'center', marginTop: 8 }}>↑ on your first batch</div>
      </div>
    </AbsoluteFill>
  );
}

function ComparisonCol({ title, items, accent, frame, delay }: { title: string; items: string[]; accent: string; frame: number; delay: number }) {
  const p = sp(frame, delay);
  return (
    <div style={{ opacity: p, transform: `translateX(${(1-p)*(accent === GREEN ? 40 : -40)}px)`, flex: 1, padding: '0 24px' }}>
      <div style={{ color: accent, fontSize: 22, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>{title}</div>
      {items.map((item, i) => (
        <div key={i} style={{ color: '#9CA3AF', fontSize: 16, padding: '8px 0', borderBottom: '1px solid #1A2A3A', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: accent, fontSize: 12 }}>{accent === GREEN ? '✓' : '✗'}</span> {item}
        </div>
      ))}
    </div>
  );
}

function Scene4({ frame }: { frame: number }) {
  const lf = frame - S4;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', width: '80%', gap: 40 }}>
        <ComparisonCol
          title="Traditional Agency"
          items={['$3,000/month retainer', '6-12 month contract', 'No performance guarantee', 'You own nothing']}
          accent="#EF4444"
          frame={lf}
          delay={0}
        />
        <div style={{ width: 2, background: '#1A2A3A', alignSelf: 'stretch' }} />
        <ComparisonCol
          title="Settlement Sam"
          items={['Fixed cost per case', 'No monthly fees', '90-day lead exclusivity', 'You own the data']}
          accent={GREEN}
          frame={lf}
          delay={15}
        />
      </div>
    </AbsoluteFill>
  );
}

function Scene5({ frame }: { frame: number }) {
  const lf = frame - S5;
  const p1 = sp(lf, 0);
  const p2 = sp(lf, 20);
  const p3 = sp(lf, 40);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ color: '#FFFFFF', fontSize: 32, fontWeight: 700, textAlign: 'center', opacity: p1, transform: `translateY(${(1-p1)*20}px)` }}>
        One signed case from 25 leads
      </div>
      <div style={{ color: GREEN, fontSize: 28, fontWeight: 600, textAlign: 'center', marginTop: 12, opacity: p2, transform: `translateY(${(1-p2)*20}px)` }}>
        Covers your entire investment 8 times over.
      </div>
      <div style={{ marginTop: 32, background: GREEN, color: '#0A1628', padding: '16px 40px', borderRadius: 50, fontSize: 20, fontWeight: 700, opacity: p3, transform: `scale(${0.8 + 0.2 * p3})` }}>
        Secure your geography →
      </div>
    </AbsoluteFill>
  );
}

export const ROIBreakdown: React.FC = () => {
  const frame = useCurrentFrame();

  let audioEl: React.ReactNode = null;
  try { audioEl = <Audio src={staticFile('audio/roi-breakdown.mp3')} />; } catch { /* no audio */ }

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
      {frame >= S5 - 8 && <div style={{ opacity: fade(S5, TOTAL), position: 'absolute', inset: 0 }}><Scene5 frame={frame} /></div>}
    </AbsoluteFill>
  );
};
