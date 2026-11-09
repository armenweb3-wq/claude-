import React from "react";
import { Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { Timeline } from "../edu/timeline";
import { clamp } from "./primitives";
import { colors, fonts, M } from "./theme";

type P = { tl: Timeline; impacts?: number[] };

/** Subtitles on a paper strip: dark ink on cream, words light up as spoken. */
export const Subtitles: React.FC<P> = ({ tl }) => {
  const f = useCurrentFrame();
  const cue = tl.cues.find((c) => f >= c.from - 4 && f <= c.to + 6);
  if (!cue) return null;
  const fade = Math.min(interpolate(f, [cue.from - 4, cue.from + 4], [0, 1], clamp), interpolate(f, [cue.to, cue.to + 6], [1, 0], clamp));
  const words = cue.text.split(" ");
  const weights = words.map((w) => 1 + w.length * 0.18);
  const total = weights.reduce((a, b) => a + b, 0);
  const span = cue.to - cue.from;
  let acc = 0;
  return (
    <div style={{ position: "absolute", left: M, right: M, bottom: 44, display: "flex", justifyContent: "center", opacity: fade }}>
      <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 32, lineHeight: 1.35, textAlign: "center", padding: "12px 26px", borderRadius: 8, background: "rgba(255,252,245,0.88)", border: `1.5px solid ${colors.ink}22`, boxShadow: "0 6px 18px rgba(50,35,15,0.12)", maxWidth: 1400 }}>
        {words.map((w, i) => {
          const at = cue.from + (acc / total) * span;
          acc += weights[i];
          const lit = interpolate(f, [at - 2, at + 3], [0, 1], clamp);
          return (
            <span key={i} style={{ color: lit > 0.5 ? colors.ink : "rgba(31,27,23,0.38)" }}>
              {w}
              {i < words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** Music bed ducked under the voice, the voice, and a soft page-turn on each new page. */
export const Soundtrack: React.FC<P> = ({ tl, impacts = [] }) => {
  const { cues, scenes } = tl;
  const totalFrames = tl.totalFrames;
  const speaking = (frame: number) => cues.some((c) => frame >= c.from - 6 && frame <= c.to + 6);
  return (
    <>
      {tl.audio.music && (
        <Audio
          src={staticFile(tl.audio.music)}
          volume={(fr) => {
            const fadeIn = interpolate(fr, [0, 45], [0, 1], clamp);
            const fadeOut = interpolate(fr, [totalFrames - 75, totalFrames], [1, 0], clamp);
            let v = 0;
            for (let k = -8; k <= 8; k++) v += speaking(fr + k) ? 0.1 : 0.26;
            return (v / 17) * fadeIn * fadeOut;
          }}
        />
      )}
      {tl.audio.voice && <Audio src={staticFile(tl.audio.voice)} />}
      {scenes.slice(1).map((s) => (
        <Sequence key={s.id} from={s.from - 14} durationInFrames={36} layout="none">
          <Audio src={staticFile("audio/whoosh.wav")} volume={0.18} />
        </Sequence>
      ))}
      {impacts.map((t) => (
        <Sequence key={t} from={t - 2} durationInFrames={50} layout="none">
          <Audio src={staticFile("audio/impact.wav")} volume={0.2} />
        </Sequence>
      ))}
    </>
  );
};
