import React from 'react';
import { Composition } from 'remotion';
import { LinkedInHook } from './videos/LinkedInHook';
import { ROIBreakdown } from './videos/ROIBreakdown';
import { LoomDemo } from './videos/LoomDemo';
import { FullPitch } from './videos/FullPitch';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LinkedInHook"
        component={LinkedInHook}
        durationInFrames={900}
        fps={30}
        width={900}
        height={900}
      />
      <Composition
        id="ROIBreakdown"
        component={ROIBreakdown}
        durationInFrames={1350}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="LoomDemo"
        component={LoomDemo}
        durationInFrames={9000}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="FullPitch"
        component={FullPitch}
        durationInFrames={3300}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
