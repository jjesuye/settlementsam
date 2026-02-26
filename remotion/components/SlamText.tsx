import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';

interface SlamTextProps {
  text: string;
  direction?: 'left' | 'right' | 'up' | 'down';
  delay?: number;
  style?: React.CSSProperties;
}

export const SlamText: React.FC<SlamTextProps> = ({
  text,
  direction = 'up',
  delay = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { stiffness: 400, damping: 15, mass: 0.8 },
    durationInFrames: 20,
  });

  const offset = (1 - progress) * 120;

  const transform = {
    left:  `translateX(${-offset}px)`,
    right: `translateX(${offset}px)`,
    up:    `translateY(${offset}px)`,
    down:  `translateY(${-offset}px)`,
  }[direction];

  return (
    <span
      style={{
        display: 'inline-block',
        opacity: Math.min(1, progress * 2),
        transform,
        ...style,
      }}
    >
      {text}
    </span>
  );
};
