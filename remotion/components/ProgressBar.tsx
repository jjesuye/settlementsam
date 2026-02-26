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
        height: 3,
        background: 'rgba(255,255,255,0.08)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #E8A838, #4A7C59)',
          borderRadius: '0 2px 2px 0',
        }}
      />
    </div>
  );
};
