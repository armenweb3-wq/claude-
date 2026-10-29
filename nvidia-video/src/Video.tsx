import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { BoardTransitions } from "./components/Board";
import { ChapterRail, Soundtrack, Subtitles } from "./components/overlays";
import { FilmFinish, SceneShell } from "./components/primitives";
import { OVERLAP, scenes } from "./data/timeline";
import { S0Founder } from "./scenes/S0Founder";
import { S1Intro } from "./scenes/S1Intro";
import { S2Gpu } from "./scenes/S2Gpu";
import { S3DataCenter } from "./scenes/S3DataCenter";
import { S4Revenue } from "./scenes/S4Revenue";
import { S5Partners } from "./scenes/S5Partners";
import { S6Price } from "./scenes/S6Price";
import { S7Invest } from "./scenes/S7Invest";
import { S7Split } from "./scenes/S7Split";
import { S8Disclaimer } from "./scenes/S8Disclaimer";
import { colors } from "./theme";

const components: Record<string, React.FC> = {
  founder: S0Founder,
  intro: S1Intro,
  gpu: S2Gpu,
  datacenter: S3DataCenter,
  revenue: S4Revenue,
  partners: S5Partners,
  price: S6Price,
  invest: S7Invest,
  split: S7Split,
  disclaimer: S8Disclaimer,
};

export const NvidiaExplainer: React.FC = () => (
  <AbsoluteFill style={{ background: colors.ink }}>
    {scenes.map((s, i) => {
      const Scene = components[s.id];
      const last = i === scenes.length - 1;
      // Each scene runs OVERLAP frames past its slot so the next one dissolves over it.
      const duration = s.duration + (last ? 0 : OVERLAP);
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={duration} name={`${i + 1}. ${s.title}`}>
          <SceneShell duration={duration} overlap={OVERLAP} first={i === 0} last={last}>
            <Scene />
          </SceneShell>
        </Sequence>
      );
    })}
    <BoardTransitions />
    <ChapterRail />
    <Subtitles />
    <FilmFinish />
    <Soundtrack />
  </AbsoluteFill>
);
