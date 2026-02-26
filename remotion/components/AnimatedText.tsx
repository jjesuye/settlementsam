import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';

interface AnimatedTextProps {
  text: string;
  delay?: number;
  style?: React.CSSProperties;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({ text, delay = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 120, mass: 1 },
    durationInFrames: 20,
  });

  return (
    <span
      style={{
        display: 'inline-block',
        opacity: progress,
        transform: `translateY(${(1 - progress) * 20}px)`,
        ...style,
      }}
    >
      {text}
    </span>
  );
};
