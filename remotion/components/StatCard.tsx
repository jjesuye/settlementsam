import React from 'react';
import { useCurrentFrame, spring, useVideoConfig } from 'remotion';

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  delay?: number;
  accent?: string;
  direction?: 'left' | 'right';
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  sublabel,
  delay = 0,
  accent = '#4A7C59',
  direction = 'left',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { stiffness: 300, damping: 18, mass: 0.9 },
    durationInFrames: 22,
  });

  const offset = (1 - progress) * 60 * (direction === 'left' ? -1 : 1);

  return (
    <div
      style={{
        background: '#0F1E35',
        borderLeft: `4px solid ${accent}`,
        borderRadius: 12,
        padding: '14px 22px',
        opacity: Math.min(1, progress * 1.5),
        transform: `translateX(${offset}px)`,
        marginBottom: 10,
        minWidth: 320,
        boxShadow: `0 2px 16px rgba(0,0,0,0.3)`,
      }}
    >
      <div style={{ color: '#9CA3AF', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 700 }}>
        {value}
      </div>
      {sublabel && (
        <div style={{ color: '#CBD5E1', fontSize: 12, marginTop: 3 }}>
          {sublabel}
        </div>
      )}
    </div>
  );
};
