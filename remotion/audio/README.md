# Audio Files for Settlement Sam Videos

Place your audio files here with these exact names:
- `linkedin-hook.mp3` (30 seconds)
- `roi-breakdown.mp3` (45 seconds)
- `loom-demo.mp3` (5 minutes)
- `full-pitch.mp3` (90 seconds)

## Recording your voiceover

Recommended: Record with your phone in a quiet room.
Or use AI voice: [ElevenLabs.io](https://elevenlabs.io) (professional quality)

## Scripts

See `/remotion/scripts/` folder for word-for-word voiceover scripts for each video.

## Beat markers

After recording, note the timestamps (in seconds) where key phrases land and add them to:
`/remotion/utils/beatMarkers.ts`

Example:
```ts
const beats = toBeatFrames([2.5, 5.0, 8.3, 12.1]);
// Trigger animation when currentFrame === beats[0]
```
