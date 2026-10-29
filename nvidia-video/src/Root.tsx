import React from "react";
import { Composition } from "remotion";
import { NvidiaSimple, simpleDuration } from "./simple/SimpleVideo";
import { totalFrames } from "./data/timeline";
import { NvidiaExplainer } from "./Video";
import { EduCompositions } from "./edu/Root";

export const RemotionRoot: React.FC = () => (
  <>
    {/* Client education series (16:9). */}
    <EduCompositions />
    {/* Slow, storybook cut for older viewers (~2:45, length follows the narration). */}
    <Composition id="NvidiaSimple" component={NvidiaSimple} width={1080} height={1920} fps={30} durationInFrames={simpleDuration} />
    {/* Documentary cut: charts, counters, connect-the-dots board. Length follows the narration (~4 min). */}
    <Composition id="NvidiaExplainer" component={NvidiaExplainer} width={1080} height={1920} fps={30} durationInFrames={totalFrames} />
  </>
);
