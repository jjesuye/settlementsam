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
import { FlashOverlay } from '../components/FlashOverlay';
import { SlamText } from '../components/SlamText';

const BG     = '#0A1628';
const AMBER  = '#E8A838';
const FOREST = '#4A7C59';
const FPS    = 30;

const S1 = 0;
const S2 = 5  * FPS;   // 5s
const S3 = 20 * FPS;   // 20s
const S4 = 40 * FPS;   // 40s
const S5 = 65 * FPS;   // 65s
const S6 = 80 * FPS;   // 80s
const TOTAL = 90 * FPS; // 90s

function sp(frame: number, delay: number = 0, stiffness = 300) {
  return spring({ frame: frame - delay, fps: FPS, config: { stiffness, damping: 18, mass: 0.9 }, durationInFrames: 22 });
}

// ── Scene 1: Black → white flash → stat → hook (0-5s) ─────────────────────────
const Scene1: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S1;

  // White flash: peaks at frame 45, gone by 60
  const flashAlpha = interpolate(lf, [30, 45, 60], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const stat1P = sp(lf, 60, 400);
  const stat2P = sp(lf, 90, 350);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: '#000000' }}>
      {/* White flash overlay */}
      {flashAlpha > 0 && (
        <AbsoluteFill style={{ background: '#FFFFFF', opacity: flashAlpha, zIndex: 10 }} />
      )}
      <div style={{ textAlign: 'center', padding: '0 100px', zIndex: 5 }}>
        <div style={{
          color: '#FFFFFF', fontSize: 48, fontWeight: 900, lineHeight: 1.25,
          opacity: Math.min(1, stat1P * 1.5), transform: `translateY(${(1 - stat1P) * 30}px)`,
          marginBottom: 20,
        }}>
          <span style={{ color: AMBER, fontSize: 80, display: 'block', marginBottom: 4 }}>97%</span>
          of PI leads never become cases.
        </div>
        <div style={{
          color: '#CBD5E1', fontSize: 28, fontWeight: 600,
          opacity: Math.min(1, stat2P * 1.5), transform: `translateY(${(1 - stat2P) * 20}px)`,
        }}>
          You've been paying for the <span style={{ color: AMBER }}>97%.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: Problem agitation (5-20s) ────────────────────────────────────────
const PROBLEM_STATS = [
  'The average PI firm spends $8,000/month on marketing',
  'Less than 3% of leads become signed cases',
  'Most leads are shared with 5+ competing firms',
  "You don't know what you're getting until it's too late",
];

const Scene2: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S2;
  if (!PROBLEM_STATS || PROBLEM_STATS.length === 0) return null;

  const segDur = Math.floor((S3 - S2) / PROBLEM_STATS.length);
  const idx = Math.min(PROBLEM_STATS.length - 1, Math.max(0, Math.floor(lf / segDur)));
  const segFrame = lf - idx * segDur;
  const p = sp(segFrame, 5, 400);
  const stat = PROBLEM_STATS[idx] ?? PROBLEM_STATS[0];

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        color: '#FFFFFF', fontSize: 42, fontWeight: 800, textAlign: 'center',
        maxWidth: 900, opacity: Math.min(1, p * 1.5),
        transform: `translateY(${(1 - p) * 30}px)`,
        lineHeight: 1.35, padding: '0 80px',
      }}>
        {stat}
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 3: Solution reveal (20-40s) ─────────────────────────────────────────
const PILLARS = [
  { icon: '🔒', text: 'SMS-Verified Humans Only' },
  { icon: '👤', text: 'Full Injury Profiles, Pre-Screened' },
  { icon: '⚡', text: 'Exclusive 90-Day Rights' },
];

const Scene3: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S3;
  if (!PILLARS || PILLARS.length === 0) return null;

  const logoP  = sp(lf, 0, 350);
  const subP   = sp(lf, 18);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ opacity: Math.min(1, logoP * 1.5), transform: `scale(${0.8 + 0.2 * logoP})`, marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 52, fontWeight: 900 }}>
          <span style={{ color: '#FFFFFF' }}>Settlement</span>
          <span style={{ color: AMBER }}> Sam</span>
        </div>
      </div>
      <div style={{ color: '#9CA3AF', fontSize: 22, opacity: Math.min(1, subP * 1.5), marginBottom: 36 }}>
        Introducing a different model.
      </div>
      <div style={{ display: 'flex', gap: 28 }}>
        {PILLARS.map((pillar, i) => {
          const pp = sp(lf, 28 + i * 16, 350);
          return (
            <div key={i} style={{
              background: '#0F1E35', border: `2px solid rgba(232,168,56,0.35)`,
              borderRadius: 18, padding: '28px 36px', textAlign: 'center',
              opacity: Math.min(1, pp * 1.5), transform: `translateY(${(1 - pp) * 40}px)`,
              minWidth: 240,
              boxShadow: `0 4px 24px rgba(0,0,0,0.3)`,
            }}>
              <div style={{ fontSize: 42, marginBottom: 12 }}>{pillar.icon}</div>
              <div style={{ color: '#FFFFFF', fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>{pillar.text}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── Verify screen for phone mockup ────────────────────────────────────────────
const VerifyScreen: React.FC = () => (
  <div style={{ width: '100%', padding: 16, fontFamily: "'Inter', sans-serif", textAlign: 'center' }}>
    <div style={{ color: AMBER, fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: '0.1em' }}>SETTLEMENT SAM</div>
    <div style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 700, marginBottom: 12, lineHeight: 1.4 }}>
      Verify to unlock<br />your estimate
    </div>
    <div style={{ background: 'rgba(74,124,89,0.15)', border: `1px solid ${FOREST}`, borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
      <div style={{ color: FOREST, fontSize: 12, fontWeight: 700 }}>SMS Code: ••••••</div>
    </div>
    <div style={{ background: FOREST, color: '#FFFFFF', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 800 }}>
      ✓ Verified
    </div>
  </div>
);

// ── Scene 4: Social proof + economics (40-65s) ────────────────────────────────
const Scene4: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S4;
  const headerP = sp(lf, 0);
  const phoneP  = sp(lf, 15);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 72, padding: 80 }}>
      <FlashOverlay triggerFrame={S4 + 62} color={AMBER} duration={8} opacity={0.3} />
      <div style={{ flex: 1 }}>
        <div style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 700, opacity: Math.min(1, headerP * 1.5), marginBottom: 22, lineHeight: 1.4 }}>
          Here's what a Settlement Sam lead looks like:
        </div>
        <StatCard label="Injury Type" value="Spinal injury — surgery confirmed" delay={16} accent={AMBER} />
        <StatCard label="SMS Verified" value="✓ Phone confirmed" delay={28} accent={FOREST} />
        <StatCard label="Case value range" value="$75,000 – $200,000" delay={40} accent={AMBER} />
        <div style={{ marginTop: 28, opacity: sp(lf, 62) }}>
          <CountUp from={0} to={800} suffix="% ROI" delay={Math.max(0, lf - 62)} duration={38} fontSize={60} color={AMBER} />
          <div style={{ color: '#9CA3AF', fontSize: 15, marginTop: 6 }}>on your first batch of 25 leads</div>
        </div>
      </div>
      <div style={{ opacity: Math.min(1, phoneP * 1.5), transform: `scale(${0.82 + 0.18 * phoneP})` }}>
        <PhoneMockup screenContent={<VerifyScreen />} delay={15} />
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 5: Territory map (65-80s) ───────────────────────────────────────────
const STATES: Array<{ name: string; x: number; y: number }> = [
  { name: 'CA', x: 10, y: 52 }, { name: 'TX', x: 36, y: 68 },
  { name: 'FL', x: 68, y: 73 }, { name: 'NY', x: 80, y: 28 },
  { name: 'PA', x: 76, y: 36 }, { name: 'IL', x: 60, y: 40 },
  { name: 'OH', x: 69, y: 38 }, { name: 'GA', x: 67, y: 60 },
  { name: 'NC', x: 73, y: 53 }, { name: 'MI', x: 64, y: 31 },
];
// States that will "close" during animation
const CLAIMED_STATES = new Set(['TX', 'FL', 'NY']);

const Scene5: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S5;
  const dur = S6 - S5;
  const p1 = sp(lf, 0);
  const p2 = sp(lf, 20);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 80 }}>
      <div style={{ color: '#FFFFFF', fontSize: 34, fontWeight: 800, textAlign: 'center', opacity: Math.min(1, p1 * 1.5), marginBottom: 8 }}>
        We operate first-come, first-served by geography.
      </div>
      <div style={{ color: AMBER, fontSize: 22, textAlign: 'center', opacity: Math.min(1, p2 * 1.5), marginBottom: 36 }}>
        When your state fills — it's closed.
      </div>

      <div style={{ position: 'relative', width: 680, height: 340, background: '#0F1E35', borderRadius: 18, border: '1px solid rgba(232,168,56,0.2)', overflow: 'hidden' }}>
        <div style={{ color: 'rgba(255,255,255,0.04)', fontSize: 80, fontWeight: 900, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', whiteSpace: 'nowrap' }}>
          UNITED STATES
        </div>
        {STATES.map((state, i) => {
          const dotDelay = i * 10 + 10;
          const dotP = sp(lf, dotDelay, 400);
          // "Claimed" states fade to grey after halfway point
          const claimProgress = CLAIMED_STATES.has(state.name)
            ? interpolate(lf, [dur * 0.5, dur * 0.75], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            : 0;
          const dotColor = claimProgress > 0.5 ? '#555' : AMBER;
          const dotLabel = claimProgress > 0.5 ? 'CLOSED' : state.name;
          const dotLabelColor = claimProgress > 0.5 ? '#999' : '#0A1628';

          return (
            <div key={state.name} style={{
              position: 'absolute',
              left: `${state.x}%`, top: `${state.y}%`,
              transform: 'translate(-50%,-50%)',
              width: claimProgress > 0.5 ? 52 : 32, height: 32,
              background: dotColor, borderRadius: 6,
              opacity: Math.min(1, dotP * 1.5),
              boxShadow: claimProgress < 0.5 ? `0 0 14px rgba(232,168,56,0.5)` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.5s',
            }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: dotLabelColor, letterSpacing: '0.04em' }}>
                {dotLabel}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ color: FOREST, fontSize: 18, marginTop: 24, fontWeight: 600, opacity: sp(lf, 80) }}>
        {STATES.length - CLAIMED_STATES.size} states currently open
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 6: CTA (80-90s) ─────────────────────────────────────────────────────
const Scene6: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S6;
  const logoP = sp(lf, 0, 350);
  const line1P = sp(lf, 14);
  const ctaP   = sp(lf, 30, 400);
  const pulse  = Math.sin(lf * 0.2) * 0.5 + 0.5;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 64, fontWeight: 900, opacity: Math.min(1, logoP * 1.5), transform: `scale(${0.82 + 0.18 * logoP})`, marginBottom: 20 }}>
          <span style={{ color: '#FFFFFF' }}>Settlement</span>
          <span style={{ color: AMBER }}> Sam</span>
        </div>
        <div style={{ color: '#CBD5E1', fontSize: 22, opacity: Math.min(1, line1P * 1.5), marginBottom: 36, lineHeight: 1.5 }}>
          25-lead minimum. No contracts.<br />Replace any bad lead.
        </div>
        <div style={{
          display: 'inline-block',
          background: FOREST, color: '#FFFFFF',
          padding: '20px 56px', borderRadius: 60, fontSize: 24, fontWeight: 900,
          opacity: Math.min(1, ctaP * 1.5), transform: `scale(${0.82 + 0.18 * ctaP})`,
          boxShadow: `0 0 ${28 + 18 * pulse}px rgba(74,124,89,${0.5 + 0.3 * pulse})`,
          marginBottom: 20,
        }}>
          Secure Your Territory →
        </div>
        <div style={{ color: '#6B7280', fontSize: 18, opacity: Math.min(1, ctaP * 1.5) }}>
          settlementsam.com/attorneys
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Root ──────────────────────────────────────────────────────────────────────
export const FullPitch: React.FC = () => {
  const frame = useCurrentFrame();

  let audioEl: React.ReactNode = null;
  try { audioEl = <Audio src={staticFile('audio/full-pitch.mp3')} />; } catch { /* no audio */ }

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
      {frame >= S5 - 10 && frame < S6 + 10 && <div style={{ opacity: fade(S5, S6 + 10), position: 'absolute', inset: 0 }}><Scene5 frame={frame} /></div>}
      {frame >= S6 - 10 && <div style={{ opacity: fade(S6, TOTAL), position: 'absolute', inset: 0 }}><Scene6 frame={frame} /></div>}
    </AbsoluteFill>
  );
};
