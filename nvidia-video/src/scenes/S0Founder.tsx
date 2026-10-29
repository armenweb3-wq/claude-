import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Portrait } from "../components/Portrait";
import { clamp, Headline, Kicker, prog } from "../components/primitives";
import { founder } from "../data/content";
import { beat } from "../data/timeline";
import { colors, fonts, SAFE } from "../theme";

/** Where the "dots" start: roughly the subject's face in a standard head-and-shoulders portrait. */
const ANCHOR = { x: 540, y: 600 };

const facts = [
  { text: `${founder.founded} · NVIDIA founded`, x: 72, y: 330, align: "left" as const },
  { text: "Graphics chips for games", x: 1008, y: 560, align: "right" as const },
  { text: "Next: the AI era", x: 72, y: 800, align: "left" as const },
];

export const S0Founder: React.FC = () => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const dots = beat("founder", "dots");
  const zoom = interpolate(f, [0, durationInFrames], [1.12, 1.0]);
  const reveal = interpolate(f, [0, 24], [0, 1], clamp);
  const nameIn = spring({ frame: f - 14, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: colors.ink }}>
      {/* Ken Burns portrait */}
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "50% 30%", opacity: reveal, height: 1400 }}>
        <Portrait />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${colors.ink}cc 0%, transparent 18%, transparent 52%, ${colors.ink} 74%)` }} />

      {/* Connect the dots: facts radiate from the founder */}
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        {facts.map((d, i) => {
          const p = prog(f, dots - 18 + i * 8, 20);
          const tx = d.align === "left" ? d.x + 300 : d.x - 300;
          const ty = d.y + 30;
          return (
            <g key={i} opacity={p > 0 ? 1 : 0}>
              <line
                x1={ANCHOR.x}
                y1={ANCHOR.y}
                x2={ANCHOR.x + (tx - ANCHOR.x) * p}
                y2={ANCHOR.y + (ty - ANCHOR.y) * p}
                stroke={colors.green}
                strokeWidth={3}
                strokeDasharray="2 10"
                strokeLinecap="round"
              />
              <circle cx={tx} cy={ty} r={9 * p} fill={colors.green} />
            </g>
          );
        })}
        <circle cx={ANCHOR.x} cy={ANCHOR.y} r={14 * prog(f, dots - 24, 12)} fill="none" stroke={colors.green} strokeWidth={3} />
      </svg>
      {facts.map((d, i) => {
        const s = spring({ frame: f - (dots - 8 + i * 8), fps, config: { damping: 18 } });
        return (
          <div
            key={d.text}
            style={{
              position: "absolute",
              top: d.y,
              ...(d.align === "left" ? { left: d.x } : { right: 1080 - d.x }),
              width: 300,
              display: "flex",
              justifyContent: d.align === "left" ? "flex-start" : "flex-end",
              opacity: s,
              transform: `scale(${0.85 + s * 0.15})`,
            }}
          >
            <div
              style={{
                padding: "12px 20px",
                borderRadius: 14,
                background: "rgba(10,12,11,0.88)",
                border: `1px solid ${colors.green}88`,
                fontFamily: fonts.hand,
                fontWeight: 700,
                fontSize: 38,
                color: colors.text,
                lineHeight: 1.05,
              }}
            >
              {d.text}
            </div>
          </div>
        );
      })}

      {/* Lower third */}
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1040, display: "flex", flexDirection: "column", gap: 18 }}>
        <Kicker delay={8}>The founder</Kicker>
        <Headline text={founder.name} size={118} delay={12} />
        <div
          style={{
            display: "flex",
            gap: 18,
            alignItems: "center",
            opacity: nameIn,
            transform: `translateY(${(1 - nameIn) * 16}px)`,
            fontFamily: fonts.body,
            fontSize: 34,
            color: colors.muted,
          }}
        >
          {founder.role}
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 24,
              color: colors.greenBright,
              border: `1px solid ${colors.green}88`,
              borderRadius: 100,
              padding: "4px 14px",
            }}
          >
            EST. {founder.founded}
          </span>
        </div>
      </div>
      {founder.credit && (
        <div style={{ position: "absolute", right: SAFE.x, top: 1000, fontFamily: fonts.mono, fontSize: 18, color: colors.dim }}>{founder.credit}</div>
      )}
    </AbsoluteFill>
  );
};
