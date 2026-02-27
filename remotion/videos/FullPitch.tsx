import React from 'react';
import {
  useCurrentFrame,
  interpolate,
  spring,
  AbsoluteFill,
} from 'remotion';
import { CountUp } from '../components/CountUp';
import { PhoneMockup } from '../components/PhoneMockup';
import { StatCard } from '../components/StatCard';
import { ProgressBar } from '../components/ProgressBar';
import { FlashOverlay } from '../components/FlashOverlay';

const BG     = '#0A1628';
const AMBER  = '#E8A838';
const FOREST = '#4A7C59';
const FPS    = 30;

// ── Scene boundaries ──────────────────────────────────────────────────────────
const S1    = 0;
const S2    = 5   * FPS;   // 5s   — hook
const S3    = 20  * FPS;   // 20s  — solution (EXPANDED to 40s)
const S4    = 60  * FPS;   // 60s  — social proof
const S5    = 85  * FPS;   // 85s  — territory
const S6    = 100 * FPS;   // 100s — CTA
const TOTAL = 110 * FPS;   // 110s = 3300 frames

function sp(frame: number, delay = 0, stiffness = 300) {
  return spring({ frame: frame - delay, fps: FPS, config: { stiffness, damping: 18, mass: 0.9 }, durationInFrames: 22 });
}

// ── Animated background ───────────────────────────────────────────────────────
const PARTICLE_DATA = Array.from({ length: 28 }, (_, i) => {
  const seed = i * 137.508;
  return {
    x:           ((seed * 23.7)  % 97) + 1.5,
    baseY:       ((seed * 17.3)  % 97) + 1.5,
    speed:       0.005 + (i % 5) * 0.003,
    size:        1.5 + (i % 4) * 1.2,
    phase:       i * 0.71,
    color:       i % 3 === 0 ? AMBER : i % 3 === 1 ? FOREST : '#94A3B8',
    baseOpacity: 0.10 + (i % 4) * 0.05,
  };
});

const ParticleBg: React.FC<{ frame: number }> = ({ frame }) => {
  const breathe    = Math.sin(frame * 0.018) * 0.5 + 0.5;
  const pulse1     = 0.08 + breathe * 0.06;
  const pulse2     = 0.05 + (1 - breathe) * 0.05;
  const gridShift  = (frame * 0.25) % 80;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Breathing radial gradients */}
      <div style={{
        position: 'absolute', inset: 0,
        background:
          `radial-gradient(ellipse 60% 50% at 12% 88%, rgba(232,168,56,${pulse1}) 0%, transparent 55%),` +
          `radial-gradient(ellipse 50% 60% at 88% 12%, rgba(74,124,89,${pulse2}) 0%, transparent 55%),` +
          `radial-gradient(ellipse 40% 40% at 50% 50%, rgba(15,30,53,0) 0%, rgba(10,22,40,0.5) 100%)`,
      }} />
      {/* Drifting grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage:
          'linear-gradient(rgba(232,168,56,0.04) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(232,168,56,0.04) 1px, transparent 1px)',
        backgroundSize: '80px 80px',
        backgroundPosition: `${gridShift}px ${gridShift}px`,
      }} />
      {/* Floating particles */}
      {PARTICLE_DATA.map((p, i) => {
        const y = ((p.baseY - frame * p.speed * 100) % 100 + 100) % 100;
        const opacity = Math.max(0, p.baseOpacity + Math.sin(frame * 0.04 + p.phase) * 0.07);
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${p.x}%`, top: `${y}%`,
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: p.color,
            opacity,
          }} />
        );
      })}
    </AbsoluteFill>
  );
};

// ── Scene 1: Black → white flash → 97% hook (0–5s) ───────────────────────────
const Scene1: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S1;
  const flashAlpha = interpolate(lf, [30, 45, 60], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const stat1P = sp(lf, 60, 400);
  const stat2P = sp(lf, 92, 350);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: '#000000' }}>
      {flashAlpha > 0 && (
        <AbsoluteFill style={{ background: '#FFFFFF', opacity: flashAlpha, zIndex: 10 }} />
      )}
      <div style={{ textAlign: 'center', padding: '0 140px', zIndex: 5 }}>
        <div style={{
          opacity: Math.min(1, stat1P * 1.5),
          transform: `translateY(${(1 - stat1P) * 40}px)`,
          marginBottom: 28,
        }}>
          <span style={{ color: AMBER, fontSize: 160, fontWeight: 900, display: 'block', letterSpacing: '-0.04em', lineHeight: 1 }}>97%</span>
          <span style={{ color: '#FFFFFF', fontSize: 52, fontWeight: 800, lineHeight: 1.3 }}>of PI leads never become cases.</span>
        </div>
        <div style={{
          color: '#CBD5E1', fontSize: 34, fontWeight: 600,
          opacity: Math.min(1, stat2P * 1.5),
          transform: `translateY(${(1 - stat2P) * 24}px)`,
        }}>
          You've been paying for the <span style={{ color: AMBER, fontWeight: 900 }}>97%.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: Problem agitation (5–20s) ───────────────────────────────────────
const PROBLEM_STATS = [
  'The average PI firm spends $8,000/month on marketing.',
  'Less than 3% of those leads ever become signed cases.',
  'Most leads are shared with 5 or more competing firms.',
  "You have no idea what you're getting until it's too late.",
];

const Scene2: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S2;
  if (!PROBLEM_STATS || PROBLEM_STATS.length === 0) return null;

  const segDur = Math.floor((S3 - S2) / PROBLEM_STATS.length);
  const idx    = Math.min(PROBLEM_STATS.length - 1, Math.max(0, Math.floor(lf / segDur)));
  const segF   = lf - idx * segDur;
  const p      = sp(segF, 5, 400);
  const stat   = PROBLEM_STATS[idx] ?? PROBLEM_STATS[0];

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ color: AMBER, fontSize: 16, fontWeight: 700, letterSpacing: '0.18em', marginBottom: 32, opacity: 0.65 }}>
        THE PROBLEM
      </div>
      <div style={{
        color: '#FFFFFF', fontSize: 54, fontWeight: 800, textAlign: 'center',
        maxWidth: 1200, opacity: Math.min(1, p * 1.5),
        transform: `translateY(${(1 - p) * 40}px)`,
        lineHeight: 1.3, padding: '0 100px',
      }}>
        {stat}
      </div>
      {/* Dot progress indicator */}
      <div style={{ display: 'flex', gap: 12, marginTop: 56 }}>
        {PROBLEM_STATS.map((_, i) => (
          <div key={i} style={{
            width: i === idx ? 32 : 8, height: 8, borderRadius: 4,
            background: i === idx ? AMBER : 'rgba(255,255,255,0.2)',
            opacity: i === idx ? 1 : 0.45,
          }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 3: Settlement Sam deep dive (20–60s, 1200 frames) ──────────────────
// Sub-scene offsets relative to lf = frame - S3
const S3A = 0;     // Intro slam     (0–90f  = 3s)
const S3B = 90;    // Overview       (90–270f = 6s)
const S3C = 270;   // SMS deep dive  (270–510f = 8s)
const S3D = 510;   // Profile dive   (510–750f = 8s)
const S3E = 750;   // 90-day dive    (750–1050f = 10s)
const S3F = 1050;  // Summary slam   (1050–1200f = 5s)
const S3_TOTAL = 1200; // 40s

const PILLARS_DATA = [
  {
    icon: '🔒',
    title: 'SMS-Verified Humans',
    short: 'Real people. Confirmed numbers.',
    headline: 'Not a form. Not a click. A real human.',
    body: "Every lead has confirmed their phone number via SMS before you ever see them. They raised their hand. They want to talk to an attorney — and they proved it.",
    bullets: ['Confirmed phone number — no fake submissions', 'Active opt-in consent before contact', 'Zero ghost leads, zero wrong numbers'],
    accent: AMBER,
  },
  {
    icon: '👤',
    title: 'Full Injury Profiles',
    short: 'Know the case before the call.',
    headline: 'Before your first call, you already know.',
    body: "Every lead arrives with injury type, accident details, and current medical treatment status. You're not flying blind. You know exactly what you're walking into before you pick up the phone.",
    bullets: ['Injury type and severity documented', 'Medical treatment and surgery status', 'Estimated case value range included'],
    accent: FOREST,
  },
  {
    icon: '⚡',
    title: '90-Day Exclusivity',
    short: 'Yours and yours alone.',
    headline: 'One firm. 90 days. Zero competition.',
    body: "This lead belongs to you exclusively for 90 full days. No other firm gets it. No bidding war. No race to be first. Work your case, on your timeline, without someone else swooping in.",
    bullets: ['No shared leads — ever, period', '90 full days to nurture and convert', 'You own the data permanently'],
    accent: AMBER,
  },
];

const PillarDeepDive: React.FC<{ pillarIdx: number; relF: number }> = ({ pillarIdx, relF }) => {
  const safeIdx = Math.max(0, Math.min(pillarIdx, PILLARS_DATA.length - 1));
  const pillar  = PILLARS_DATA[safeIdx];
  if (!pillar) return null;

  const titleP = sp(relF, 0, 450);
  const bodyP  = sp(relF, 20, 300);
  const b1P    = sp(relF, 36, 380);
  const b2P    = sp(relF, 52, 380);
  const b3P    = sp(relF, 68, 380);
  const bPs    = [b1P, b2P, b3P];

  const glow = Math.sin(relF * 0.13) * 0.5 + 0.5;
  const accentRgb = pillar.accent === AMBER ? '232,168,56' : '74,124,89';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '0 120px', boxSizing: 'border-box' }}>
      {/* Pill nav */}
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 36 }}>
        {PILLARS_DATA.map((p, i) => {
          const active = i === pillarIdx;
          return (
            <div key={i} style={{
              padding: '8px 22px', borderRadius: 24,
              background: active ? pillar.accent : 'rgba(255,255,255,0.07)',
              color: active ? '#0A1628' : 'rgba(255,255,255,0.35)',
              fontSize: 14, fontWeight: 800, letterSpacing: '0.05em',
              border: `1.5px solid ${active ? pillar.accent : 'transparent'}`,
            }}>
              {p.icon} {p.title}
            </div>
          );
        })}
      </div>

      {/* Main card */}
      <div style={{
        background: '#0F1E35',
        border: `2px solid ${pillar.accent}`,
        borderRadius: 24,
        padding: '48px 60px',
        width: '100%',
        maxWidth: 1100,
        boxShadow: `0 0 ${36 + 22 * glow}px rgba(${accentRgb},${0.18 + 0.14 * glow})`,
        opacity: Math.min(1, titleP * 1.2),
      }}>
        {/* Icon + headline row */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 28, marginBottom: 28,
          transform: `translateY(${(1 - titleP) * 32}px)`,
        }}>
          <div style={{ fontSize: 80, lineHeight: 1, flexShrink: 0 }}>{pillar.icon}</div>
          <div>
            <div style={{ color: pillar.accent, fontSize: 14, fontWeight: 700, letterSpacing: '0.14em', marginBottom: 8 }}>
              PILLAR {pillarIdx + 1} OF 3
            </div>
            <div style={{ color: '#FFFFFF', fontSize: 42, fontWeight: 900, lineHeight: 1.2 }}>
              {pillar.headline}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{
          color: '#CBD5E1', fontSize: 24, lineHeight: 1.7, marginBottom: 36,
          opacity: Math.min(1, bodyP * 1.4),
          transform: `translateY(${(1 - bodyP) * 20}px)`,
          borderLeft: `4px solid ${pillar.accent}`,
          paddingLeft: 24,
        }}>
          {pillar.body}
        </div>

        {/* Bullets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pillar.bullets.map((b, i) => {
            const bp = bPs[i] ?? 0;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                background: `rgba(${accentRgb},0.06)`,
                border: `1px solid rgba(${accentRgb},0.18)`,
                borderRadius: 12, padding: '14px 22px',
                opacity: Math.min(1, bp * 1.4),
                transform: `translateX(${(1 - bp) * 36}px)`,
              }}>
                <span style={{ color: pillar.accent, fontSize: 22, fontWeight: 900, flexShrink: 0 }}>✓</span>
                <span style={{ color: '#FFFFFF', fontSize: 21, fontWeight: 600 }}>{b}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Scene3: React.FC<{ frame: number }> = ({ frame }) => {
  const lf = frame - S3;
  if (!PILLARS_DATA || PILLARS_DATA.length === 0) return null;

  const subFade = (s: number, e: number) =>
    interpolate(lf, [s, s + 14, e - 14, e], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const showA = lf < S3B + 14;
  const showB = lf >= S3B - 14 && lf < S3C + 14;
  const showC = lf >= S3C - 14 && lf < S3D + 14;
  const showD = lf >= S3D - 14 && lf < S3E + 14;
  const showE = lf >= S3E - 14 && lf < S3F + 14;
  const showF = lf >= S3F - 14;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>

      {/* ── Phase A: Intro slam ── */}
      {showA && (
        <div style={{ opacity: subFade(S3A, S3B + 14), position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: '0 120px' }}>
            <div style={{
              fontSize: 92, fontWeight: 900, lineHeight: 1.05,
              opacity: Math.min(1, sp(lf, 5, 450) * 1.5),
              transform: `translateY(${(1 - sp(lf, 5, 450)) * -60}px)`,
              marginBottom: 16,
            }}>
              <span style={{ color: '#FFFFFF' }}>Settlement</span>
              <span style={{ color: AMBER }}> Sam</span>
            </div>
            <div style={{
              color: AMBER, fontSize: 48, fontWeight: 800,
              opacity: Math.min(1, sp(lf, 24, 380) * 1.5),
              transform: `translateY(${(1 - sp(lf, 24, 380)) * 40}px)`,
              marginBottom: 28,
            }}>
              A Different Model.
            </div>
            <div style={{
              color: '#9CA3AF', fontSize: 28,
              opacity: Math.min(1, sp(lf, 46) * 1.5),
              transform: `translateY(${(1 - sp(lf, 46)) * 20}px)`,
            }}>
              Three guarantees that change everything.
            </div>
          </div>
        </div>
      )}

      {/* ── Phase B: Overview — all 3 cards ── */}
      {showB && (
        <div style={{ opacity: subFade(S3B, S3C + 14), position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 100px' }}>
          <div style={{
            color: '#9CA3AF', fontSize: 18, letterSpacing: '0.14em', marginBottom: 40,
            opacity: Math.min(1, sp(lf - S3B, 0) * 1.5),
          }}>
            WHAT MAKES SETTLEMENT SAM DIFFERENT
          </div>
          <div style={{ display: 'flex', gap: 28, width: '100%' }}>
            {PILLARS_DATA.map((pillar, i) => {
              const pp = sp(lf - S3B, i * 20, 380);
              return (
                <div key={i} style={{
                  flex: 1, background: '#0F1E35',
                  border: `2px solid rgba(232,168,56,0.4)`,
                  borderRadius: 22, padding: '40px 32px', textAlign: 'center',
                  opacity: Math.min(1, pp * 1.4),
                  transform: `translateY(${(1 - pp) * 60}px)`,
                  boxShadow: '0 6px 32px rgba(0,0,0,0.4)',
                }}>
                  <div style={{ fontSize: 64, marginBottom: 18 }}>{pillar.icon}</div>
                  <div style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 800, lineHeight: 1.3, marginBottom: 10 }}>{pillar.title}</div>
                  <div style={{ color: '#9CA3AF', fontSize: 16, lineHeight: 1.4 }}>{pillar.short}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Phase C: SMS Verified deep dive ── */}
      {showC && (
        <div style={{ opacity: subFade(S3C, S3D + 14), position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PillarDeepDive pillarIdx={0} relF={lf - S3C} />
        </div>
      )}

      {/* ── Phase D: Full Injury Profiles deep dive ── */}
      {showD && (
        <div style={{ opacity: subFade(S3D, S3E + 14), position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PillarDeepDive pillarIdx={1} relF={lf - S3D} />
        </div>
      )}

      {/* ── Phase E: 90-Day Exclusivity deep dive ── */}
      {showE && (
        <div style={{ opacity: subFade(S3E, S3F + 14), position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PillarDeepDive pillarIdx={2} relF={lf - S3E} />
        </div>
      )}

      {/* ── Phase F: Summary slam — all 3 together ── */}
      {showF && (
        <div style={{ opacity: subFade(S3F, S3_TOTAL + 14), position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 100px' }}>
          <div style={{
            color: AMBER, fontSize: 46, fontWeight: 900, textAlign: 'center', marginBottom: 44,
            opacity: Math.min(1, sp(lf - S3F, 0, 450) * 1.5),
            transform: `translateY(${(1 - sp(lf - S3F, 0, 450)) * -40}px)`,
          }}>
            SMS Verified. Full Profile. Yours Alone.
          </div>
          <div style={{ display: 'flex', gap: 24, width: '100%' }}>
            {PILLARS_DATA.map((pillar, i) => {
              const pp   = sp(lf - S3F, i * 16, 420);
              const glow = Math.sin((lf - S3F) * 0.15 + i * 1.3) * 0.5 + 0.5;
              const rgb  = pillar.accent === AMBER ? '232,168,56' : '74,124,89';
              return (
                <div key={i} style={{
                  flex: 1, background: '#0F1E35',
                  border: `2px solid ${pillar.accent}`,
                  borderRadius: 20, padding: '32px 28px', textAlign: 'center',
                  opacity: Math.min(1, pp * 1.4),
                  transform: `scale(${0.82 + 0.18 * pp})`,
                  boxShadow: `0 0 ${22 + 16 * glow}px rgba(${rgb},${0.28 + 0.18 * glow})`,
                }}>
                  <div style={{ fontSize: 56, marginBottom: 14 }}>{pillar.icon}</div>
                  <div style={{ color: pillar.accent, fontSize: 19, fontWeight: 800 }}>{pillar.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ── Verify screen (used in Scene 4 phone mockup) ──────────────────────────────
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

// ── Scene 4: Social proof + economics (60–85s) ────────────────────────────────
const Scene4: React.FC<{ frame: number }> = ({ frame }) => {
  const lf      = frame - S4;
  const headerP = sp(lf, 0);
  const phoneP  = sp(lf, 18);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 88, padding: 80 }}>
      <FlashOverlay triggerFrame={S4 + 65} color={AMBER} duration={8} opacity={0.3} />
      <div style={{ flex: 1 }}>
        <div style={{
          color: '#FFFFFF', fontSize: 30, fontWeight: 700,
          opacity: Math.min(1, headerP * 1.5), marginBottom: 28, lineHeight: 1.45,
        }}>
          Here's what a Settlement Sam lead looks like:
        </div>
        <StatCard label="Injury Type"       value="Spinal injury — surgery confirmed"  delay={18} accent={AMBER}  />
        <StatCard label="SMS Verified"      value="✓ Phone confirmed"                   delay={30} accent={FOREST} />
        <StatCard label="Case value range"  value="$75,000 – $200,000"                 delay={42} accent={AMBER}  />
        <div style={{ marginTop: 36, opacity: sp(lf, 65) }}>
          <CountUp from={0} to={800} suffix="% ROI" delay={Math.max(0, lf - 65)} duration={38} fontSize={80} color={AMBER} />
          <div style={{ color: '#9CA3AF', fontSize: 19, marginTop: 8 }}>on your first batch of 25 leads</div>
        </div>
      </div>
      <div style={{ opacity: Math.min(1, phoneP * 1.5), transform: `scale(${0.84 + 0.16 * phoneP})` }}>
        <PhoneMockup screenContent={<VerifyScreen />} delay={18} />
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 5: Territory map (85–100s) ─────────────────────────────────────────
const STATES: Array<{ name: string; x: number; y: number }> = [
  { name: 'CA', x: 10, y: 52 }, { name: 'TX', x: 36, y: 68 },
  { name: 'FL', x: 68, y: 73 }, { name: 'NY', x: 80, y: 28 },
  { name: 'PA', x: 76, y: 36 }, { name: 'IL', x: 60, y: 40 },
  { name: 'OH', x: 69, y: 38 }, { name: 'GA', x: 67, y: 60 },
  { name: 'NC', x: 73, y: 53 }, { name: 'MI', x: 64, y: 31 },
];
const CLAIMED_STATES = new Set(['TX', 'FL', 'NY']);

const Scene5: React.FC<{ frame: number }> = ({ frame }) => {
  const lf  = frame - S5;
  const dur = S6 - S5;
  const p1  = sp(lf, 0);
  const p2  = sp(lf, 22);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 80 }}>
      <div style={{ color: '#FFFFFF', fontSize: 42, fontWeight: 800, textAlign: 'center', opacity: Math.min(1, p1 * 1.5), marginBottom: 10 }}>
        We operate first-come, first-served by geography.
      </div>
      <div style={{ color: AMBER, fontSize: 28, textAlign: 'center', opacity: Math.min(1, p2 * 1.5), marginBottom: 44 }}>
        When your state fills — it's closed.
      </div>

      <div style={{ position: 'relative', width: 780, height: 390, background: '#0F1E35', borderRadius: 22, border: '1px solid rgba(232,168,56,0.22)', overflow: 'hidden' }}>
        <div style={{ color: 'rgba(255,255,255,0.04)', fontSize: 80, fontWeight: 900, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', whiteSpace: 'nowrap' }}>
          UNITED STATES
        </div>
        {STATES.map((state, i) => {
          const dotP         = sp(lf, i * 10 + 10, 400);
          const claimP       = CLAIMED_STATES.has(state.name)
            ? interpolate(lf, [dur * 0.5, dur * 0.75], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            : 0;
          const claimed      = claimP > 0.5;
          const dotColor     = claimed ? '#444' : AMBER;
          const dotLabelClr  = claimed ? '#888' : '#0A1628';
          const label        = claimed ? 'CLOSED' : state.name;

          return (
            <div key={state.name} style={{
              position: 'absolute',
              left: `${state.x}%`, top: `${state.y}%`,
              transform: 'translate(-50%,-50%)',
              width: claimed ? 58 : 36, height: 34,
              background: dotColor, borderRadius: 6,
              opacity: Math.min(1, dotP * 1.5),
              boxShadow: claimed ? 'none' : '0 0 16px rgba(232,168,56,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: dotLabelClr, letterSpacing: '0.04em' }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ color: FOREST, fontSize: 21, marginTop: 30, fontWeight: 700, opacity: sp(lf, 80) }}>
        {STATES.length - CLAIMED_STATES.size} states currently open
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 6: CTA (100–110s) ───────────────────────────────────────────────────
const Scene6: React.FC<{ frame: number }> = ({ frame }) => {
  const lf    = frame - S6;
  const logoP = sp(lf, 0, 360);
  const line1 = sp(lf, 16);
  const ctaP  = sp(lf, 32, 420);
  const pulse = Math.sin(lf * 0.2) * 0.5 + 0.5;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 88, fontWeight: 900,
          opacity: Math.min(1, logoP * 1.5),
          transform: `scale(${0.82 + 0.18 * logoP})`,
          marginBottom: 28,
        }}>
          <span style={{ color: '#FFFFFF' }}>Settlement</span>
          <span style={{ color: AMBER }}> Sam</span>
        </div>
        <div style={{
          color: '#CBD5E1', fontSize: 28, lineHeight: 1.65,
          opacity: Math.min(1, line1 * 1.5), marginBottom: 48,
        }}>
          25-lead minimum. No contracts.<br />Replace any bad lead.
        </div>
        <div style={{
          display: 'inline-block',
          background: FOREST, color: '#FFFFFF',
          padding: '24px 68px', borderRadius: 64, fontSize: 30, fontWeight: 900,
          opacity: Math.min(1, ctaP * 1.5),
          transform: `scale(${0.82 + 0.18 * ctaP})`,
          boxShadow: `0 0 ${36 + 22 * pulse}px rgba(74,124,89,${0.55 + 0.3 * pulse})`,
          marginBottom: 26,
        }}>
          Secure Your Territory →
        </div>
        <div style={{ color: '#6B7280', fontSize: 22, opacity: Math.min(1, ctaP * 1.5) }}>
          settlementsam.com/attorneys
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Root ──────────────────────────────────────────────────────────────────────
export const FullPitch: React.FC = () => {
  const frame = useCurrentFrame();

  const fade = (s: number, e: number) =>
    interpolate(frame, [s, s + 10, e - 10, e], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      <ParticleBg frame={frame} />
      <ProgressBar />
      {frame < S2 + 10 && (
        <div style={{ opacity: fade(S1, S2 + 10), position: 'absolute', inset: 0 }}>
          <Scene1 frame={frame} />
        </div>
      )}
      {frame >= S2 - 10 && frame < S3 + 10 && (
        <div style={{ opacity: fade(S2, S3 + 10), position: 'absolute', inset: 0 }}>
          <Scene2 frame={frame} />
        </div>
      )}
      {frame >= S3 - 10 && frame < S4 + 10 && (
        <div style={{ opacity: fade(S3, S4 + 10), position: 'absolute', inset: 0 }}>
          <Scene3 frame={frame} />
        </div>
      )}
      {frame >= S4 - 10 && frame < S5 + 10 && (
        <div style={{ opacity: fade(S4, S5 + 10), position: 'absolute', inset: 0 }}>
          <Scene4 frame={frame} />
        </div>
      )}
      {frame >= S5 - 10 && frame < S6 + 10 && (
        <div style={{ opacity: fade(S5, S6 + 10), position: 'absolute', inset: 0 }}>
          <Scene5 frame={frame} />
        </div>
      )}
      {frame >= S6 - 10 && (
        <div style={{ opacity: fade(S6, TOTAL), position: 'absolute', inset: 0 }}>
          <Scene6 frame={frame} />
        </div>
      )}
    </AbsoluteFill>
  );
};
