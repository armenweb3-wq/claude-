import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { ChapterRail, Soundtrack, Subtitles } from "./overlays";
import { FilmFinish, SceneShell } from "./primitives";
import { SDeal, SIpo, SNumbers, SNvidia, SPrice, STitle, SWatch, tl } from "./scenes";
import { colors } from "./theme";

const components: Record<string, React.FC> = { title: STitle, ipo: SIpo, numbers: SNumbers, deal: SDeal, nvidia: SNvidia, price: SPrice, watch: SWatch };
const OVERLAP = 14;
const abs = (scene: string, n: number, off = 0) => tl.at(scene, n, off) + tl.scenes.find((s) => s.id === scene)!.from;
const impacts = [abs("numbers", 0, 1.0), abs("deal", 0, 1.0), abs("nvidia", 0, 1.6), abs("price", 0, 0.6)];

/** Anthropic IPO explainer (~75 s) in black and Claude orange. */
export const IpoVideo: React.FC = () => (
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
export const ipoFrames = tl.totalFrames;
