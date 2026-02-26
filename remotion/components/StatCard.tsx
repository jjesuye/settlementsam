import React from 'react';
import { useCurrentFrame, spring, useVideoConfig } from 'remotion';

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  delay?: number;
  accent?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  sublabel,
  delay = 0,
  accent = '#00E676',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 16, stiffness: 100, mass: 1 },
    durationInFrames: 25,
  });

  return (
    <div
      style={{
        background: '#0F1E35',
        borderLeft: `4px solid ${accent}`,
        borderRadius: 12,
        padding: '18px 24px',
        opacity: progress,
        transform: `translateX(${(1 - progress) * -40}px)`,
        marginBottom: 12,
        minWidth: 320,
      }}
    >
      <div style={{ color: '#9CA3AF', fontSize: 13, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 700 }}>
        {value}
      </div>
      {sublabel && (
        <div style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
          {sublabel}
        </div>
      )}
    </div>
  );
};
