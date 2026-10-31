import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { FilmFinish, SceneShell } from "./primitives";
import { colors } from "./theme";
import { ChapterRail, Soundtrack, Subtitles } from "./overlays";
import { SChart, SClose, SDay, SEdge, SGrowth, SRules, STitle, SWithdraw, tl } from "./scenes";

const components: Record<string, React.FC> = { title: STitle, rules: SRules, chart: SChart, day: SDay, edge: SEdge, growth: SGrowth, withdraw: SWithdraw, close: SClose };
const OVERLAP = 14;
/** Impact hits (frames): the day total, the six-month bar and the recovery banner. */
const abs = (scene: string, n: number, off = 0) => tl.at(scene, n, off) + tl.scenes.find((s) => s.id === scene)!.from;
const impacts = [abs("chart", 3, 0.2), abs("day", 3, 0.2), abs("growth", 2), abs("withdraw", 1, 2.4)];

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
