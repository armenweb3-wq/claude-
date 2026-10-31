import React from "react";
import { Composition } from "remotion";
import { NvidiaSimple, simpleDuration } from "./simple/SimpleVideo";
import { totalFrames } from "./data/timeline";
import { NvidiaExplainer } from "./Video";
import { EduCompositions } from "./edu/Root";
import { NvidiaExplainer as NvidiaOriginal } from "./v1/Video";
import { VIDEO as V1 } from "./v1/theme";
import { PlanVideo, planFrames } from "./plan/PlanVideo";

export const RemotionRoot: React.FC = () => (
  <>
    {/* The original 60-second documentary cut (restored, with the updated return page and closing card). */}
    <Composition id="NvidiaOriginal60" component={NvidiaOriginal} {...V1} />
    {/* "A disciplined daily plan": 5 trades a day, 1% risk, 1:3–5 reward (~1:37). */}
    <Composition id="TradingPlan" component={PlanVideo} width={1080} height={1920} fps={30} durationInFrames={planFrames} />
    {/* Client education series (16:9). */}
    <EduCompositions />
    {/* Slow, storybook cut for older viewers (~2:45, length follows the narration). */}
    <Composition id="NvidiaSimple" component={NvidiaSimple} width={1080} height={1920} fps={30} durationInFrames={simpleDuration} />
    {/* Documentary cut: charts, counters, connect-the-dots board. Length follows the narration (~4 min). */}
    <Composition id="NvidiaExplainer" component={NvidiaExplainer} width={1080} height={1920} fps={30} durationInFrames={totalFrames} />
  </>
);
