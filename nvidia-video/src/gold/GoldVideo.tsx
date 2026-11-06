import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { ChapterRail, Soundtrack, Subtitles } from "./overlays";
import { FilmFinish, SceneShell } from "./primitives";
import { impacts, scenes, tl } from "./scenes";
import { colors } from "./theme";

const OVERLAP = 14;

/** "$2,500 on gold" pitch (~1:50) in black and gold. */
export const GoldVideo: React.FC = () => (
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
export const goldFrames = tl.totalFrames;
