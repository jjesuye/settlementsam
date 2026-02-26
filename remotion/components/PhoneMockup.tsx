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
    config: { damping: 18, stiffness: 80, mass: 1.2 },
    durationInFrames: 30,
  });

  return (
    <div
      style={{
        position: 'relative',
        width: 280,
        opacity: progress,
        transform: `scale(${0.8 + 0.2 * progress}) translateY(${(1 - progress) * 30}px)`,
      }}
    >
      {/* Glow effect */}
      <div
        style={{
          position: 'absolute',
          inset: -20,
          background: 'radial-gradient(ellipse, rgba(0,230,118,0.15) 0%, transparent 70%)',
          borderRadius: 60,
          pointerEvents: 'none',
        }}
      />

      {/* Phone body */}
      <svg viewBox="0 0 280 560" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%' }}>
        {/* Phone shell */}
        <rect x="2" y="2" width="276" height="556" rx="42" fill="#1A2A3A" stroke="#2D3F52" strokeWidth="3" />
        {/* Screen area */}
        <rect x="12" y="30" width="256" height="500" rx="32" fill="#0A1628" />
        {/* Notch */}
        <rect x="100" y="14" width="80" height="18" rx="9" fill="#0D1F30" />
        {/* Side buttons */}
        <rect x="-3" y="120" width="5" height="40" rx="2" fill="#2D3F52" />
        <rect x="-3" y="170" width="5" height="40" rx="2" fill="#2D3F52" />
        <rect x="278" y="140" width="5" height="60" rx="2" fill="#2D3F52" />
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
          padding: 16,
        }}
      >
        {screenContent ?? (
          <div style={{ color: '#FFFFFF', textAlign: 'center', fontSize: 13, opacity: 0.7 }}>
            Settlement Sam
          </div>
        )}
      </div>
    </div>
  );
};
