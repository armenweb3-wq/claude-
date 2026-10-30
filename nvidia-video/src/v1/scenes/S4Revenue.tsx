import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, clamp, Column, ComplianceStrip, easeOut, Headline, Kicker, prog } from "../components/primitives";
import { revenue, revenueGrowth } from "../data/content";
import { beat } from "../data/timeline";
import { colors, fonts } from "../theme";

// Chart geometry (px, inside an absolutely positioned SVG).
const W = 936;
const H = 700;
const PAD = { l: 92, r: 24, t: 70, b: 70 };
const MAX = 100; // y-axis max in $B — axis starts at zero so bar heights are honest.
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;
const yOf = (v: number) => PAD.t + plotH - (v / MAX) * plotH;

export const S4Revenue: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const starts = [beat("revenue", "q1"), beat("revenue", "q2"), beat("revenue", "q3")];
  const axisIn = prog(f, 8, 30);
  const slot = plotW / revenue.length;
  const barW = 168;
  const tops = revenue.map((q, i) => {
    const g = spring({ frame: f - starts[i], fps, config: { damping: 200, mass: 1.1 }, durationInFrames: 34 });
    return { x: PAD.l + slot * i + slot / 2, h: g, y: yOf(q.value * g), g };
  });
  const lineP = prog(f, starts[2] + 30, 30);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>Quarterly revenue · USD</Kicker>
        <Headline text="And the numbers show it." accent={["numbers"]} delay={8} size={92} />
      </Column>
      <svg width={W} height={H} style={{ position: "absolute", left: 72, top: 560, overflow: "visible" }}>
        <defs>
          <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.greenBright} />
            <stop offset="100%" stopColor={colors.greenDeep} />
          </linearGradient>
          <linearGradient id="barDim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4d5a3a" />
            <stop offset="100%" stopColor="#1f2618" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v} opacity={axisIn}>
            <line x1={PAD.l} x2={PAD.l + plotW * axisIn} y1={yOf(v)} y2={yOf(v)} stroke={v === 0 ? "#6b716e" : colors.line} strokeWidth={v === 0 ? 2 : 1} />
            <text x={PAD.l - 18} y={yOf(v) + 9} textAnchor="end" fontFamily={fonts.mono} fontSize={24} fill={colors.muted}>
              ${v}B
            </text>
          </g>
        ))}
        {revenue.map((q, i) => {
          const t = tops[i];
          const latest = i === revenue.length - 1;
          const bh = (q.value / MAX) * plotH * t.h;
          return (
            <g key={q.label}>
              <rect
                x={t.x - barW / 2}
                y={PAD.t + plotH - bh}
                width={barW}
                height={bh}
                rx={10}
                fill={latest ? "url(#bar)" : "url(#barDim)"}
                style={{ filter: latest ? `drop-shadow(0 0 30px ${colors.green}88)` : undefined }}
              />
              <text
                x={t.x}
                y={PAD.t + plotH - bh - 22}
                textAnchor="middle"
                fontFamily={fonts.display}
                fontWeight={700}
                fontSize={48}
                fill={latest ? colors.greenBright : colors.text}
                opacity={interpolate(t.g, [0.05, 0.3], [0, 1], clamp)}
              >
                {`$${(q.value * Math.min(1, t.g)).toFixed(1)}B`}
              </text>
              <text x={t.x} y={PAD.t + plotH + 46} textAnchor="middle" fontFamily={fonts.mono} fontSize={24} fill={colors.muted} opacity={axisIn}>
                {q.label}
              </text>
            </g>
          );
        })}
        {/* Growth trend line across bar tops */}
        <polyline
          points={revenue.map((q, i) => `${tops[i].x},${yOf(q.value) - 104}`).join(" ")}
          fill="none"
          stroke={colors.green}
          strokeWidth={3}
          strokeDasharray={1200}
          strokeDashoffset={1200 * (1 - lineP)}
          opacity={0.8}
        />
      </svg>
      {/* Quarter-over-quarter growth chips */}
      <div style={{ position: "absolute", left: 72, right: 72, top: 1262, display: "flex", justifyContent: "center", gap: 28 }}>
        {revenueGrowth.map((g, i) => {
          const p = prog(f, starts[i + 1] + 20, 20, easeOut);
          return (
            <div
              key={i}
              style={{
                opacity: p,
                transform: `translateY(${(1 - p) * 20}px)`,
                padding: "12px 24px",
                borderRadius: 100,
                border: `1px solid ${colors.green}66`,
                background: `${colors.green}14`,
                fontFamily: fonts.mono,
                fontSize: 26,
                color: colors.text,
              }}
            >
              <span style={{ color: colors.greenBright }}>▲ {g.toFixed(1)}%</span> {revenue[i].label.replace("Quarter ", "Q")}→{revenue[i + 1].label.replace("Quarter ", "Q")}
            </div>
          );
        })}
      </div>
      <ComplianceStrip text="Figures as supplied · verify against NVIDIA filings" delay={20} />
    </AbsoluteFill>
  );
};
