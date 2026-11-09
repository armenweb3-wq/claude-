import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import vo100k from "../data/voiceover-plan.json";
import vo1m from "../data/voiceover-plan-1m.json";
import { ChapterRail, Soundtrack, Subtitles } from "./overlays";
import { FilmFinish, SceneShell } from "./primitives";
import { makePlan, type PlanConfig } from "./scenes";
import { colors } from "./theme";

const OVERLAP = 14;

/** Builds a film component from a plan config: same look and sound design as the original NVIDIA cut. */
export const makePlanVideo = (cfg: PlanConfig) => {
  const plan = makePlan(cfg);
  const { tl, scenes, impacts } = plan;
  const Video: React.FC = () => (
    <AbsoluteFill style={{ background: colors.ink }}>
      {tl.scenes.map((s, i) => {
        const Scene = scenes[s.id];
        if (!Scene) throw new Error(`No scene component for ${s.id}`);
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
  return { Video, frames: tl.totalFrames, plan };
};

/** $100,000 · 6 months (the original realistic plan). */
export const plan100k = makePlanVideo({ vo: vo100k, balance: 100_000, months: 6, silentClose: true });
/** $1,000,000 · 12 months, month by month, with the hands-off AI bot ending. */
export const plan1m = makePlanVideo({ vo: vo1m, balance: 1_000_000, months: 12, cta: true });

export const PlanVideo = plan100k.Video;
export const planFrames = plan100k.frames;
