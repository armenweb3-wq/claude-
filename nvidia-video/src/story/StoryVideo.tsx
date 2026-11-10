import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Soundtrack, Subtitles } from "./overlays";
import { Header, Page } from "./primitives";
import { impacts, PERIOD, scenes, tl } from "./scenes";
import { colors } from "./theme";

const OVERLAP = 26;

/** "Your account, in ten weeks": a paper-and-ink review of one client's trade history (16:9, ~3:30). */
export const StoryVideo: React.FC = () => (
  <AbsoluteFill style={{ background: colors.paper }}>
    {tl.scenes.map((s, i) => {
      const Scene = scenes[s.id];
      if (!Scene) throw new Error(`No scene component for ${s.id}`);
      const last = i === tl.scenes.length - 1;
      const duration = s.duration + (last ? 0 : OVERLAP);
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={duration} name={`${i + 1}. ${s.title}`}>
          <Page duration={duration} overlap={OVERLAP} first={i === 0} last={last}>
            <Scene />
          </Page>
        </Sequence>
      );
    })}
    <Header pages={tl.scenes} period={PERIOD} />
    <Subtitles tl={tl} />
    <Soundtrack tl={tl} impacts={impacts} />
  </AbsoluteFill>
);
export const storyFrames = tl.totalFrames;
