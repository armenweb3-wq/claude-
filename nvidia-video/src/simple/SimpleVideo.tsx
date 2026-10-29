import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import "../theme"; // registers the bundled fonts
import { F, P, Paper, SoftScene } from "./kit";
import {
  SAi, SClose, SDataCenter, SDots, SFifty, SFounder, SGpu, SInvest, SLeverage, SPartners, SPrice, SRevenue, SRisk, STitle,
} from "./scenes";
import { audio, cues, scenes, totalFrames } from "./timeline";

const components: Record<string, React.FC> = {
  title: STitle, ai: SAi, founder: SFounder, gpu: SGpu, datacenter: SDataCenter, dots: SDots, revenue: SRevenue,
  partners: SPartners, price: SPrice, leverage: SLeverage, invest: SInvest, fifty: SFifty, risk: SRisk, close: SClose,
};
const FADE = 20;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Large, high-contrast captions: the whole sentence at once, nothing dimmed — easy to read. */
const BigSubtitles: React.FC = () => {
  const f = useCurrentFrame();
  const cue = cues.find((c) => f >= c.from - 6 && f <= c.to + 10);
  if (!cue) return null;
  const o = Math.min(interpolate(f, [cue.from - 6, cue.from + 4], [0, 1], clamp), interpolate(f, [cue.to, cue.to + 10], [1, 0], clamp));
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top: 1420, display: "flex", justifyContent: "center", opacity: o }}>
      <div
        style={{
          fontFamily: F.sans,
          fontWeight: 600,
          fontSize: 54,
          lineHeight: 1.3,
          color: P.cream,
          textAlign: "center",
          background: "rgba(10,16,30,0.72)",
          borderRadius: 22,
          padding: "20px 34px",
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};

const Sound: React.FC = () => {
  const speaking = (fr: number) => cues.some((c) => fr >= c.from - 8 && fr <= c.to + 8);
  return (
    <>
      {audio.musicFile && (
        <Audio
          src={staticFile(audio.musicFile)}
          volume={(fr) => {
            let v = 0;
            for (let k = -10; k <= 10; k++) v += speaking(fr + k) ? 0.09 : 0.22;
            const edge = Math.min(interpolate(fr, [0, 60], [0, 1], clamp), interpolate(fr, [totalFrames - 90, totalFrames], [1, 0], clamp));
            return (v / 21) * edge;
          }}
        />
      )}
      {audio.voiceoverFile && <Audio src={staticFile(audio.voiceoverFile)} />}
    </>
  );
};

export const NvidiaSimple: React.FC = () => (
  <Paper>
    {scenes.map((s, i) => {
      const Scene = components[s.id];
      const last = i === scenes.length - 1;
      const duration = s.duration + (last ? 0 : FADE);
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={duration} name={`${i + 1}. ${s.title}`}>
          <SoftScene duration={duration} fade={FADE} first={i === 0} last={last}>
            <Scene />
          </SoftScene>
        </Sequence>
      );
    })}
    <AbsoluteFill>
      <BigSubtitles />
    </AbsoluteFill>
    <Sound />
  </Paper>
);

export const simpleDuration = totalFrames;
