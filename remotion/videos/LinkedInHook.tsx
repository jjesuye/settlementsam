import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Audio,
  staticFile,
  AbsoluteFill,
  Sequence,
} from 'remotion';
import { AnimatedText } from '../components/AnimatedText';
import { CountUp } from '../components/CountUp';
import { StatCard } from '../components/StatCard';
import { ProgressBar } from '../components/ProgressBar';

const BG = '#0A1628';
const GREEN = '#00E676';
const AMBER = '#E8A838';
const FPS = 30;

// Scene boundaries in frames
const S1_START = 0;
const S2_START = 3 * FPS;
const S3_START = 8 * FPS;
const S4_START = 16 * FPS;
const S5_START = 24 * FPS;
const TOTAL = 30 * FPS;

function Scene1({ frame }: { frame: number }) {
  const titleProgress = spring({ frame, fps: FPS, config: { damping: 14, stiffness: 80 }, durationInFrames: 25 });
  const line2Progress = spring({ frame: frame - 20, fps: FPS, config: { damping: 14, stiffness: 80 }, durationInFrames: 25 });
  const underlineW = interpolate(Math.max(0, frame - 40), [0, 25], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#FFFFFF', fontSize: 56, fontWeight: 800, opacity: titleProgress, transform: `translateY(${(1 - titleProgress) * 20}px)` }}>
          You don't want leads.
        </div>
        <div style={{ marginTop: 16, position: 'relative', display: 'inline-block', opacity: line2Progress, transform: `translateY(${(1 - line2Progress) * 20}px)` }}>
          <span style={{ color: '#FFFFFF', fontSize: 56, fontWeight: 800 }}>You want </span>
          <span style={{ color: GREEN, fontSize: 56, fontWeight: 800 }}>retainers.</span>
          <div style={{
            position: 'absolute', bottom: -6, left: '50%',
            width: `${underlineW * 100}%`, height: 4,
            background: GREEN, transform: 'translateX(-50%)', borderRadius: 2,
          }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Scene2({ frame }: { frame: number }) {
  const localFrame = frame - S2_START;
  const headerProgress = spring({ frame: localFrame, fps: FPS, config: { damping: 14 }, durationInFrames: 20 });

  const cards = [
    { label: 'Monthly cost', value: '$3,000/month retainer' },
    { label: 'Ownership', value: 'You own nothing' },
    { label: 'Lead type', value: 'Shared leads' },
    { label: 'Guarantee', value: 'No ROI guarantee' },
  ];

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 60 }}>
      <div style={{ color: '#EF4444', fontSize: 28, fontWeight: 700, marginBottom: 24, opacity: headerProgress, transform: `translateY(${(1 - headerProgress) * 20}px)` }}>
        The Old Way
      </div>
      <div>
        {cards.map((c, i) => (
          <StatCard key={i} label={c.label} value={c.value} delay={i * 15} accent="#EF4444" />
        ))}
      </div>
    </AbsoluteFill>
  );
}

function Scene3({ frame }: { frame: number }) {
  const localFrame = frame - S3_START;
  const headerProgress = spring({ frame: localFrame, fps: FPS, config: { damping: 14 }, durationInFrames: 20 });

  const cards = [
    { label: 'Leads per batch', value: '25 SMS-verified leads' },
    { label: 'Exclusivity', value: '90-day exclusivity' },
    { label: 'Ownership', value: 'You own the data' },
    { label: 'Pricing', value: 'Fixed cost. Predictable ROI.' },
  ];

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 60 }}>
      <div style={{ color: GREEN, fontSize: 28, fontWeight: 700, marginBottom: 24, opacity: headerProgress, transform: `translateY(${(1 - headerProgress) * 20}px)` }}>
        The Settlement Sam Way
      </div>
      <div>
        {cards.map((c, i) => (
          <StatCard key={i} label={c.label} value={c.value} delay={i * 15} accent={GREEN} />
        ))}
      </div>
    </AbsoluteFill>
  );
}

function Scene4({ frame }: { frame: number }) {
  const localFrame = frame - S4_START;
  const line1 = spring({ frame: localFrame, fps: FPS, config: { damping: 14 }, durationInFrames: 20 });
  const line2 = spring({ frame: localFrame - 20, fps: FPS, config: { damping: 14 }, durationInFrames: 20 });
  const line3 = spring({ frame: localFrame - 40, fps: FPS, config: { damping: 14 }, durationInFrames: 20 });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 80 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#FFFFFF', fontSize: 28, fontWeight: 600, opacity: line1, transform: `translateY(${(1 - line1) * 20}px)`, marginBottom: 12 }}>
          25 leads × $250 = <span style={{ color: AMBER }}>$6,250 invested</span>
        </div>
        <div style={{ color: GREEN, fontSize: 28, opacity: line2, marginBottom: 12 }}>↓</div>
        <div style={{ color: '#FFFFFF', fontSize: 28, fontWeight: 600, opacity: line2, transform: `translateY(${(1 - line2) * 20}px)`, marginBottom: 12 }}>
          4% conversion = <span style={{ color: GREEN }}>1 signed case</span>
        </div>
        <div style={{ color: GREEN, fontSize: 28, opacity: line3 }}>↓</div>
        <div style={{ opacity: line3, transform: `translateY(${(1 - line3) * 20}px)`, marginTop: 8 }}>
          <CountUp from={0} to={800} suffix="% ROI" delay={Math.max(0, localFrame - 50)} duration={50} fontSize={80} />
        </div>
        <div style={{ color: '#9CA3AF', fontSize: 18, marginTop: 12, opacity: line3 }}>
          One case covers the batch 8x over.
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Scene5({ frame }: { frame: number }) {
  const localFrame = frame - S5_START;
  const logoP = spring({ frame: localFrame, fps: FPS, config: { damping: 14 }, durationInFrames: 20 });
  const line1P = spring({ frame: localFrame - 15, fps: FPS, config: { damping: 14 }, durationInFrames: 20 });
  const line2P = spring({ frame: localFrame - 30, fps: FPS, config: { damping: 14 }, durationInFrames: 20 });
  const urlP   = spring({ frame: localFrame - 45, fps: FPS, config: { damping: 14 }, durationInFrames: 20 });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#FFFFFF', fontSize: 36, fontWeight: 800, opacity: logoP, transform: `scale(${0.8 + 0.2 * logoP})`, marginBottom: 24 }}>
          Settlement Sam
        </div>
        <div style={{ color: '#FFFFFF', fontSize: 28, fontWeight: 600, opacity: line1P, transform: `translateY(${(1 - line1P) * 20}px)`, marginBottom: 8 }}>
          Stop paying for effort.
        </div>
        <div style={{ color: GREEN, fontSize: 28, fontWeight: 700, opacity: line2P, transform: `translateY(${(1 - line2P) * 20}px)`, marginBottom: 24 }}>
          Start paying for outcomes.
        </div>
        <div style={{ color: '#9CA3AF', fontSize: 18, opacity: urlP }}>
          settlementsam.com/attorneys
        </div>
      </div>
    </AbsoluteFill>
  );
}

export const LinkedInHook: React.FC = () => {
  const frame = useCurrentFrame();

  // Audio — optional
  let audioEl: React.ReactNode = null;
  try {
    audioEl = <Audio src={staticFile('audio/linkedin-hook.mp3')} />;
  } catch { /* no audio file */ }

  const sceneOpacity = (start: number, end: number) =>
    interpolate(frame, [start, start + 5, end - 5, end], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      {audioEl}
      <ProgressBar />

      {frame < S2_START + 5 && (
        <div style={{ opacity: sceneOpacity(S1_START, S2_START + 5), position: 'absolute', inset: 0 }}>
          <Scene1 frame={frame} />
        </div>
      )}
      {frame >= S2_START - 5 && frame < S3_START + 5 && (
        <div style={{ opacity: sceneOpacity(S2_START, S3_START + 5), position: 'absolute', inset: 0 }}>
          <Scene2 frame={frame} />
        </div>
      )}
      {frame >= S3_START - 5 && frame < S4_START + 5 && (
        <div style={{ opacity: sceneOpacity(S3_START, S4_START + 5), position: 'absolute', inset: 0 }}>
          <Scene3 frame={frame} />
        </div>
      )}
      {frame >= S4_START - 5 && frame < S5_START + 5 && (
        <div style={{ opacity: sceneOpacity(S4_START, S5_START + 5), position: 'absolute', inset: 0 }}>
          <Scene4 frame={frame} />
        </div>
      )}
      {frame >= S5_START - 5 && (
        <div style={{ opacity: sceneOpacity(S5_START, TOTAL), position: 'absolute', inset: 0 }}>
          <Scene5 frame={frame} />
        </div>
      )}
    </AbsoluteFill>
  );
};
