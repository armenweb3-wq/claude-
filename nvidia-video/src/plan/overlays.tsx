import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { Timeline } from "../edu/timeline";
import { colors, fonts, SAFE } from "./theme";
import { clamp } from "./primitives";

/** Overlays for the trading-plan film: same look as the original NVIDIA cut, driven by any timeline. */
type P = { tl: Timeline; impacts?: number[] };

/** Burned-in subtitles, driven by the same cue list as the voiceover. Words light up as they are spoken. */
export const Subtitles: React.FC<P> = ({ tl }) => {
  const f = useCurrentFrame();
  const cue = tl.cues.find((c) => f >= c.from - 4 && f <= c.to + 6);
  if (!cue) return null;
  const fade = Math.min(interpolate(f, [cue.from - 4, cue.from + 4], [0, 1], clamp), interpolate(f, [cue.to, cue.to + 6], [1, 0], clamp));
  const words = cue.text.split(" ");
  // Weight each word by length so long numbers take longer to "speak".
  const weights = words.map((w) => 1 + w.length * 0.18);
  const total = weights.reduce((a, b) => a + b, 0);
  const span = cue.to - cue.from;
  let acc = 0;
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.x,
        right: SAFE.x,
        top: SAFE.subtitleTop,
        display: "flex",
        justifyContent: "center",
        opacity: fade,
      }}
    >
      <div
        style={{
          fontFamily: fonts.body,
          fontWeight: 600,
          fontSize: 44,
          lineHeight: 1.32,
          textAlign: "center",
          padding: "18px 30px",
          borderRadius: 18,
          background: "rgba(5,14,28,0.78)",
          border: `2px solid ${colors.green}55`,
          backdropFilter: "blur(10px)",
          maxWidth: 900,
          textShadow: "0 2px 12px rgba(0,0,0,0.6)",
        }}
      >
        {words.map((w, i) => {
          const at = cue.from + (acc / total) * span;
          acc += weights[i];
          const lit = interpolate(f, [at - 2, at + 3], [0, 1], clamp);
          return (
            <span key={i} style={{ color: lit > 0.5 ? colors.text : "rgba(242,244,241,0.38)", transition: "none" }}>
              {w}
              {i < words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** Chapter marker + progress rail at the top — documentary navigation. */
export const ChapterRail: React.FC<P> = ({ tl }) => {
  const f = useCurrentFrame();
  const scenes = tl.scenes;
  const idx = Math.max(0, scenes.findIndex((s) => f >= s.from && f < s.from + s.duration));
  const scene = scenes[idx];
  const local = f - scene.from;
  const p = interpolate(local, [0, 18], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 78, left: SAFE.x, right: SAFE.x, display: "flex", gap: 8 }}>
        {scenes.map((s, i) => {
          const fill = i < idx ? 1 : i > idx ? 0 : interpolate(f, [s.from, s.from + s.duration], [0, 1], clamp);
          return (
            <div key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
              <div style={{ width: `${fill * 100}%`, height: "100%", background: colors.green }} />
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          top: 104,
          left: SAFE.x,
          right: SAFE.x,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: fonts.mono,
          fontSize: 22,
          letterSpacing: 3,
          color: colors.muted,
          textTransform: "uppercase",
          opacity: p,
        }}
      >
        <span>
          <span style={{ color: colors.green }}>{String(idx + 1).padStart(2, "0")}</span> / {String(scenes.length).padStart(2, "0")} · {scene.title}
        </span>
        <span>PLAN</span>
      </div>
    </AbsoluteFill>
  );
};

/** Music bed (placeholder) ducked under every voiceover cue, the narration, and transition/impact SFX. */
export const Soundtrack: React.FC<P> = ({ tl, impacts = [] }) => {
  const { cues, scenes } = tl;
  const audio = { musicFile: tl.audio.music, voiceoverFile: tl.audio.voice };
  const totalFrames = tl.totalFrames;
  const speaking = (frame: number) => cues.some((c) => frame >= c.from - 6 && frame <= c.to + 6);
  return (
    <>
      {audio.musicFile && (
        <Audio
          src={staticFile(audio.musicFile)}
          volume={(fr) => {
            const fadeIn = interpolate(fr, [0, 45], [0, 1], clamp);
            const fadeOut = interpolate(fr, [totalFrames - 60, totalFrames], [1, 0], clamp);
            // Average a small window so the duck ramps instead of clicking.
            let v = 0;
            for (let k = -8; k <= 8; k++) v += speaking(fr + k) ? 0.11 : 0.3;
            return (v / 17) * fadeIn * fadeOut;
          }}
        />
      )}
      {audio.voiceoverFile && <Audio src={staticFile(audio.voiceoverFile)} />}
      {scenes.slice(1).map((s) => (
        <Sequence key={s.id} from={s.from - 16} durationInFrames={36} layout="none">
          <Audio src={staticFile("audio/whoosh.wav")} volume={0.35} />
        </Sequence>
      ))}
      {impacts.map((t) => (
        <Sequence key={t} from={t - 2} durationInFrames={50} layout="none">
          <Audio src={staticFile("audio/impact.wav")} volume={0.32} />
        </Sequence>
      ))}
    </>
  );
};
