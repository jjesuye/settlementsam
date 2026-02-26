import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: 'rgba(255,255,255,0.1)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: '#00E676',
          transition: 'none',
        }}
      />
    </div>
  );
};
