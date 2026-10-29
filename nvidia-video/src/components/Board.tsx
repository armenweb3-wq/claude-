import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { fmtUSD, positions, revenue } from "../data/content";
import { scenes } from "../data/timeline";
import { colors, fonts } from "../theme";
import { Portrait } from "./Portrait";
import { clamp, easeInOut } from "./primitives";

/**
 * "Connect the dots" evidence board. Every scene is a pinned card on one big board; between scenes
 * the camera pulls back, a string is drawn from the last card to the next, and the camera dives into it.
 */
const BW = 2200;
const BH = 3400;
const CARD_W = 520;
const CARD_H = 400;

type NodeDef = { id: string; title: string; Thumb: React.FC };

const Bars: React.FC = () => (
  <svg viewBox="0 0 240 130" width="100%" height="100%">
    {revenue.map((q, i) => (
      <rect key={i} x={30 + i * 70} y={120 - q.value} width={46} height={q.value} rx={4} fill={i === 2 ? colors.green : "#4d5a3a"} />
    ))}
    <text x={120} y={18} textAnchor="middle" fontFamily={fonts.display} fontWeight={800} fontSize={20} fill={colors.text}>
      ${revenue[2].value}B
    </text>
  </svg>
);
const Grid: React.FC = () => (
  <svg viewBox="0 0 240 130" width="100%" height="100%">
    {Array.from({ length: 12 * 6 }).map((_, i) => (
      <rect key={i} x={12 + (i % 12) * 18.5} y={12 + Math.floor(i / 12) * 18.5} width={14} height={14} rx={2} fill={colors.green} opacity={0.3 + random(i) * 0.7} />
    ))}
  </svg>
);
const Racks: React.FC = () => (
  <svg viewBox="0 0 240 130" width="100%" height="100%">
    {[-1, 1].map((s) =>
      Array.from({ length: 5 }).map((_, i) => {
        const x0 = 120 + s * (110 - i * 18);
        const x1 = 120 + s * (110 - (i + 1) * 18);
        return <polygon key={`${s}${i}`} points={`${x0},${10 + i * 9} ${x1},${10 + (i + 1) * 9} ${x1},${120 - (i + 1) * 9} ${x0},${120 - i * 9}`} fill="#151a17" stroke={colors.green} strokeOpacity={0.6} />;
      }),
    )}
    <circle cx={120} cy={65} r={16} fill={colors.green} opacity={0.6} />
  </svg>
);
const Hub: React.FC = () => (
  <svg viewBox="0 0 240 130" width="100%" height="100%">
    {[0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      return (
        <g key={i}>
          <line x1={120} y1={65} x2={120 + Math.cos(a) * 85} y2={65 + Math.sin(a) * 50} stroke={colors.green} strokeWidth={2} />
          <circle cx={120 + Math.cos(a) * 85} cy={65 + Math.sin(a) * 50} r={9} fill="#2a2e2f" stroke={colors.green} />
        </g>
      );
    })}
    <circle cx={120} cy={65} r={18} fill={colors.green} />
  </svg>
);
const Line: React.FC = () => (
  <svg viewBox="0 0 240 130" width="100%" height="100%">
    <polyline points="10,110 50,100 80,104 120,80 150,70 190,40 230,22" fill="none" stroke={colors.green} strokeWidth={5} strokeLinejoin="round" />
    <text x={20} y={34} fontFamily={fonts.display} fontWeight={800} fontSize={30} fill={colors.greenBright}>
      +8%
    </text>
  </svg>
);
const Chat: React.FC = () => (
  <svg viewBox="0 0 240 130" width="100%" height="100%">
    <rect x={70} y={16} width={150} height={38} rx={14} fill={colors.green} />
    <rect x={20} y={66} width={170} height={46} rx={14} fill="#2a2e2f" />
    <text x={30} y={95} fontFamily={fonts.body} fontSize={16} fill={colors.text}>
      Of course, step by step…
    </text>
  </svg>
);
const Money: React.FC<{ i: number }> = ({ i }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 4 }}>
    <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 46, color: colors.text }}>{fmtUSD(positions[i].capital)}</div>
    <div style={{ fontFamily: fonts.hand, fontSize: 40, color: colors.muted }}>↓ +8%, ≈{positions[i].leverage.toFixed(1)}×</div>
    <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 54, color: colors.greenBright }}>{fmtUSD(positions[i].grossProfit, 2)}</div>
  </div>
);
const FounderThumb: React.FC = () => (
  <div style={{ position: "relative", width: "100%", height: "100%" }}>
    <Portrait grade="duotone" label={false} />
  </div>
);
const svgThumb = (C: React.FC) => () => (
  <div style={{ width: "100%", height: "100%", padding: 18 }}>
    <C />
  </div>
);

const NODES: NodeDef[] = [
  { id: "founder", title: "The founder, 1993", Thumb: FounderThumb },
  { id: "intro", title: "AI everywhere", Thumb: svgThumb(Chat) },
  { id: "gpu", title: "GPUs: game chips → AI", Thumb: svgThumb(Grid) },
  { id: "datacenter", title: "AI data centers", Thumb: svgThumb(Racks) },
  { id: "revenue", title: "Revenue climbing", Thumb: svgThumb(Bars) },
  { id: "partners", title: "Partners + earnings", Thumb: svgThumb(Hub) },
  { id: "price", title: "Scenario: +8%", Thumb: svgThumb(Line) },
  { id: "invest", title: "Your $25K", Thumb: () => <Money i={0} /> },
  { id: "split", title: "Scaled to $50K", Thumb: () => <Money i={1} /> },
];
const LINKS = ["", "games → AI", "AI needs GPUs", "chips → data centers", "demand → revenue", "momentum → catalyst", "catalyst → price", "price → you", "scale it up"];

const nodePos = (i: number) => ({ x: i % 2 === 0 ? 640 : 1560, y: 420 + i * 320 });
const rot = (i: number) => (random(`rot${i}`) - 0.5) * 6;

const Card: React.FC<{ i: number; lit: number }> = ({ i, lit }) => {
  const n = NODES[i];
  const p = nodePos(i);
  return (
    <div
      style={{
        position: "absolute",
        left: p.x - CARD_W / 2,
        top: p.y - CARD_H / 2,
        width: CARD_W,
        height: CARD_H,
        transform: `rotate(${rot(i)}deg)`,
        background: "#e9ebe6",
        borderRadius: 6,
        padding: 16,
        boxShadow: `0 24px 50px rgba(0,0,0,0.6), 0 0 ${60 * lit}px ${colors.green}aa`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ flex: 1, background: colors.charcoal, borderRadius: 3, overflow: "hidden", position: "relative" }}>
        <n.Thumb />
      </div>
      <div style={{ fontFamily: fonts.hand, fontWeight: 700, fontSize: 52, color: "#121412", textAlign: "center", lineHeight: 1 }}>{n.title}</div>
      <div
        style={{
          position: "absolute",
          top: -14,
          left: CARD_W / 2 - 16,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 35%, ${colors.greenBright}, ${colors.greenDeep})`,
          boxShadow: "0 6px 10px rgba(0,0,0,0.6)",
        }}
      />
    </div>
  );
};

const stringPath = (a: number, b: number) => {
  const p = nodePos(a);
  const q = nodePos(b);
  const y0 = p.y - CARD_H / 2 + 2;
  const y1 = q.y - CARD_H / 2 + 2;
  const sag = 120;
  return `M${p.x} ${y0} Q ${(p.x + q.x) / 2} ${(y0 + y1) / 2 + sag} ${q.x} ${y1}`;
};

/** Board seen through a camera. `strings` = how many links are drawn (fractional = drawing). */
const BoardView: React.FC<{ cx: number; cy: number; zoom: number; strings: number; lit: number }> = ({ cx, cy, zoom, strings, lit }) => (
  <AbsoluteFill style={{ background: "#0b0d0c", overflow: "hidden" }}>
    <div
      style={{
        position: "absolute",
        width: BW,
        height: BH,
        left: 0,
        top: 0,
        transformOrigin: "0 0",
        transform: `translate(${540 - cx * zoom}px, ${900 - cy * zoom}px) scale(${zoom})`,
        background: `radial-gradient(1400px 1000px at 50% 30%, #1d2420, #0d100e 75%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.25,
          backgroundImage: `linear-gradient(${colors.line} 1px, transparent 1px), linear-gradient(90deg, ${colors.line} 1px, transparent 1px)`,
          backgroundSize: "110px 110px",
        }}
      />
      {NODES.map((_, i) => (
        <Card key={i} i={i} lit={i === lit ? 1 : 0} />
      ))}
      <svg width={BW} height={BH} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {NODES.slice(1).map((_, k) => {
          const amt = interpolate(strings - k, [0, 1], [0, 1], clamp);
          if (amt <= 0) return null;
          const a = nodePos(k);
          const b = nodePos(k + 1);
          return (
            <g key={k}>
              <path d={stringPath(k, k + 1)} fill="none" stroke={colors.green} strokeWidth={6} strokeDasharray={1400} strokeDashoffset={1400 * (1 - amt)} style={{ filter: `drop-shadow(0 0 10px ${colors.green})` }} />
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - CARD_H / 2 + 150}
                textAnchor="middle"
                fontFamily={fonts.hand}
                fontWeight={700}
                fontSize={54}
                fill={colors.greenBright}
                opacity={interpolate(amt, [0.6, 1], [0, 1], clamp)}
              >
                {LINKS[k + 1]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  </AbsoluteFill>
);

const ZOOM_IN = 2.0;
const HALF = 16; // frames either side of a scene boundary
const FINAL_HALF = 30;

/**
 * Transition overlay. Around each scene boundary it covers the cut with the board: the camera
 * leaves the previous card, a string draws to the next card, and the camera dives into it.
 * The final boundary (into the disclaimer) pulls back to show every connected dot.
 */
export const BoardTransitions: React.FC = () => {
  const f = useCurrentFrame();
  for (let k = 1; k < scenes.length; k++) {
    const b = scenes[k].from;
    const last = k === scenes.length - 1;
    const half = last ? FINAL_HALF : HALF;
    if (f < b - half || f > b + half) continue;
    const t = interpolate(f, [b - half, b + half], [0, 1], { ...clamp, easing: easeInOut });
    const opacity = Math.min(interpolate(f, [b - half, b - half + 6], [0, 1], clamp), interpolate(f, [b + half - 7, b + half], [1, 0], clamp));
    const from = nodePos(k - 1);
    if (last) {
      const fit = { x: BW / 2, y: BH / 2 - 120, z: 0.46 };
      const m = interpolate(t, [0, 0.6], [0, 1], clamp);
      return (
        <AbsoluteFill style={{ opacity }}>
          <BoardView cx={from.x + (fit.x - from.x) * m} cy={from.y + (fit.y - from.y) * m} zoom={ZOOM_IN + (fit.z - ZOOM_IN) * m} strings={NODES.length - 1} lit={-1} />
        </AbsoluteFill>
      );
    }
    const to = nodePos(k);
    const bump = Math.sin(Math.PI * t);
    const zoom = ZOOM_IN - (ZOOM_IN - 0.62) * bump;
    return (
      <AbsoluteFill style={{ opacity }}>
        <BoardView
          cx={from.x + (to.x - from.x) * t}
          cy={from.y + (to.y - from.y) * t}
          zoom={zoom}
          strings={k - 1 + interpolate(t, [0.2, 0.7], [0, 1], clamp)}
          lit={t > 0.7 ? k : -1}
        />
      </AbsoluteFill>
    );
  }
  return null;
};
