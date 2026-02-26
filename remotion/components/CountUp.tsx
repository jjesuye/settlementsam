import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

interface CountUpProps {
  from?: number;
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number; // frames — max 45 for punchy feel
  delay?: number;
  color?: string;
  fontSize?: number;
}

export const CountUp: React.FC<CountUpProps> = ({
  from = 0,
  to,
  suffix = '',
  prefix = '',
  duration = 45,
  delay = 0,
  color = '#E8A838',
  fontSize = 72,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Use spring for overshoot/settle feel
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { stiffness: 180, damping: 18, mass: 0.8 },
    durationInFrames: Math.min(duration, 45),
  });

  const value = interpolate(progress, [0, 1], [from, to]);

  // Scale effect: 1.3x on impact, settles to 1x
  const scale = spring({
    frame: frame - delay,
    fps,
    config: { stiffness: 500, damping: 20 },
    durationInFrames: 20,
  });
  const scaleFactor = interpolate(scale, [0, 1], [1.3, 1]);

  return (
    <span
      style={{
        fontFamily: "'Roboto Mono', 'Courier New', monospace",
        fontSize,
        fontWeight: 700,
        color,
        letterSpacing: '-0.02em',
        display: 'inline-block',
        transform: `scale(${scaleFactor})`,
      }}
    >
      {prefix}{Math.round(value).toLocaleString()}{suffix}
    </span>
  );
};
