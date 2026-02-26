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
import { SlamText } from '../components/SlamText';
import { ProgressBar } from '../components/ProgressBar';
import { FlashOverlay } from '../components/FlashOverlay';

const BG     = '#0A1628';
const AMBER  = '#E8A838';
const FOREST = '#4A7C59';
const RED    = '#C0392B';
const FPS    = 30;

const S1 = 0;
const S2 = 5  * FPS;
const S3 = 15 * FPS;
const S4 = 30 * FPS;
const S5 = 40 * FPS;
const TOTAL = 45 * FPS;

function sp(frame: number, delay: number = 0, stiffness = 300) {
  return spring({ frame: frame - delay, fps: FPS, config: { stiffness, damping: 18, mass: 0.9 }, durationInFrames: 22 });
}

// ── Scene 1: Title ────────────────────────────────────────────────────────────
const Scene1: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S1;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 120 }}>
      <div style={{ textAlign: 'center' }}>
        <SlamText
          text="Understand The Unit Economics"
          direction="down"
          delay={10}
          style={{ color: '#FFFFFF', fontSize: 52, fontWeight: 900, display: 'block', lineHeight: 1.2, marginBottom: 8 }}
        />
        <SlamText
          text="of a $250 Lead."
          direction="up"
          delay={22}
          style={{ color: AMBER, fontSize: 52, fontWeight: 900, display: 'block', lineHeight: 1.2, marginBottom: 24 }}
        />
        <div style={{ color: '#9CA3AF', fontSize: 22, opacity: sp(lf, 40), transform: `translateY(${(1 - sp(lf, 40)) * 20}px)` }}>
          The math most attorneys have never been shown.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Drawing arrow ─────────────────────────────────────────────────────────────
const DrawArrow: React.FC<{ delay: number; frame: number }> = ({ delay, frame }) => {
  const p = sp(frame, delay);
  const h = interpolate(p, [0, 1], [0, 48], { extrapolateRight: 'clamp' });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '6px 0' }}>
      <div style={{ width: 3, height: h, background: `linear-gradient(${AMBER}, ${FOREST})`, borderRadius: 2 }} />
      <div style={{ color: AMBER, fontSize: 18, opacity: p }}>▼</div>
    </div>
  );
};

// ── Scene 2: Flowchart ────────────────────────────────────────────────────────
const Scene2: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S2;

  const Box = ({ value, color, delay, note }: { value: string; color: string; delay: number; note?: string }) => {
    const p = sp(lf, delay, 400);
    return (
      <div style={{
        opacity: Math.min(1, p * 1.5),
        transform: `translateX(${(1 - p) * (delay % 2 === 0 ? -50 : 50)}px)`,
        background: '#0F1E35', border: `2px solid ${color}`, borderRadius: 14,
        padding: '14px 40px', textAlign: 'center', minWidth: 360,
      }}>
        {note && <div style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 4 }}>{note}</div>}
        <div style={{ color, fontSize: 26, fontWeight: 800 }}>{value}</div>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <Box value="25 Leads × $250" color={AMBER} delay={0} />
      <DrawArrow delay={14} frame={lf} />
      <Box value="$6,250 Investment" color={AMBER} delay={18} note="Your total cost" />
      <DrawArrow delay={32} frame={lf} />
      <div style={{ color: '#9CA3AF', fontSize: 17, opacity: sp(lf, 36), marginBottom: 6 }}>
        At 4% Conversion Rate (Conservative Avg)
      </div>
      <DrawArrow delay={46} frame={lf} />
      <Box value="1 Signed Case" color={FOREST} delay={50} />
    </AbsoluteFill>
  );
};

// ── Scene 3: 800% ROI fills screen ────────────────────────────────────────────
const Scene3: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S3;
  const p1 = sp(lf, 0);
  const roiDelay = 35;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <FlashOverlay triggerFrame={S3 + roiDelay} color={AMBER} duration={8} opacity={0.32} />

      <div style={{
        background: '#0F1E35', border: `2px solid ${FOREST}`, borderRadius: 16,
        padding: '20px 56px', textAlign: 'center',
        opacity: p1, transform: `scale(${0.85 + 0.15 * p1})`,
        boxShadow: `0 0 40px rgba(74,124,89,${0.25 * p1})`,
        marginBottom: 32,
      }}>
        <div style={{ color: '#9CA3AF', fontSize: 15, marginBottom: 6 }}>Average PI Case Value</div>
        <div style={{ color: FOREST, fontSize: 44, fontWeight: 900 }}>$50,000+</div>
      </div>

      <div style={{ opacity: sp(lf, roiDelay) }}>
        <CountUp
          from={0} to={800} suffix="% ROI"
          delay={Math.max(0, lf - roiDelay)} duration={40}
          fontSize={120} color={AMBER}
        />
      </div>
      <div style={{ color: '#9CA3AF', fontSize: 16, marginTop: 10, opacity: sp(lf, roiDelay + 15) }}>
        On your very first batch of 25 leads
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 4: Side-by-side comparison ─────────────────────────────────────────
const Scene4: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S4;

  const Col = ({ title, items, accent, inDelay, dir }: { title: string; items: string[]; accent: string; inDelay: number; dir: number }) => {
    const p = sp(lf, inDelay, 350);
    return (
      <div style={{ flex: 1, padding: '0 28px', opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * dir * 60}px)` }}>
        <div style={{ color: accent, fontSize: 22, fontWeight: 800, marginBottom: 18, textAlign: 'center' }}>{title}</div>
        {items.map((item, i) => (
          <div key={i} style={{ color: '#CBD5E1', fontSize: 15, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10 }}>
            <span style={{ color: accent, fontWeight: 700 }}>{accent === FOREST ? '✓' : '✗'}</span> {item}
          </div>
        ))}
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', width: '85%', gap: 0 }}>
        <Col title="✗ Traditional Agency" items={['$3,000/month retainer', '6–12 month contracts', 'No performance guarantee', 'Shared leads — 5+ firms', 'You own nothing']} accent={RED} inDelay={0} dir={-1} />
        <div style={{ width: 2, background: 'rgba(232,168,56,0.2)', alignSelf: 'stretch', margin: '0 8px' }} />
        <Col title="✓ Settlement Sam" items={['Fixed cost per batch', 'No monthly fees', '90-day lead exclusivity', 'Your leads only', 'You own the data']} accent={FOREST} inDelay={15} dir={1} />
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 5: Close ────────────────────────────────────────────────────────────
const Scene5: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S5;
  const p1 = sp(lf, 0);
  const p2 = sp(lf, 18);
  const p3 = sp(lf, 36);
  const pulse = Math.sin(lf * 0.18) * 0.5 + 0.5;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ color: '#FFFFFF', fontSize: 34, fontWeight: 800, textAlign: 'center', opacity: p1, transform: `translateY(${(1 - p1) * 20}px)`, marginBottom: 10 }}>
        One signed case from 25 leads
      </div>
      <div style={{ color: AMBER, fontSize: 28, fontWeight: 700, textAlign: 'center', opacity: p2, transform: `translateY(${(1 - p2) * 20}px)`, marginBottom: 36 }}>
        covers your investment 8 times over.
      </div>
      <div style={{
        background: FOREST, color: '#FFFFFF', padding: '18px 48px',
        borderRadius: 50, fontSize: 20, fontWeight: 800,
        opacity: p3, transform: `scale(${0.8 + 0.2 * p3})`,
        boxShadow: `0 0 ${24 + 14 * pulse}px rgba(74,124,89,${0.45 + 0.25 * pulse})`,
      }}>
        Secure your geography →
      </div>
    </AbsoluteFill>
  );
};

// ── Root ──────────────────────────────────────────────────────────────────────
export const ROIBreakdown: React.FC = () => {
  const frame = useCurrentFrame();

  let audioEl: React.ReactNode = null;
  try { audioEl = <Audio src={staticFile('audio/roi-breakdown.mp3')} />; } catch { /* no audio */ }

  const fade = (s: number, e: number) =>
    interpolate(frame, [s, s + 10, e - 10, e], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      {audioEl}
      <ProgressBar />
      {frame < S2 + 10 && <div style={{ opacity: fade(S1, S2 + 10), position: 'absolute', inset: 0 }}><Scene1 frame={frame} /></div>}
      {frame >= S2 - 10 && frame < S3 + 10 && <div style={{ opacity: fade(S2, S3 + 10), position: 'absolute', inset: 0 }}><Scene2 frame={frame} /></div>}
      {frame >= S3 - 10 && frame < S4 + 10 && <div style={{ opacity: fade(S3, S4 + 10), position: 'absolute', inset: 0 }}><Scene3 frame={frame} /></div>}
      {frame >= S4 - 10 && frame < S5 + 10 && <div style={{ opacity: fade(S4, S5 + 10), position: 'absolute', inset: 0 }}><Scene4 frame={frame} /></div>}
      {frame >= S5 - 10 && <div style={{ opacity: fade(S5, TOTAL), position: 'absolute', inset: 0 }}><Scene5 frame={frame} /></div>}
    </AbsoluteFill>
  );
};
