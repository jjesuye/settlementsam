import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

interface FlashOverlayProps {
  triggerFrame: number;
  color?: string;
  duration?: number;
  opacity?: number;
}

export const FlashOverlay: React.FC<FlashOverlayProps> = ({
  triggerFrame,
  color = '#E8A838',
  duration = 6,
  opacity = 0.3,
}) => {
  const frame = useCurrentFrame();

  const alpha = interpolate(
    frame,
    [triggerFrame, triggerFrame + duration * 0.4, triggerFrame + duration],
    [0, opacity, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  if (alpha <= 0) return null;

  return (
    <AbsoluteFill
      style={{
        background: color,
        opacity: alpha,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    />
  );
};
