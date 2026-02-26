import React from 'react';
import { useCurrentFrame, useVideoConfig, staticFile } from 'remotion';

interface AudioSyncProps {
  audioSrc: string;
  children: (props: { progress: number; frame: number }) => React.ReactNode;
}

export const AudioSync: React.FC<AudioSyncProps> = ({ audioSrc: _audioSrc, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = frame / durationInFrames;
  return <>{children({ progress, frame })}</>;
};

/**
 * Hook that returns current playback position as 0-1 progress.
 */
export function useAudioTimestamp(): number {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return frame / durationInFrames;
}

/**
 * Resolves a static audio file path via Remotion's staticFile helper.
 * Returns null if the path is empty.
 */
export function resolveAudio(filename: string): string | null {
  if (!filename) return null;
  try {
    return staticFile(`audio/${filename}`);
  } catch {
    return null;
  }
}
