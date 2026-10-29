/**
 * Visual kit for the "simple" cut: a colourful, hand-drawn storybook explainer on blue paper
 * (big serif titles with gold highlights, bright cartoon art), built to be calm and easy to read.
 * Everything moves slowly on purpose.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const P = {
  navy: "#2F5C93",
  navyDeep: "#1C3A66",
  frame: "#BFE0F2",
  cream: "#FFF8EA",
  creamDim: "#D9E6F2",
  red: "#F0584A",
  green: "#8CC63F", // NVIDIA-family green
  gold: "#FFC94A",
  orange: "#F59A3C",
  sky: "#6EC6EC",
  purple: "#B27AD6",
  panel: "#24497A",
  skin: "#F0C7A2",
  ink: "#13233F",
};

export const F = {
  serif: "'Playfair Display', Georgia, serif",
  hand: "'Patrick Hand', 'Caveat', cursive",
  sans: "Inter, sans-serif",
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.33, 1, 0.68, 1);
/** Global slow-down for every entrance/stroke so nothing feels rushed. */
export const SLOW = 1.6;
export const p01 = (f: number, from: number, dur: number) => interpolate(f, [from, from + dur * SLOW], [0, 1], { ...clamp, easing: ease });

/** Navy paper with texture, vignette and the pale double frame from the reference look. */
export const Paper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: `radial-gradient(1200px 1500px at 50% 35%, #3E72AE, ${P.navy} 45%, ${P.navyDeep} 95%)` }}>
    <AbsoluteFill style={{ opacity: 0.16, mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%">
        <filter id="paper">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} seed={7} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#paper)" />
      </svg>
    </AbsoluteFill>
    {children}
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 26, border: `6px solid ${P.frame}`, opacity: 0.85 }} />
      <div style={{ position: "absolute", inset: 44, border: `2px solid ${P.frame}`, opacity: 0.7 }} />
    </AbsoluteFill>
    <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 85% 75% at 50% 45%, transparent 65%, rgba(10,25,50,0.35))" }} />
  </AbsoluteFill>
);

/** Gentle fade between scenes — no fast moves. */
export const SoftScene: React.FC<{ duration: number; fade: number; first?: boolean; last?: boolean; children: React.ReactNode }> = ({
  duration,
  fade,
  first,
  last,
  children,
}) => {
  const f = useCurrentFrame();
  const a = first ? 1 : interpolate(f, [0, fade], [0, 1], clamp);
  const b = last ? 1 : interpolate(f, [duration - fade, duration], [1, 0], clamp);
  const drift = interpolate(f, [0, duration], [1.0, 1.025]);
  return <AbsoluteFill style={{ opacity: Math.min(a, b), transform: `scale(${drift})` }}>{children}</AbsoluteFill>;
};

/** Big serif title with an optional small spaced-caps line above it, like a book cover. */
export const Title: React.FC<{ kicker?: string; children: React.ReactNode; at?: number; size?: number; top?: number; gold?: string[] }> = ({
  kicker,
  children,
  at = 0,
  size = 96,
  top = 150,
  gold = [],
}) => {
  const f = useCurrentFrame();
  const a = p01(f, at, 24);
  const content =
    typeof children === "string" && gold.length
      ? children.split(" ").map((w, i) => (
          <span key={i} style={{ color: gold.includes(w.replace(/[^\w$%]/g, "")) ? P.gold : undefined }}>
            {w}{" "}
          </span>
        ))
      : children;
  return (
    <div style={{ position: "absolute", top, left: 90, right: 90, textAlign: "center", opacity: a, transform: `translateY(${(1 - a) * 20}px)` }}>
      {kicker && (
        <div style={{ fontFamily: F.serif, fontWeight: 700, fontSize: 36, letterSpacing: 9, color: P.sky, textTransform: "uppercase", marginBottom: 14 }}>
          {kicker}
        </div>
      )}
      <div style={{ fontFamily: F.serif, fontWeight: 900, fontSize: size, lineHeight: 1.04, color: P.cream, textShadow: "0 4px 0 rgba(0,0,0,0.25)" }}>{content}</div>
    </div>
  );
};

/** Hand-lettered label. */
export const Hand: React.FC<{ children: React.ReactNode; at?: number; size?: number; color?: string; style?: React.CSSProperties }> = ({
  children,
  at = 0,
  size = 48,
  color = P.cream,
  style,
}) => {
  const f = useCurrentFrame();
  const a = p01(f, at, 18);
  return <div style={{ fontFamily: F.hand, fontSize: size, color, lineHeight: 1.1, opacity: a, ...style }}>{children}</div>;
};

/** An SVG path that draws itself like a pen stroke. Use inside an <svg>. */
export const Draw: React.FC<{
  d: string;
  at: number;
  dur?: number;
  color?: string;
  width?: number;
  fill?: string;
  dash?: string;
}> = ({ d, at, dur = 24, color = P.cream, width = 6, fill = "none", dash }) => {
  const f = useCurrentFrame();
  const t = p01(f, at, dur);
  if (dash) {
    return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={dash} opacity={t > 0 ? 1 : 0} style={{ clipPath: `inset(0 ${100 - t * 100}% 0 0)` }} />;
  }
  return (
    <>
      {fill !== "none" && <path d={d} fill={fill} opacity={interpolate(t, [0.6, 1], [0, 1], clamp)} />}
      <path
        d={d}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1 1"
        strokeDashoffset={1 - t}
      />
    </>
  );
};

/** Springy-but-calm entrance for any element. */
export const Pop: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; from?: number }> = ({ at, children, style, from = 0.85 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 30, mass: 1.8 } });
  return <div style={{ opacity: Math.min(1, s * 1.4), transform: `scale(${from + (1 - from) * s})`, ...style }}>{children}</div>;
};

/** A cartoon person in simple flat shapes. Coordinates are the feet position; ~300px tall at scale 1. */
export const Person: React.FC<{
  x: number;
  y: number;
  scale?: number;
  coat?: string;
  hair?: string;
  hat?: boolean;
  glasses?: boolean;
  cane?: boolean;
  bag?: boolean;
  walk?: number; // phase in radians; undefined = standing
  flip?: boolean;
  arm?: "down" | "up" | "hold";
  bald?: boolean;
}> = ({ x, y, scale = 1, coat = "#7a5a3c", hair = "#3b2b20", hat, glasses, cane, bag, walk, flip, arm = "down", bald }) => {
  const sw = walk === undefined ? 0 : Math.sin(walk) * 22;
  const bob = walk === undefined ? 0 : Math.abs(Math.cos(walk)) * 4;
  const line = { stroke: P.ink, strokeWidth: 5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <g transform={`translate(${x} ${y - bob}) scale(${flip ? -scale : scale} ${scale})`}>
      {/* legs */}
      <g transform={`rotate(${sw} 0 -120)`}>
        <path d="M-6 -120 L-10 -10" {...line} strokeWidth={16} stroke="#3c3f46" />
        <path d="M-22 -4 L2 -4" {...line} strokeWidth={12} />
      </g>
      <g transform={`rotate(${-sw} 0 -120)`}>
        <path d="M8 -120 L10 -10" {...line} strokeWidth={16} stroke="#4a4e57" />
        <path d="M-2 -4 L24 -4" {...line} strokeWidth={12} />
      </g>
      {bag && <rect x={-46} y={-224} width={30} height={70} rx={8} fill="#5b4632" stroke={P.ink} strokeWidth={4} />}
      {/* body */}
      <path d="M-30 -120 L-26 -210 Q0 -228 26 -210 L30 -120 Z" fill={coat} stroke={P.ink} strokeWidth={4} />
      {/* arms */}
      {arm === "up" ? (
        <path d="M24 -204 L56 -250" {...line} strokeWidth={12} stroke={coat} />
      ) : arm === "hold" ? (
        <path d="M24 -204 L40 -160 L64 -170" {...line} strokeWidth={12} stroke={coat} />
      ) : (
        <path d={`M24 -204 L${30 - sw * 0.6} -140`} {...line} strokeWidth={12} stroke={coat} />
      )}
      <path d={`M-24 -204 L${-30 + sw * 0.6} -140`} {...line} strokeWidth={12} stroke={coat} />
      {cane && <path d="M44 -150 L52 -2 M44 -150 q-14 -8 -20 4" {...line} strokeWidth={6} stroke="#8a6a4a" />}
      {/* head */}
      <path d="M-8 -226 L-8 -214 L8 -214 L8 -226" fill={P.skin} />
      <circle cx={0} cy={-252} r={30} fill={P.skin} stroke={P.ink} strokeWidth={4} />
      {!bald && <path d="M-30 -256 Q-28 -288 0 -286 Q28 -288 30 -256 Q14 -270 -30 -256 Z" fill={hair} />}
      {bald && <path d="M-30 -250 Q-30 -262 -24 -266 M30 -250 Q30 -262 24 -266" stroke={hair} strokeWidth={8} fill="none" />}
      <circle cx={10} cy={-254} r={3.5} fill={P.ink} />
      <path d="M2 -238 Q10 -232 18 -238" stroke={P.ink} strokeWidth={3} fill="none" strokeLinecap="round" />
      {glasses && <path d="M-2 -256 h12 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M-2 -256 a6 6 0 1 1 -12 0" stroke={P.ink} strokeWidth={3} fill="none" />}
      {hat && (
        <g>
          <path d="M-42 -272 Q0 -264 42 -272" stroke={P.ink} strokeWidth={4} fill="#6b4b2e" />
          <path d="M-26 -272 Q-24 -306 0 -306 Q24 -306 26 -272 Z" fill="#6b4b2e" stroke={P.ink} strokeWidth={4} />
        </g>
      )}
    </g>
  );
};

/** Paper-cut style coin/bill stack used for money visuals. */
export const Bills: React.FC<{ x: number; y: number; n: number; color?: string; w?: number }> = ({ x, y, n, color = P.green, w = 150 }) => (
  <g>
    {Array.from({ length: n }).map((_, i) => (
      <g key={i} transform={`translate(${x} ${y - i * 16})`}>
        <rect x={-w / 2} y={-14} width={w} height={22} rx={4} fill={color} stroke={P.ink} strokeWidth={3} />
        <circle cx={0} cy={-3} r={7} fill="none" stroke={P.ink} strokeWidth={2} opacity={0.5} />
      </g>
    ))}
  </g>
);
