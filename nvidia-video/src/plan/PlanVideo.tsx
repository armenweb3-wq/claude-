import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { FilmFinish, SceneShell } from "../v1/components/primitives";
import { colors } from "../v1/theme";
import { ChapterRail, Soundtrack, Subtitles } from "./overlays";
import { SClose, SDay, SEdge, SGrowth, SRules, STitle, SWithdraw, tl } from "./scenes";

const components: Record<string, React.FC> = { title: STitle, rules: SRules, day: SDay, edge: SEdge, growth: SGrowth, withdraw: SWithdraw, close: SClose };
const OVERLAP = 14;
/** Impact hits (frames): the day total, the six-month bar and the recovery banner. */
const impacts = [tl.at("day", 4, 0.2) + tl.scenes.find((s) => s.id === "day")!.from, tl.at("growth", 2) + tl.scenes.find((s) => s.id === "growth")!.from, tl.at("withdraw", 1, 1.0) + tl.scenes.find((s) => s.id === "withdraw")!.from];

/** "A disciplined daily plan": same look and sound design as the original NVIDIA cut. */
export const PlanVideo: React.FC = () => (
  <AbsoluteFill style={{ background: colors.ink }}>
    {tl.scenes.map((s, i) => {
      const Scene = components[s.id];
      const last = i === tl.scenes.length - 1;
      const duration = s.duration + (last ? 0 : OVERLAP);
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={duration} name={`${i + 1}. ${s.title}`}>
          <SceneShell duration={duration} overlap={OVERLAP} first={i === 0} last={last}>
            <Scene />
          </SceneShell>
        </Sequence>
      );
    })}
    <ChapterRail tl={tl} />
    <Subtitles tl={tl} />
    <FilmFinish />
    <Soundtrack tl={tl} impacts={impacts} />
  </AbsoluteFill>
);
export const planFrames = tl.totalFrames;
