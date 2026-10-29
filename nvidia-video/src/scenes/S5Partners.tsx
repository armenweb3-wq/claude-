import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, clamp, Column, Headline, Kicker, prog } from "../components/primitives";
import { earnings, partners } from "../data/content";
import { beat } from "../data/timeline";
import { colors, fonts } from "../theme";

const HUB = { x: 540, y: 600 };
const LIST_TOP = 760;
const ROW = 104;

export const S5Partners: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cat = beat("partners", "catalyst");
  const swap = prog(f, cat - 8, 24);
  const hubIn = spring({ frame: f - 6, fps, config: { damping: 18 } });
  const cardIn = spring({ frame: f - cat, fps, config: { damping: 20, mass: 0.9 } });
  const ring = (f - cat) % 45;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>{swap < 0.5 ? "Commercial partnerships" : "Upcoming catalyst"}</Kicker>
        <div style={{ position: "relative", height: 200 }}>
          <div style={{ position: "absolute", inset: 0, opacity: 1 - prog(f, cat - 12, 8) }}>
            <Headline text="Built into the AI economy." accent={["AI"]} delay={8} size={92} />
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: swap }}>
            <Headline text="Next: the earnings report." accent={["earnings"]} delay={cat} size={92} />
          </div>
        </div>
      </Column>

      {/* Partnership network */}
      <AbsoluteFill style={{ opacity: 1 - swap, filter: swap > 0.02 ? `blur(${swap * 10}px)` : undefined }}>
        <svg width={1080} height={1920} style={{ position: "absolute" }}>
          {partners.map((_, i) => {
            const y = LIST_TOP + i * ROW + 42;
            const p = prog(f, 18 + i * 8, 24);
            const x2 = 150;
            const d = `M${HUB.x} ${HUB.y + 54} C ${HUB.x} ${y - 30}, ${x2 + 200} ${y}, ${x2} ${y}`;
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={colors.green}
                strokeOpacity={0.45}
                strokeWidth={2}
                strokeDasharray={900}
                strokeDashoffset={900 * (1 - p)}
              />
            );
          })}
        </svg>
        <div
          style={{
            position: "absolute",
            left: HUB.x,
            top: HUB.y,
            transform: `translate(-50%,-50%) scale(${hubIn})`,
            padding: "18px 40px",
            borderRadius: 100,
            background: colors.green,
            color: "#0b1200",
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 44,
            letterSpacing: 2,
            boxShadow: `0 0 70px ${colors.green}88`,
          }}
        >
          NVIDIA
        </div>
        {partners.map((p, i) => {
          const s = spring({ frame: f - 22 - i * 8, fps, config: { damping: 20 } });
          return (
            <div
              key={p.title}
              style={{
                position: "absolute",
                left: 150,
                right: 72,
                top: LIST_TOP + i * ROW,
                height: 84,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 30px",
                borderRadius: 20,
                background: "rgba(20,22,23,0.9)",
                border: `1px solid ${colors.line}`,
                opacity: s,
                transform: `translateX(${(1 - s) * 80}px)`,
              }}
            >
              <span style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 36, color: colors.text }}>{p.title}</span>
              <span style={{ fontFamily: fonts.body, fontSize: 24, color: colors.muted }}>{p.sub}</span>
            </div>
          );
        })}
      </AbsoluteFill>

      {/* Earnings catalyst card */}
      <AbsoluteFill style={{ opacity: cardIn, transform: `translateY(${(1 - cardIn) * 100}px)` }}>
        <div
          style={{
            position: "absolute",
            left: 90,
            right: 90,
            top: 600,
            height: 600,
            borderRadius: 40,
            background: `radial-gradient(600px 400px at 50% 0%, ${colors.green}26, transparent 70%), ${colors.charcoal}`,
            border: `1px solid ${colors.green}55`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
          }}
        >
          <div style={{ position: "relative", width: 170, height: 170 }}>
            <div
              style={{
                position: "absolute",
                inset: -ring * 1.4,
                borderRadius: "50%",
                border: `2px solid ${colors.green}`,
                opacity: interpolate(ring, [0, 45], [0.7, 0], clamp),
              }}
            />
            <svg width={170} height={170} viewBox="0 0 24 24">
              <rect x={3} y={5} width={18} height={16} rx={2.5} fill="none" stroke={colors.green} strokeWidth={1.3} />
              <path d="M3 10h18M8 3v4M16 3v4" stroke={colors.green} strokeWidth={1.3} strokeLinecap="round" />
              <path d="M8.5 15.5l2.2 2.2 4.8-4.8" stroke={colors.white} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 58, color: colors.text, textAlign: "center", lineHeight: 1.1 }}>
            {earnings.headline}
          </div>
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: 26,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: colors.greenBright,
              padding: "10px 24px",
              border: `1px solid ${colors.green}66`,
              borderRadius: 100,
            }}
          >
            {earnings.date}
          </div>
          <div style={{ fontFamily: fonts.body, fontSize: 28, color: colors.muted, textAlign: "center", maxWidth: 700, lineHeight: 1.4 }}>
            Results can move the stock sharply — in either direction.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
