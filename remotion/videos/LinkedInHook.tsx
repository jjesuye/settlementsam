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
import { SlamText } from '../components/SlamText';
import { CountUp } from '../components/CountUp';
import { StatCard } from '../components/StatCard';
import { ProgressBar } from '../components/ProgressBar';
import { FlashOverlay } from '../components/FlashOverlay';

// ── Brand palette ─────────────────────────────────────────────────────────────
const BG     = '#0A1628';
const AMBER  = '#E8A838';
const FOREST = '#4A7C59';
const RED    = '#C0392B';
const FPS    = 30;

// ── Scene boundaries (frames) ─────────────────────────────────────────────────
const OPEN_END  = 90;    // 3s — opening hook
const S2_START  = 90;
const S2_END    = 240;   // 8s
const S3_START  = 240;
const S3_END    = 480;   // 16s
const S4_START  = 480;
const S4_END    = 720;   // 24s
const S5_START  = 720;
const TOTAL     = 900;   // 30s

// ── Grid background ──────────────────────────────────────────────────────────
const GridBg: React.FC<{ frame: number }> = ({ frame }) => {
  const scale = interpolate(frame, [0, TOTAL], [1, 1.18], { extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      backgroundImage:
        'linear-gradient(rgba(232,168,56,0.04) 1px, transparent 1px),' +
        'linear-gradient(90deg, rgba(232,168,56,0.04) 1px, transparent 1px)',
      backgroundSize: '60px 60px',
      transform: `scale(${scale})`,
    }} />
  );
};

// ── Opening hook (0-90f) ──────────────────────────────────────────────────────
const OpeningHook: React.FC<{ frame: number }> = ({ frame }) => {
  // 0-15f: black
  // 15-45f: STOP. slams in
  // 45-75f: "Paying for leads." wipes in
  // 75-90f: red X slashes through
  const stopProgress = spring({ frame: frame - 15, fps: FPS, config: { stiffness: 500, damping: 16 }, durationInFrames: 18 });
  const line2Progress = spring({ frame: frame - 45, fps: FPS, config: { stiffness: 400, damping: 15 }, durationInFrames: 18 });
  const xProgress = spring({ frame: frame - 75, fps: FPS, config: { stiffness: 600, damping: 14 }, durationInFrames: 12 });
  const xWidth = interpolate(xProgress, [0, 1], [0, 110], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', background: '#000000', flexDirection: 'column' }}>
      <div style={{
        color: '#FFFFFF', fontSize: 120, fontWeight: 900, letterSpacing: '-0.03em',
        opacity: stopProgress, transform: `scale(${0.6 + 0.4 * stopProgress}) translateY(${(1 - stopProgress) * -60}px)`,
      }}>
        STOP.
      </div>
      <div style={{ position: 'relative', marginTop: 8 }}>
        <div style={{
          color: '#CBD5E1', fontSize: 44, fontWeight: 700,
          opacity: line2Progress, transform: `translateY(${(1 - line2Progress) * 30}px)`,
        }}>
          Paying for leads.
        </div>
        {/* Red slash */}
        <div style={{
          position: 'absolute', top: '52%', left: -10,
          width: xWidth, height: 5, background: RED,
          transform: 'rotate(-3deg)', borderRadius: 3,
        }} />
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: Old Way (90-240f) ────────────────────────────────────────────────
const OldWay: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S2_START;
  const header = spring({ frame: lf, fps: FPS, config: { stiffness: 300, damping: 18 }, durationInFrames: 20 });

  const cards = [
    { label: 'Monthly cost', value: '$3,000/month retainer' },
    { label: 'Lead type', value: 'Shared with 5+ firms' },
    { label: 'Ownership', value: 'You own nothing' },
    { label: 'Guarantee', value: 'Zero ROI guarantee' },
  ];

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ color: RED, fontSize: 32, fontWeight: 800, marginBottom: 20, opacity: header, transform: `translateY(${(1 - header) * -20}px)`, letterSpacing: '-0.01em' }}>
        ✗ The Old Way
      </div>
      {cards.map((c, i) => (
        <StatCard key={i} label={c.label} value={c.value} delay={i * 12 + 10} accent={RED} />
      ))}
    </AbsoluteFill>
  );
};

// ── Scene 3: Settlement Sam Way (240-480f) ────────────────────────────────────
const SamWay: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S3_START;
  const header = spring({ frame: lf, fps: FPS, config: { stiffness: 300, damping: 18 }, durationInFrames: 20 });

  const cards = [
    { label: 'Leads per batch', value: '25 SMS-verified leads' },
    { label: 'Exclusivity', value: '90-day exclusive rights' },
    { label: 'Ownership', value: 'You own the data' },
    { label: 'Pricing', value: 'Fixed cost. Predictable ROI.' },
  ];

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ color: AMBER, fontSize: 32, fontWeight: 800, marginBottom: 20, opacity: header, transform: `translateY(${(1 - header) * -20}px)` }}>
        ✓ The Settlement Sam Way
      </div>
      {cards.map((c, i) => (
        <StatCard key={i} label={c.label} value={c.value} delay={i * 12 + 10} accent={FOREST} />
      ))}
    </AbsoluteFill>
  );
};

// ── Scene 4: The Math (480-720f) ─────────────────────────────────────────────
const TheMath: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S4_START;
  const p1 = spring({ frame: lf,      fps: FPS, config: { stiffness: 300, damping: 18 }, durationInFrames: 20 });
  const p2 = spring({ frame: lf - 25, fps: FPS, config: { stiffness: 300, damping: 18 }, durationInFrames: 20 });
  const p3 = spring({ frame: lf - 50, fps: FPS, config: { stiffness: 300, damping: 18 }, durationInFrames: 20 });

  // ROI number triggers at frame S4_START + 60
  const roiDelay = 60;
  const flashFrame = S4_START + roiDelay;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <FlashOverlay triggerFrame={flashFrame} color={AMBER} duration={6} opacity={0.28} />

      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#CBD5E1', fontSize: 28, fontWeight: 600, opacity: p1, transform: `translateY(${(1 - p1) * 20}px)`, marginBottom: 12 }}>
          25 leads × $250 = <span style={{ color: AMBER, fontWeight: 800 }}>$6,250</span>
        </div>
        <div style={{ color: AMBER, fontSize: 28, opacity: p2, marginBottom: 8 }}>↓</div>
        <div style={{ color: '#CBD5E1', fontSize: 26, fontWeight: 600, opacity: p2, transform: `translateY(${(1 - p2) * 20}px)`, marginBottom: 16 }}>
          4% conversion = <span style={{ color: FOREST, fontWeight: 800 }}>1 signed case</span>
        </div>
        <div style={{ color: AMBER, fontSize: 28, opacity: p3, marginBottom: 12 }}>↓</div>
        <div style={{ opacity: p3, transform: `translateY(${(1 - p3) * 20}px)` }}>
          <CountUp from={0} to={800} suffix="% ROI" delay={Math.max(0, lf - roiDelay)} duration={40} fontSize={180} color={AMBER} />
        </div>
        <div style={{ color: '#9CA3AF', fontSize: 18, marginTop: 8, opacity: p3 }}>
          One case covers the batch 8× over.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 5: CTA (720-900f) ───────────────────────────────────────────────────
const CTA: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S5_START;
  const logoP = spring({ frame: lf,      fps: FPS, config: { stiffness: 300, damping: 18 }, durationInFrames: 22 });
  const line1P = spring({ frame: lf - 18, fps: FPS, config: { stiffness: 300, damping: 18 }, durationInFrames: 20 });
  const line2P = spring({ frame: lf - 34, fps: FPS, config: { stiffness: 300, damping: 18 }, durationInFrames: 20 });
  const urlP   = spring({ frame: lf - 52, fps: FPS, config: { stiffness: 300, damping: 18 }, durationInFrames: 20 });

  // Pulsing glow on CTA
  const pulse = Math.sin(lf * 0.15) * 0.5 + 0.5;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      {/* Sam avatar text-based */}
      <div style={{ opacity: logoP, transform: `scale(${0.7 + 0.3 * logoP})`, marginBottom: 20, textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          border: `3px solid ${AMBER}`, background: '#0F1E35',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px',
          boxShadow: `0 0 ${20 + 10 * pulse}px rgba(232,168,56,${0.3 + 0.2 * pulse})`,
        }}>
          <span style={{ fontSize: 32 }}>⚖️</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>
          <span style={{ color: '#FFFFFF' }}>Settlement</span>
          <span style={{ color: AMBER }}> Sam</span>
        </div>
      </div>

      <div style={{ color: '#FFFFFF', fontSize: 28, fontWeight: 700, opacity: line1P, transform: `translateY(${(1 - line1P) * 20}px)`, marginBottom: 8, textAlign: 'center' }}>
        Stop paying for effort.
      </div>
      <div style={{ color: AMBER, fontSize: 28, fontWeight: 800, opacity: line2P, transform: `translateY(${(1 - line2P) * 20}px)`, marginBottom: 28, textAlign: 'center' }}>
        Start paying for outcomes.
      </div>
      <div style={{
        background: FOREST, color: '#FFFFFF', padding: '14px 36px',
        borderRadius: 50, fontSize: 18, fontWeight: 700,
        opacity: urlP, transform: `scale(${0.8 + 0.2 * urlP})`,
        boxShadow: `0 0 ${20 + 12 * pulse}px rgba(74,124,89,${0.4 + 0.2 * pulse})`,
      }}>
        settlementsam.com/attorneys
      </div>
    </AbsoluteFill>
  );
};

// ── Root composition ──────────────────────────────────────────────────────────
export const LinkedInHook: React.FC = () => {
  const frame = useCurrentFrame();

  let audioEl: React.ReactNode = null;
  try { audioEl = <Audio src={staticFile('audio/linkedin-hook.mp3')} />; } catch { /* no audio */ }

  const fade = (s: number, e: number) =>
    interpolate(frame, [s, s + 8, e - 8, e], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      {audioEl}
      <GridBg frame={frame} />
      <ProgressBar />

      {frame < OPEN_END + 8 && (
        <div style={{ opacity: fade(0, OPEN_END + 8), position: 'absolute', inset: 0 }}>
          <OpeningHook frame={frame} />
        </div>
      )}
      {frame >= S2_START - 8 && frame < S2_END + 8 && (
        <div style={{ opacity: fade(S2_START, S2_END + 8), position: 'absolute', inset: 0 }}>
          <OldWay frame={frame} />
        </div>
      )}
      {frame >= S3_START - 8 && frame < S3_END + 8 && (
        <div style={{ opacity: fade(S3_START, S3_END + 8), position: 'absolute', inset: 0 }}>
          <SamWay frame={frame} />
        </div>
      )}
      {frame >= S4_START - 8 && frame < S4_END + 8 && (
        <div style={{ opacity: fade(S4_START, S4_END + 8), position: 'absolute', inset: 0 }}>
          <TheMath frame={frame} />
        </div>
      )}
      {frame >= S5_START - 8 && (
        <div style={{ opacity: fade(S5_START, TOTAL), position: 'absolute', inset: 0 }}>
          <CTA frame={frame} />
        </div>
      )}
    </AbsoluteFill>
  );
};
