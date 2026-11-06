import React from "react";
import { Composition } from "remotion";
import { NvidiaSimple, simpleDuration } from "./simple/SimpleVideo";
import { totalFrames } from "./data/timeline";
import { NvidiaExplainer } from "./Video";
import { EduCompositions } from "./edu/Root";
import { NvidiaExplainer as NvidiaOriginal } from "./v1/Video";
import { VIDEO as V1 } from "./v1/theme";
import { plan100k, plan1m } from "./plan/PlanVideo";
import { IpoVideo, ipoFrames } from "./ipo/IpoVideo";

export const RemotionRoot: React.FC = () => (
  <>
    {/* The original 60-second documentary cut (restored, with the updated return page and closing card). */}
    <Composition id="NvidiaOriginal60" component={NvidiaOriginal} {...V1} />
    {/* "A realistic daily plan": 3 trades a day, 3 days a week, 1% risk, 1:3 reward (~1:55). */}
    <Composition id="TradingPlan" component={plan100k.Video} width={1080} height={1920} fps={30} durationInFrames={plan100k.frames} />
    {/* Same plan at $1,000,000 over 12 months, month by month, ending on the AI bot. */}
    <Composition id="TradingPlan1M" component={plan1m.Video} width={1080} height={1920} fps={30} durationInFrames={plan1m.frames} />
    {/* Anthropic IPO explainer, 60 s, black + Claude orange. */}
    <Composition id="AnthropicIPO60" component={IpoVideo} width={1080} height={1920} fps={30} durationInFrames={ipoFrames} />
    {/* Client education series (16:9). */}
    <EduCompositions />
    {/* Slow, storybook cut for older viewers (~2:45, length follows the narration). */}
    <Composition id="NvidiaSimple" component={NvidiaSimple} width={1080} height={1920} fps={30} durationInFrames={simpleDuration} />
    {/* Documentary cut: charts, counters, connect-the-dots board. Length follows the narration (~4 min). */}
    <Composition id="NvidiaExplainer" component={NvidiaExplainer} width={1080} height={1920} fps={30} durationInFrames={totalFrames} />
  </>
);
