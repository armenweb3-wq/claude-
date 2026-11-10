import React from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fonts, H, M, W } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const prog = (f: number, from: number, dur: number, ease = easeOut) => interpolate(f, [from, from + dur], [0, 1], { ...clamp, easing: ease });

export const usd = (n: number, d = 0) => (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const signed = (n: number, d = 0) => (n > 0 ? "+" : "") + usd(n, d);

/** Scene wrapper: pages slide up and fade like sheets being laid on a desk. */
export const Page: React.FC<{ duration: number; overlap: number; first?: boolean; last?: boolean; children: React.ReactNode }> = ({ duration, overlap, first, last, children }) => {
  const f = useCurrentFrame();
  const inP = first ? 1 : prog(f, 0, overlap, easeInOut);
  const outP = last ? 0 : interpolate(f, [duration - overlap, duration], [0, 1], { ...clamp, easing: easeInOut });
  // Incoming sheet glides in from the right and settles; the outgoing one drifts left and softens.
  const x = (1 - inP) * 90 - outP * 70;
  const scale = interpolate(inP, [0, 1], [0.985, 1]) * interpolate(outP, [0, 1], [1, 0.992]);
  const blur = (1 - inP) * 6 + outP * 5;
  return (
    <AbsoluteFill style={{ opacity: Math.min(inP, 1 - outP), transform: `translateX(${x}px) scale(${scale})`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>
      {children}
    </AbsoluteFill>
  );
};

/** Cream paper with grain, a faint dot grid and soft vignette. */
export const Paper: React.FC<{ grid?: "dots" | "graph" | "none" }> = ({ grid = "dots" }) => {
  const f = useCurrentFrame();
  const seed = Math.floor(f / 4) % 9;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${colors.paper}, ${colors.paper2})` }}>
      {grid === "dots" && (
        <AbsoluteFill style={{ backgroundImage: `radial-gradient(${colors.faint} 1.4px, transparent 1.6px)`, backgroundSize: "36px 36px", opacity: 0.7 }} />
      )}
      {grid === "graph" && (
        <AbsoluteFill style={{ backgroundImage: `linear-gradient(${colors.faint} 1px, transparent 1px), linear-gradient(90deg, ${colors.faint} 1px, transparent 1px)`, backgroundSize: "48px 48px", opacity: 0.6 }} />
      )}
      <AbsoluteFill style={{ opacity: 0.16, mixBlendMode: "multiply" }}>
        <svg width="100%" height="100%">
          <filter id={`paper${seed}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#paper${seed})`} />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 75% at 50% 45%, transparent 60%, rgba(60,40,20,0.18) 100%)" }} />
    </AbsoluteFill>
  );
};

/** Persistent running header: stays on screen across page turns, only the page title cross-fades. */
export const Header: React.FC<{ pages: { from: number; duration: number; title: string }[]; period: string }> = ({ pages, period }) => {
  const f = useCurrentFrame();
  const p = prog(f, 4, 18);
  const idx = Math.max(0, pages.findIndex((s) => f >= s.from && f < s.from + s.duration));
  const cur = pages[idx];
  const local = f - cur.from;
  const fadeIn = interpolate(local, [0, 14], [0, 1], clamp);
  const fadeOut = interpolate(local, [cur.duration - 14, cur.duration], [1, 0], clamp);
  return (
    <>
      <div style={{ position: "absolute", left: M, right: M, top: 52, display: "flex", justifyContent: "space-between", alignItems: "baseline", opacity: p, fontFamily: fonts.mono, fontSize: 20, letterSpacing: 3, color: colors.pencil, textTransform: "uppercase" }}>
        <span>Account •••175 · Trade history {period}</span>
        <span style={{ fontFamily: fonts.hand, fontSize: 34, letterSpacing: 0, textTransform: "none", color: colors.ink2, opacity: idx === pages.length - 1 ? fadeIn : Math.min(fadeIn, fadeOut) }}>
          {cur.title} · p. {idx + 1}/{pages.length}
        </span>
      </div>
      <div style={{ position: "absolute", left: M, right: M, top: 92, height: 1.5, background: colors.ink, opacity: 0.35 * p, transform: `scaleX(${p})`, transformOrigin: "left" }} />
    </>
  );
};

/** Editorial headline in Playfair with a hand-drawn underline that draws on. */
export const Title: React.FC<{ text: string; delay?: number; size?: number; top?: number; left?: number; width?: number; accent?: string }> = ({ text, delay = 6, size = 72, top = 150, left = M, width = 1100, accent }) => {
  const f = useCurrentFrame();
  const p = prog(f, delay, 24);
  const u = prog(f, delay + 16, 26);
  const parts = accent ? text.split(accent) : [text];
  return (
    <div style={{ position: "absolute", left, top, width, opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
      <div style={{ fontFamily: fonts.serif, fontWeight: 700, fontSize: size, lineHeight: 1.08, color: colors.ink, letterSpacing: -0.5 }}>
        {accent ? (
          <>
            {parts[0]}
            <span style={{ color: colors.blue }}>{accent}</span>
            {parts[1]}
          </>
        ) : (
          text
        )}
      </div>
      <svg width={360} height={16} style={{ display: "block", marginTop: 10 }}>
        <path d="M2 10 C 80 2, 160 14, 240 7 S 340 4, 358 9" fill="none" stroke={colors.blue} strokeWidth={3.5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - u} />
      </svg>
    </div>
  );
};

/** Hand-drawn stroke that draws on. `d` is any SVG path in page coordinates. */
export const Stroke: React.FC<{ d: string; at: number; dur?: number; color?: string; width?: number; dash?: boolean }> = ({ d, at, dur = 30, color = colors.ink, width = 3, dash }) => {
  const f = useCurrentFrame();
  const p = prog(f, at, dur, Easing.bezier(0.4, 0, 0.3, 1));
  if (p <= 0) return null;
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={dash ? "0.02 0.012" : 1} strokeDashoffset={dash ? 0 : 1 - p} opacity={dash ? p : 1} />
    </svg>
  );
};

/** Curved ink arrow from A to B with a hand-drawn head. `bend` pushes the curve sideways. */
export const Arrow: React.FC<{ from: [number, number]; to: [number, number]; at: number; dur?: number; color?: string; bend?: number; width?: number }> = ({ from, to, at, dur = 32, color = colors.red, bend = 60, width = 3.5 }) => {
  const f = useCurrentFrame();
  const p = prog(f, at, dur, Easing.bezier(0.4, 0, 0.3, 1));
  if (p <= 0) return null;
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  // tangent at the end of the quadratic curve
  const tx = x2 - cx;
  const ty = y2 - cy;
  const ang = Math.atan2(ty, tx);
  const headLen = 22;
  const h1 = [x2 - headLen * Math.cos(ang - 0.5), y2 - headLen * Math.sin(ang - 0.5)];
  const h2 = [x2 - headLen * Math.cos(ang + 0.5), y2 - headLen * Math.sin(ang + 0.5)];
  const headP = prog(f, at + dur - 6, 10);
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" }}>
      <path d={`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
      <path d={`M${h1[0]} ${h1[1]} L${x2} ${y2} L${h2[0]} ${h2[1]}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - headP} />
    </svg>
  );
};

/** Rough hand-drawn ellipse around a box (page coordinates). */
export const Ring: React.FC<{ x: number; y: number; w: number; h: number; at: number; color?: string; width?: number }> = ({ x, y, w, h, at, color = colors.red, width = 3.5 }) => {
  const f = useCurrentFrame();
  const p = prog(f, at, 34, Easing.bezier(0.4, 0, 0.3, 1));
  if (p <= 0) return null;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2 + 18;
  const ry = h / 2 + 14;
  // 1.15 turns so the ends overlap like a real pen loop; a little wobble on the radii
  const pts: string[] = [];
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * Math.PI * 2.3 - 0.6;
    const wob = 1 + 0.025 * Math.sin(t * 5.3 + 1.2);
    pts.push(`${cx + Math.cos(t) * rx * wob},${cy + Math.sin(t) * ry * wob * (1 + 0.03 * Math.cos(t * 3))}`);
  }
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    </svg>
  );
};

/** Hand-drawn loop around its own content: wraps the child so the ring always encloses exactly that box. */
export const Circled: React.FC<{ at: number; color?: string; width?: number; padX?: number; padY?: number; children: React.ReactNode }> = ({ at, color = colors.red, width = 3.5, padX = 22, padY = 14, children }) => {
  const f = useCurrentFrame();
  const p = prog(f, at, 34, Easing.bezier(0.4, 0, 0.3, 1));
  const pts: string[] = [];
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * Math.PI * 2.3 - 0.6;
    const wob = 1 + 0.025 * Math.sin(t * 5.3 + 1.2);
    pts.push(`${50 + Math.cos(t) * 48 * wob},${50 + Math.sin(t) * 46 * wob * (1 + 0.03 * Math.cos(t * 3))}`);
  }
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {children}
      {p > 0 && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", left: -padX, top: -padY, width: `calc(100% + ${padX * 2}px)`, height: `calc(100% + ${padY * 2}px)`, overflow: "visible", pointerEvents: "none" }}>
          <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={width} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
        </svg>
      )}
    </span>
  );
};

/** Handwritten annotation (Caveat). */
export const Hand: React.FC<{ children: React.ReactNode; x: number; y: number; at: number; size?: number; color?: string; rotate?: number; width?: number; align?: "left" | "center" | "right" }> = ({ children, x, y, at, size = 38, color = colors.blue, rotate = -3, width, align = "left" }) => {
  const f = useCurrentFrame();
  const p = prog(f, at, 18);
  return (
    <div style={{ position: "absolute", left: x, top: y, width, fontFamily: fonts.hand, fontWeight: 600, fontSize: size, lineHeight: 1.1, color, opacity: p, transform: `rotate(${rotate}deg) translateY(${(1 - p) * 8}px)`, transformOrigin: "left center", textAlign: align, whiteSpace: width ? "normal" : "nowrap" }}>
      {children}
    </div>
  );
};

/** A white index card laid on the paper with a drop shadow; content is free-form. */
export const Card: React.FC<{ x: number; y: number; w: number; h?: number; at: number; rotate?: number; children: React.ReactNode; tint?: string; style?: React.CSSProperties }> = ({ x, y, w, h, at, rotate = 0, children, tint = colors.white, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 18, mass: 0.9 } });
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, padding: "22px 26px", background: tint, border: `1.5px solid ${colors.ink}22`, borderRadius: 6, boxShadow: "0 10px 30px rgba(50,35,15,0.16), 0 2px 4px rgba(50,35,15,0.10)", opacity: Math.min(1, s * 1.4), transform: `rotate(${rotate}deg) translateY(${(1 - s) * 30}px)`, transformOrigin: "center", ...style }}>
      {children}
    </div>
  );
};

/** Sticky note in Patrick Hand. */
export const Note: React.FC<{ x: number; y: number; w?: number; at: number; rotate?: number; tint?: string; children: React.ReactNode; size?: number }> = ({ x, y, w = 300, at, rotate = 2, tint = colors.yellow, children, size = 30 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 14, mass: 0.8 } });
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, padding: "20px 22px 24px", background: tint, boxShadow: "0 8px 22px rgba(50,35,15,0.18)", opacity: Math.min(1, s * 1.4), transform: `rotate(${rotate}deg) scale(${0.85 + 0.15 * s})`, transformOrigin: "top center", fontFamily: fonts.note, fontSize: size, lineHeight: 1.2, color: colors.ink }}>
      <div style={{ position: "absolute", left: "50%", top: -10, width: 90, height: 22, background: "rgba(255,255,255,0.55)", transform: "translateX(-50%) rotate(-2deg)", border: "1px solid rgba(0,0,0,0.05)" }} />
      {children}
    </div>
  );
};

/** Red rubber stamp: slams in with a slight over-rotation. */
export const Stamp: React.FC<{ text: string; x: number; y: number; at: number; color?: string; rotate?: number; size?: number }> = ({ text, x, y, at, color = colors.red, rotate = -12, size = 34 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 11, mass: 0.7, stiffness: 180 } });
  if (f < at) return null;
  const scale = interpolate(s, [0, 1], [1.8, 1]);
  const jitter = random(`stamp-${text}`) * 4 - 2;
  return (
    <div style={{ position: "absolute", left: x, top: y, padding: "8px 18px", border: `4px double ${color}`, borderRadius: 10, color, fontFamily: fonts.display, fontWeight: 800, fontSize: size, letterSpacing: 4, textTransform: "uppercase", opacity: Math.min(1, s * 1.5) * 0.9, transform: `rotate(${rotate + jitter}deg) scale(${scale})`, transformOrigin: "center", mixBlendMode: "multiply", whiteSpace: "nowrap" }}>
      {text}
    </div>
  );
};

/** Animated figure. */
export const Counter: React.FC<{ to: number; from?: number; start: number; dur?: number; format: (n: number) => string; style?: React.CSSProperties }> = ({ to, from = 0, start, dur = 36, format, style }) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [start, start + dur], [from, to], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{format(v)}</span>;
};

/** Label + big figure block used inside cards. */
export const Fig: React.FC<{ label: string; value: React.ReactNode; color?: string; size?: number; sub?: string }> = ({ label, value, color = colors.ink, size = 56, sub }) => (
  <div>
    <div style={{ fontFamily: fonts.mono, fontSize: 17, letterSpacing: 3, color: colors.pencil, textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: size, color, letterSpacing: -1, lineHeight: 1.1, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    {sub && <div style={{ fontFamily: fonts.body, fontSize: 19, color: colors.ink2, marginTop: 4 }}>{sub}</div>}
  </div>
);

/** Fade-in block that also grows into its height, so cards expand with their content instead of waiting half-empty. */
export const In: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; dy?: number; grow?: boolean }> = ({ at, children, style, dy = 14, grow = true }) => {
  const f = useCurrentFrame();
  const p = prog(f, at, 20);
  if (!grow || (style && style.position === "absolute")) return <div style={{ opacity: p, transform: `translateY(${(1 - p) * dy}px)`, ...style }}>{children}</div>;
  const h = prog(f, at - 8, 18);
  return (
    <div style={{ display: "grid", gridTemplateRows: `${Math.max(h, 0.0001)}fr`, opacity: p, transform: `translateY(${(1 - p) * dy}px)` }}>
      <div style={{ overflow: "hidden", minHeight: 0, ...style }}>{children}</div>
    </div>
  );
};
