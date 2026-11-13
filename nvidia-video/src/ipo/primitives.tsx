import React from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fonts, SAFE } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 progress between two local frames with a premium ease-out. */
export const prog = (frame: number, from: number, dur: number, ease = easeOut) =>
  interpolate(frame, [from, from + dur], [0, 1], { ...clamp, easing: ease });

/** Cross-dissolve wrapper: fades/defocuses in and out at the scene edges. */
export const SceneShell: React.FC<{ duration: number; overlap: number; children: React.ReactNode; first?: boolean; last?: boolean }> = ({
  duration,
  overlap,
  children,
  first,
  last,
}) => {
  const f = useCurrentFrame();
  const inP = first ? 1 : prog(f, 0, overlap, easeInOut);
  const outP = last ? 0 : interpolate(f, [duration - overlap, duration], [0, 1], { ...clamp, easing: easeInOut });
  const opacity = Math.min(inP, 1 - outP);
  const scale = interpolate(inP, [0, 1], [1.04, 1]) * interpolate(outP, [0, 1], [1, 0.985]);
  const blur = (1 - inP) * 14 + outP * 10;
  return (
    <AbsoluteFill style={{ opacity, transform: `scale(${scale})`, filter: blur > 0.2 ? `blur(${blur}px)` : undefined }}>
      {children}
    </AbsoluteFill>
  );
};

/** Deep black stage with drifting green light and a faint engineering grid. */
export const Backdrop: React.FC<{ glow?: number; grid?: boolean; hue?: string }> = ({ glow = 1, grid = true, hue = colors.orange }) => {
  const f = useCurrentFrame();
  const gx = 62 + Math.sin(f / 140) * 14;
  const gy = 28 + Math.cos(f / 170) * 8;
  const sweep = ((f * 0.35) % 260) - 80; // slow diagonal light sweep, in %
  return (
    <AbsoluteFill style={{ background: colors.ink }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1100px 900px at ${gx}% ${gy}%, ${hue}30, transparent 62%), radial-gradient(900px 700px at ${100 - gx}% 92%, ${hue}1C, transparent 65%), radial-gradient(700px 500px at 8% 60%, #f5efe60A, transparent 70%)`,
          opacity: glow,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(115deg, transparent ${sweep}%, rgba(245,239,230,0.045) ${sweep + 12}%, transparent ${sweep + 24}%)`,
          opacity: glow,
        }}
      />
      {grid && (
        <AbsoluteFill
          style={{
            backgroundImage: `radial-gradient(${colors.line} 1.2px, transparent 1.4px)`,
            backgroundSize: "44px 44px",
            opacity: 0.35,
            maskImage: "radial-gradient(ellipse 75% 65% at 50% 45%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 75% 65% at 50% 45%, black, transparent)",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

/** Animated film grain + vignette + light leak: the "documentary" finish. */
export const FilmFinish: React.FC = () => {
  const f = useCurrentFrame();
  const seed = Math.floor(f / 2) % 12;
  const flicker = 0.92 + random(`flick-${Math.floor(f / 3)}`) * 0.08;
  return (
    <>
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.09 * flicker, mixBlendMode: "overlay" }}>
        <svg width="100%" height="100%">
          <filter id={`grain${seed}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={seed} stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#grain${seed})`} />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill
        style={{ pointerEvents: "none", background: "radial-gradient(ellipse 85% 70% at 50% 45%, transparent 55%, rgba(0,0,0,0.75) 100%)" }}
      />
    </>
  );
};

/** Small green eyebrow label with an animated rule. */
export const Kicker: React.FC<{ children: React.ReactNode; delay?: number; color?: string }> = ({ children, delay = 0, color = colors.green }) => {
  const f = useCurrentFrame();
  const p = prog(f, delay, 24);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
      <div style={{ width: 56 * p, height: 3, background: color, borderRadius: 2 }} />
      <div style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 7, color, textTransform: "uppercase", fontWeight: 500 }}>
        {children}
      </div>
    </div>
  );
};

/** Headline that rises word-by-word out of a mask. `accent` words render in green. */
export const Headline: React.FC<{
  text: string;
  delay?: number;
  size?: number;
  accent?: string[];
  stagger?: number;
  weight?: number;
  align?: "left" | "center";
  lineHeight?: number;
}> = ({ text, delay = 0, size = 92, accent = [], stagger = 3, weight = 700, align = "left", lineHeight = 1.04 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div
      style={{
        fontFamily: fonts.serif,
        fontWeight: weight,
        fontSize: size,
        lineHeight: Math.max(lineHeight, 1.08),
        letterSpacing: -size * 0.012,
        color: colors.text,
        textAlign: align,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        columnGap: size * 0.26,
      }}
    >
      {words.map((w, i) => {
        const s = spring({ frame: f - delay - i * stagger, fps, config: { damping: 200, mass: 0.8 } });
        const clean = w.replace(/[.,!?—]/g, "");
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: size * 0.12, marginBottom: -size * 0.12 }}>
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - s) * 105}%)`,
                color: accent.includes(clean) ? colors.green : undefined,
              }}
            >
              {w}
            </span>
          </span>
        );
      })}
    </div>
  );
};

export const Body: React.FC<{ children: React.ReactNode; delay?: number; size?: number; color?: string; style?: React.CSSProperties }> = ({
  children,
  delay = 0,
  size = 36,
  color = colors.muted,
  style,
}) => {
  const f = useCurrentFrame();
  const p = prog(f, delay, 26);
  return (
    <div
      style={{
        fontFamily: fonts.body,
        fontSize: size,
        lineHeight: 1.4,
        color,
        opacity: p,
        transform: `translateY(${(1 - p) * 18}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Animated number with tabular figures. */
export const Counter: React.FC<{
  from?: number;
  to: number;
  start: number;
  dur?: number;
  format: (n: number) => string;
  style?: React.CSSProperties;
}> = ({ from = 0, to, start, dur = 40, format, style }) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [start, start + dur], [from, to], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{format(v)}</span>;
};

/** Standard content column within the safe zone. */
export const Column: React.FC<{ children: React.ReactNode; top?: number; gap?: number; style?: React.CSSProperties }> = ({
  children,
  top = SAFE.top + 60,
  gap = 34,
  style,
}) => (
  <AbsoluteFill style={{ padding: `${top}px ${SAFE.x}px 0`, display: "flex", flexDirection: "column", gap, ...style }}>{children}</AbsoluteFill>
);

/** Persistent compliance strip shown on every financial scene. */
export const ComplianceStrip: React.FC<{ text?: string; delay?: number }> = ({
  text = "Hypothetical illustration · Not financial advice",
  delay = 6,
}) => {
  const f = useCurrentFrame();
  const p = prog(f, delay, 20);
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.x,
        right: SAFE.x,
        top: SAFE.subtitleTop - 74,
        display: "flex",
        justifyContent: "center",
        opacity: p * 0.9,
      }}
    >
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 21,
          letterSpacing: 2.5,
          color: colors.muted,
          border: `1px solid ${colors.line}`,
          borderRadius: 100,
          padding: "8px 22px",
          textTransform: "uppercase",
          background: "rgba(0,0,0,0.45)",
        }}
      >
        {text}
      </div>
    </div>
  );
};
