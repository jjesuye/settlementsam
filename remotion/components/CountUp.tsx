import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface CountUpProps {
  from?: number;
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number; // frames
  delay?: number;    // frames
  color?: string;
  fontSize?: number;
}

export const CountUp: React.FC<CountUpProps> = ({
  from = 0,
  to,
  suffix = '',
  prefix = '',
  duration = 60,
  delay = 0,
  color = '#00E676',
  fontSize = 72,
}) => {
  const frame = useCurrentFrame();

  const value = interpolate(frame, [delay, delay + duration], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <span
      style={{
        fontFamily: "'Roboto Mono', 'Courier New', monospace",
        fontSize,
        fontWeight: 700,
        color,
        letterSpacing: '-0.02em',
      }}
    >
      {prefix}{Math.round(value).toLocaleString()}{suffix}
    </span>
  );
};
