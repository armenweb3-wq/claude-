import React from "react";
import { AbsoluteFill, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Body, Column, Headline, Kicker, prog } from "../components/primitives";
import { beat } from "../data/timeline";
import { colors, fonts } from "../theme";

/** Line-art shovel. */
export const ShovelIcon: React.FC<{ size?: number; color?: string }> = ({ size = 300, color = colors.gold }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M50 8 V62" stroke={color} strokeWidth={5} strokeLinecap="round" />
    <path d="M40 8 H60" stroke={color} strokeWidth={5} strokeLinecap="round" />
    <path d="M36 62 H64 V76 Q50 96 36 76 Z" fill={`${color}33`} stroke={color} strokeWidth={4} strokeLinejoin="round" />
  </svg>
);

/** Line-art GPU chip. */
export const ChipIcon: React.FC<{ size?: number }> = ({ size = 300 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    {[30, 42, 54, 66].map((x) => (
      <path key={x} d={`M${x + 2} 14 v-8 M${x + 2} 86 v8 M14 ${x + 2} h-8 M86 ${x + 2} h8`} stroke={colors.green} strokeWidth={3.5} strokeLinecap="round" />
    ))}
    <rect x={14} y={14} width={72} height={72} rx={8} fill={`${colors.green}22`} stroke={colors.green} strokeWidth={4} />
    <rect x={30} y={30} width={40} height={40} rx={4} fill={colors.green} />
    <text x={50} y={55} textAnchor="middle" fontFamily={fonts.display} fontWeight={800} fontSize={11} fill={colors.ink}>
      GPU
    </text>
  </svg>
);

const Nugget: React.FC<{ x: number; y: number; r: number; t: number }> = ({ x, y, r, t }) => (
  <g opacity={t}>
    <circle cx={x} cy={y} r={r * 2.4} fill={colors.gold} opacity={0.12} />
    <path d={`M${x - r} ${y} L${x - r * 0.3} ${y - r * 0.9} L${x + r * 0.8} ${y - r * 0.6} L${x + r} ${y + r * 0.3} L${x + r * 0.2} ${y + r} L${x - r * 0.7} ${y + r * 0.7} Z`} fill={colors.gold} />
  </g>
);

const BUYERS = ["Cloud giants", "AI labs", "Big tech"];

export const SWhy: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rush = beat("why", "rush");
  const shovels = beat("why", "shovels");
  const chips = beat("why", "chips");
  const buyers = beat("why", "buyers");
  const rushOut = prog(f, shovels - 10, 14);
  const shovelIn = spring({ frame: f - shovels, fps, config: { damping: 200, mass: 2 } });
  const morph = prog(f, chips, 20);
  const coinsIn = prog(f, shovels + 30, 20);
  const stage = { x: 540, y: 880 };
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>Why NVIDIA matters</Kicker>
        <Headline text="In a gold rush, sell the shovels." accent={["shovels."]} delay={8} size={88} />
      </Column>

      {/* 1. The gold rush: nuggets scattered across the stage */}
      <svg width={1080} height={1920} style={{ position: "absolute", opacity: prog(f, rush, 18) * (1 - rushOut * 0.85) }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <Nugget key={i} x={140 + random(`nx${i}`) * 800} y={640 + random(`ny${i}`) * 520} r={10 + random(`nr${i}`) * 14} t={prog(f, rush + i * 3, 10)} />
        ))}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1210, textAlign: "center", opacity: prog(f, rush + 10, 16) * (1 - rushOut) }}>
        <Body size={42} color={colors.gold}>
          Many people searched for gold…
        </Body>
      </div>

      {/* 2. The shovel seller — then the shovel becomes a chip */}
      <div
        style={{
          position: "absolute",
          left: stage.x - 170,
          top: stage.y - 210,
          width: 340,
          height: 340,
          opacity: shovelIn,
          transform: `scale(${0.8 + shovelIn * 0.2})`,
        }}
      >
        <div style={{ position: "absolute", inset: 0, opacity: 1 - morph, transform: `rotate(${-morph * 90}deg) scale(${1 - morph * 0.4})` }}>
          <ShovelIcon size={340} />
        </div>
        <div style={{ position: "absolute", inset: 0, opacity: morph, transform: `rotate(${(1 - morph) * 90}deg) scale(${0.6 + morph * 0.4})` }}>
          <ChipIcon size={340} />
        </div>
      </div>
      {/* coins rising from the shovel seller */}
      <svg width={1080} height={1920} style={{ position: "absolute", opacity: coinsIn * (1 - morph) }}>
        {Array.from({ length: 6 }).map((_, i) => {
          const t = ((f - shovels + i * 12) % 60) / 60;
          return (
            <g key={i} opacity={1 - t}>
              <circle cx={stage.x + 190 + (i % 3) * 40} cy={stage.y + 40 - t * 200} r={20} fill={colors.gold} />
              <text x={stage.x + 190 + (i % 3) * 40} y={stage.y + 48 - t * 200} textAnchor="middle" fontFamily={fonts.display} fontWeight={800} fontSize={22} fill={colors.ink}>
                $
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: 72, right: 72, top: 1150, textAlign: "center" }}>
        <div style={{ position: "relative", height: 70 }}>
          <div style={{ position: "absolute", inset: 0, opacity: shovelIn * (1 - morph) }}>
            <Body size={44} color={colors.text}>
              …but the <span style={{ color: colors.gold }}>shovel sellers</span> did well.
            </Body>
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: morph }}>
            <Body size={44} color={colors.text}>
              NVIDIA sells the <span style={{ color: colors.greenBright }}>shovels of AI: the chips</span>
            </Body>
          </div>
        </div>
      </div>

      {/* 3. The buyers stream towards the chip */}
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        {BUYERS.map((_, i) => {
          const x = 220 + i * 320;
          const p = prog(f, buyers + i * 8, 20);
          return (
            <path
              key={i}
              d={`M${x} 1262 Q ${(x + stage.x) / 2} ${1150} ${stage.x} ${stage.y + 150}`}
              fill="none"
              stroke={colors.green}
              strokeWidth={4}
              strokeDasharray="6 10"
              strokeDashoffset={-f * 1.5}
              opacity={p}
            />
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: 60, right: 60, top: 1262, display: "flex", justifyContent: "space-between" }}>
        {BUYERS.map((b, i) => {
          const s = spring({ frame: f - buyers - i * 8, fps, config: { damping: 200, mass: 1.6 } });
          return (
            <div
              key={b}
              style={{
                width: 300,
                textAlign: "center",
                padding: "14px 0",
                borderRadius: 100,
                background: colors.charcoal2,
                border: `2px solid ${colors.green}88`,
                fontFamily: fonts.display,
                fontWeight: 600,
                fontSize: 34,
                color: colors.text,
                opacity: s,
                transform: `translateY(${(1 - s) * 30}px)`,
              }}
            >
              {b}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
