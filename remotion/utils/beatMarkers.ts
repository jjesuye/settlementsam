/**
 * remotion/utils/beatMarkers.ts
 * Converts audio timestamps (seconds) to frame numbers.
 * After recording voiceover, note key phrase timestamps
 * and pass them here to sync animations to audio beats.
 */

const FPS = 30;

/**
 * Convert an array of timestamps (in seconds) to frame numbers.
 * Example: toBeatFrames([2.5, 5.0, 8.3]) => [75, 150, 249]
 */
export function toBeatFrames(timestamps: number[], fps: number = FPS): number[] {
  return timestamps.map(t => Math.round(t * fps));
}

/**
 * Returns true if currentFrame is within `tolerance` frames of a beat.
 */
export function isOnBeat(
  currentFrame: number,
  beatFrame: number,
  tolerance: number = 2,
): boolean {
  return Math.abs(currentFrame - beatFrame) <= tolerance;
}

/**
 * Returns the index of the most recent beat that has passed,
 * or -1 if no beat has occurred yet.
 */
export function currentBeatIndex(currentFrame: number, beatFrames: number[]): number {
  let idx = -1;
  for (let i = 0; i < beatFrames.length; i++) {
    if (currentFrame >= beatFrames[i]) idx = i;
  }
  return idx;
}
