import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, clamp, Column, Counter, easeInOut, Headline, Kicker, prog } from "../components/primitives";
import { fmtUSD, price, priceMovePct } from "../data/content";
import { beat } from "../data/timeline";
import { colors, fonts } from "../theme";

const W = 936;
const H = 560;
const PAD = { l: 112, r: 30, t: 30, b: 50 };
const LO = 210;
const HI = 240;
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;
const yOf = (v: number) => PAD.t + plotH - ((v - LO) / (HI - LO)) * plotH;

/** Deterministic illustrative path from start → target. Not historical data. */
const N = 80;
const path = Array.from({ length: N + 1 }).map((_, i) => {
  const t = i / N;
  const trend = price.start + (price.target - price.start) * (t * t * (3 - 2 * t));
  const wiggle = 0; // a clean, smooth rise: this shows the idea, not a real price history
  return { x: PAD.l + t * plotW, y: yOf(trend + wiggle) };
});

export const S6Price: React.FC = () => {
  const f = useCurrentFrame();
  const move = beat("price", "move");
  const land = beat("price", "land");
  const p = interpolate(f, [move, Math.max(move + 30, land)], [0, 1], { ...clamp, easing: easeInOut });
  const shown = Math.max(1, Math.round(p * N));
  const pts = path.slice(0, shown + 1);
  const head = pts[pts.length - 1];
  const line = pts.map((q) => `${q.x},${q.y}`).join(" ");
  const area = `${PAD.l},${PAD.t + plotH} ${line} ${head.x},${PAD.t + plotH}`;
  const landed = prog(f, land, 18);
  const axisIn = prog(f, 6, 24);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>The investment idea</Kicker>
        <Headline text="If the price rises 8%…" accent={["8%…"]} delay={8} size={92} />
      </Column>

      {/* Price ticker */}
      <div style={{ position: "absolute", left: 72, right: 72, top: 520, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: fonts.mono, fontSize: 24, letterSpacing: 3, color: colors.muted, textTransform: "uppercase" }}>NVDA · price per share</div>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 112, color: colors.text, lineHeight: 1.05, letterSpacing: -2 }}>
            <Counter from={price.start} to={price.target} start={move} dur={land - move} format={(n) => fmtUSD(n, 2)} />
          </div>
        </div>
        <div
          style={{
            marginBottom: 18,
            padding: "12px 26px",
            borderRadius: 100,
            background: interpolate(landed, [0, 1], [0, 1]) > 0.5 ? colors.green : `${colors.green}22`,
            color: landed > 0.5 ? "#0b1200" : colors.greenBright,
            fontFamily: fonts.mono,
            fontWeight: 700,
            fontSize: 34,
            opacity: prog(f, move, 12),
          }}
        >
          ▲ <Counter to={priceMovePct} start={move} dur={land - move} format={(n) => `${n.toFixed(2)}%`} />
        </div>
      </div>

      <svg width={W} height={H} style={{ position: "absolute", left: 72, top: 720, overflow: "visible" }}>
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.green} stopOpacity={0.35} />
            <stop offset="100%" stopColor={colors.green} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[210, 220, 230, 240].map((v) => (
          <g key={v} opacity={axisIn}>
            <line x1={PAD.l} x2={PAD.l + plotW} y1={yOf(v)} y2={yOf(v)} stroke={colors.line} />
            <text x={PAD.l - 16} y={yOf(v) + 8} textAnchor="end" fontFamily={fonts.mono} fontSize={24} fill={colors.muted}>
              ${v}
            </text>
          </g>
        ))}
        {/* Reference lines: entry and target */}
        <line x1={PAD.l} x2={PAD.l + plotW} y1={yOf(price.start)} y2={yOf(price.start)} stroke="#c9cdc9" strokeOpacity={0.5} strokeDasharray="8 10" opacity={axisIn} />
        <text x={PAD.l + plotW} y={yOf(price.start) + 36} textAnchor="end" fontFamily={fonts.mono} fontSize={22} fill={colors.muted} opacity={axisIn}>
          ENTRY {fmtUSD(price.start, 2)}
        </text>
        <line x1={PAD.l} x2={PAD.l + plotW} y1={yOf(price.target)} y2={yOf(price.target)} stroke={colors.green} strokeOpacity={0.7} strokeDasharray="8 10" opacity={landed} />
        <text x={PAD.l + 8} y={yOf(price.target) - 16} fontFamily={fonts.mono} fontSize={22} fill={colors.greenBright} opacity={landed}>
          TARGET {fmtUSD(price.target, 2)} (+{priceMovePct}%)
        </text>
        <polygon points={area} fill="url(#area)" />
        <polyline points={line} fill="none" stroke={colors.green} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={head.x} cy={head.y} r={22 + Math.sin(f / 4) * 4} fill={colors.green} opacity={0.25} />
        <circle cx={head.x} cy={head.y} r={10} fill={colors.white} stroke={colors.green} strokeWidth={4} />
        <text x={PAD.l + plotW / 2} y={H + 10} textAnchor="middle" fontFamily={fonts.display} fontWeight={700} fontSize={44} fill={colors.greenBright} opacity={prog(f, beat("price", "gain"), 16)}>
          +{fmtUSD(price.target - price.start, 2)} on every share
        </text>
      </svg>
    </AbsoluteFill>
  );
};
