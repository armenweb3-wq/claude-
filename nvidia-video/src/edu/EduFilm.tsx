import React, { createContext, useContext } from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { E, EF, Fade, Stage, TopBar } from "./kit";
import type { Timeline } from "./timeline";

type Ctx = { tl: Timeline; accent: string; scene: string };
const EduCtx = createContext<Ctx | null>(null);

/** Inside a scene: `at(n, offset)` = local frame where narration line n of this scene starts. */
export const useScene = () => {
  const c = useContext(EduCtx);
  if (!c) throw new Error("useScene outside EduFilm");
  return {
    accent: c.accent,
    at: (n: number, offset = 0) => c.tl.at(c.scene, n, offset),
    end: (n: number, offset = 0) => c.tl.atEnd(c.scene, n, offset),
  };
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FADE = 24;

const Subtitles: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const f = useCurrentFrame();
  const cue = tl.cues.find((c) => f >= c.from - 5 && f <= c.to + 8);
  if (!cue) return null;
  const o = Math.min(interpolate(f, [cue.from - 5, cue.from + 3], [0, 1], clamp), interpolate(f, [cue.to, cue.to + 8], [1, 0], clamp));
  return (
    <div style={{ position: "absolute", left: 160, right: 160, top: 905, display: "flex", justifyContent: "center", opacity: o }}>
      <div
        style={{
          fontFamily: EF.body,
          fontWeight: 500,
          fontSize: 36,
          lineHeight: 1.32,
          color: "white",
          textAlign: "center",
          background: "rgba(14,26,43,0.86)",
          borderRadius: 18,
          padding: "14px 30px",
          maxWidth: 1500,
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};

export const EduFilm: React.FC<{
  tl: Timeline;
  session: number;
  name: string;
  accent: string;
  scenes: Record<string, React.FC>;
  /** scene id → topic number (1-based) for the progress dots; title/recap scenes are left out */
  topics: Record<string, number>;
}> = ({ tl, session, name, accent, scenes, topics }) => {
  const topicCount = Math.max(...Object.values(topics));
  const speaking = (fr: number) => tl.cues.some((c) => fr >= c.from - 8 && fr <= c.to + 8);
  return (
    <Stage accent={accent}>
      {tl.scenes.map((s, i) => {
        const Scene = scenes[s.id];
        if (!Scene) throw new Error(`No component for scene ${s.id}`);
        const last = i === tl.scenes.length - 1;
        const duration = s.duration + (last ? 0 : FADE);
        const ti = topics[s.id] !== undefined ? topics[s.id] - 1 : -1;
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={duration} name={`${i + 1}. ${s.title}`}>
            <EduCtx.Provider value={{ tl, accent, scene: s.id }}>
              <Fade duration={duration} fade={FADE} first={i === 0} last={last}>
                <TopBar session={session} name={name} accent={accent} topic={ti >= 0 ? ti : undefined} topics={ti >= 0 ? topicCount : undefined} />
                <Scene />
              </Fade>
            </EduCtx.Provider>
          </Sequence>
        );
      })}
      <AbsoluteFill>
        <Subtitles tl={tl} />
      </AbsoluteFill>
      {tl.audio.music && (
        <Audio
          src={staticFile(tl.audio.music)}
          volume={(fr) => {
            let v = 0;
            for (let k = -10; k <= 10; k++) v += speaking(fr + k) ? 0.12 : 0.32;
            const edge = Math.min(interpolate(fr, [0, 45], [0, 1], clamp), interpolate(fr, [tl.totalFrames - 90, tl.totalFrames], [1, 0], clamp));
            return (v / 21) * edge;
          }}
        />
      )}
      {tl.audio.voice && <Audio src={staticFile(tl.audio.voice)} />}
      <div style={{ position: "absolute", right: 40, bottom: 18, fontFamily: EF.mono, fontSize: 16, color: E.faint, letterSpacing: 2 }}>EDUCATIONAL CONTENT</div>
    </Stage>
  );
};
