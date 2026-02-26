import React from 'react';
import { useCurrentFrame, spring, useVideoConfig } from 'remotion';

interface PhoneMockupProps {
  screenContent?: React.ReactNode;
  delay?: number;
}

export const PhoneMockup: React.FC<PhoneMockupProps> = ({ screenContent, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { stiffness: 200, damping: 20, mass: 1.1 },
    durationInFrames: 28,
  });

  return (
    <div
      style={{
        position: 'relative',
        width: 280,
        opacity: Math.min(1, progress * 1.5),
        transform: `scale(${0.75 + 0.25 * progress}) translateY(${(1 - progress) * 40}px)`,
      }}
    >
      {/* Amber glow matching brand */}
      <div
        style={{
          position: 'absolute',
          inset: -24,
          background: 'radial-gradient(ellipse, rgba(232,168,56,0.18) 0%, transparent 70%)',
          borderRadius: 60,
          pointerEvents: 'none',
        }}
      />

      {/* Phone shell */}
      <svg viewBox="0 0 280 560" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%' }}>
        <rect x="2" y="2" width="276" height="556" rx="42" fill="#0F1E35" stroke="rgba(232,168,56,0.4)" strokeWidth="2.5" />
        <rect x="12" y="30" width="256" height="500" rx="32" fill="#0A1628" />
        <rect x="100" y="14" width="80" height="18" rx="9" fill="#0D1F30" />
        <rect x="-3" y="120" width="5" height="40" rx="2" fill="rgba(232,168,56,0.3)" />
        <rect x="-3" y="170" width="5" height="40" rx="2" fill="rgba(232,168,56,0.3)" />
        <rect x="278" y="140" width="5" height="60" rx="2" fill="rgba(232,168,56,0.3)" />
      </svg>

      {/* Screen content overlay */}
      <div
        style={{
          position: 'absolute',
          top: 30,
          left: 12,
          right: 12,
          bottom: 30,
          borderRadius: 32,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 14,
        }}
      >
        {screenContent ?? (
          <div style={{ color: '#E8A838', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
            Settlement<span style={{ color: '#FFFFFF' }}>Sam</span>
          </div>
        )}
      </div>
    </div>
  );
};
