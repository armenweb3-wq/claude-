import React from "react";
import { Composition } from "remotion";
import { NvidiaSimple, simpleDuration } from "./simple/SimpleVideo";
import { NvidiaExplainer } from "./Video";
import { VIDEO } from "./theme";

export const RemotionRoot: React.FC = () => (
  <>
    {/* Slow, storybook cut for older viewers (~2:45, length follows the narration). */}
    <Composition id="NvidiaSimple" component={NvidiaSimple} width={1080} height={1920} fps={30} durationInFrames={simpleDuration} />
    {/* Original 60-second fast-paced cut. */}
    <Composition id="NvidiaExplainer" component={NvidiaExplainer} {...VIDEO} />
  </>
);
