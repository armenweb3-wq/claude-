import React from "react";
import { Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
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

/** Voice only: no music bed and no effects (the client asked for the narration alone). `impacts` is kept for API compatibility. */
export const Soundtrack: React.FC<P> = ({ tl }) => <>{tl.audio.voice && <Audio src={staticFile(tl.audio.voice)} />}</>;
