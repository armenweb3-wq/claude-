/**
 * Visual system for the education films: a clean, light "trading academy" look in 16:9.
 * Colour carries meaning everywhere: green = profit, red = loss, amber = margin, violet = leverage.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import "../theme"; // registers the bundled fonts

export const E = {
  bg: "#F3F6FB",
  ink: "#0E1A2B",
  sub: "#556479",
  faint: "#8A97A8",
  line: "#DCE3EC",
  card: "#FFFFFF",
  panel: "#0F1B2E",
  panel2: "#17263D",
  blue: "#2E6BFF",
  green: "#12B76A",
  red: "#F04438",
  amber: "#F79009",
  violet: "#7A5AF8",
  teal: "#06AED4",
};
export const EF = {
  display: "'Inter Tight', Inter, sans-serif",
  body: "Inter, sans-serif",
  mono: "'JetBrains Mono', monospace",
};
export const W = 1920;
export const H = 1080;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.25, 1, 0.5, 1);
/** 0→1 between local frames. Durations are generous on purpose: nothing should feel rushed. */
export const p = (f: number, from: number, dur = 22) => interpolate(f, [from, from + dur * 1.4], [0, 1], { ...clamp, easing: ease });
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const usd = (n: number, d = 0) =>
  (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const signed = (n: number, d = 0) => (n > 0 ? "+" : "") + usd(n, d);

/** Soft studio background with a faint grid. */
export const Stage: React.FC<{ accent: string; children: React.ReactNode }> = ({ accent, children }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: E.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 700px at ${78 + Math.sin(f / 200) * 4}% 30%, ${accent}1F, transparent 70%), radial-gradient(800px 600px at 10% 100%, ${E.teal}14, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${E.line}88 1px, transparent 1px), linear-gradient(90deg, ${E.line}88 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          opacity: 0.45,
          maskImage: "radial-gradient(ellipse 70% 70% at 60% 40%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 60% 40%, black, transparent)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

/** Calm cross-fade between scenes. */
export const Fade: React.FC<{ duration: number; fade: number; first?: boolean; last?: boolean; children: React.ReactNode }> = ({ duration, fade, first, last, children }) => {
  const f = useCurrentFrame();
  const a = first ? 1 : interpolate(f, [0, fade], [0, 1], clamp);
  const b = last ? 1 : interpolate(f, [duration - fade, duration], [1, 0], clamp);
  const y = first ? 0 : interpolate(f, [0, fade], [14, 0], clamp);
  return <AbsoluteFill style={{ opacity: Math.min(a, b), transform: `translateY(${y}px)` }}>{children}</AbsoluteFill>;
};

/** Top bar: session label on the left, topic progress on the right. */
export const TopBar: React.FC<{ session: number; name: string; accent: string; topic?: number; topics?: number }> = ({ session, name, accent, topic, topics }) => (
  <div style={{ position: "absolute", left: 110, right: 110, top: 46, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: EF.mono, fontSize: 22, letterSpacing: 3, color: E.sub }}>
      <span style={{ background: accent, color: "white", borderRadius: 8, padding: "4px 12px", fontWeight: 700 }}>SESSION {session}</span>
      {name.toUpperCase()}
    </div>
    {topic !== undefined && topics !== undefined && (
      <div style={{ display: "flex", gap: 8 }}>
        {Array.from({ length: topics }).map((_, i) => (
          <div key={i} style={{ width: i === topic ? 44 : 14, height: 14, borderRadius: 7, background: i <= topic ? accent : E.line }} />
        ))}
      </div>
    )}
  </div>
);

/** Topic title on the left: number chip, heading and a short tagline. */
export const TopicTitle: React.FC<{ n?: number; title: string; tag?: string; accent: string }> = ({ n, title, tag, accent }) => {
  const f = useCurrentFrame();
  const a = p(f, 4, 20);
  return (
    <div style={{ position: "absolute", left: 110, top: 150, width: 760, opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}>
      {n !== undefined && (
        <div style={{ fontFamily: EF.mono, fontSize: 24, fontWeight: 700, color: accent, letterSpacing: 3, marginBottom: 10 }}>TOPIC {String(n).padStart(2, "0")}</div>
      )}
      <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 76, lineHeight: 1.02, color: E.ink, letterSpacing: -1.5 }}>{title}</div>
      {tag && <div style={{ fontFamily: EF.body, fontSize: 30, color: E.sub, marginTop: 14, lineHeight: 1.35 }}>{tag}</div>}
    </div>
  );
};

/** Bullet points that appear as they're spoken; the one being spoken is highlighted. */
export const Points: React.FC<{ items: { text: React.ReactNode; at: number; until?: number }[]; accent: string; top?: number; size?: number }> = ({ items, accent, top = 420, size = 34 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 110, top, width: 740, display: "flex", flexDirection: "column", gap: 22 }}>
      {items.map((it, i) => {
        const a = p(f, it.at, 16);
        const next = items[i + 1]?.at ?? Infinity;
        const active = f >= it.at && f < (it.until ?? next);
        return (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 18,
              alignItems: "flex-start",
              opacity: a * (active ? 1 : 0.62),
              transform: `translateX(${(1 - a) * -24}px)`,
            }}
          >
            <div style={{ marginTop: size * 0.42, width: 12, height: 12, borderRadius: 6, background: active ? accent : E.faint, flex: "0 0 auto" }} />
            <div style={{ fontFamily: EF.body, fontSize: size, lineHeight: 1.36, color: E.ink, fontWeight: active ? 600 : 400 }}>{it.text}</div>
          </div>
        );
      })}
    </div>
  );
};

/** White card on the right half that holds each diagram. */
export const Card: React.FC<{ children: React.ReactNode; dark?: boolean; style?: React.CSSProperties }> = ({ children, dark, style }) => {
  const f = useCurrentFrame();
  const a = p(f, 8, 22);
  return (
    <div
      style={{
        position: "absolute",
        left: 930,
        top: 150,
        width: 880,
        height: 690,
        borderRadius: 32,
        background: dark ? E.panel : E.card,
        boxShadow: "0 30px 80px rgba(14,26,43,0.12), 0 2px 6px rgba(14,26,43,0.06)",
        border: dark ? "none" : `1px solid ${E.line}`,
        overflow: "hidden",
        opacity: a,
        transform: `translateY(${(1 - a) * 30}px) scale(${0.98 + a * 0.02})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Fade/rise entrance wrapper. */
export const In: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; dy?: number }> = ({ at, children, style, dy = 18 }) => {
  const f = useCurrentFrame();
  const a = p(f, at, 16);
  return <div style={{ opacity: a, transform: `translateY(${(1 - a) * dy}px)`, ...style }}>{children}</div>;
};

/** Gentle spring pop for emphasis. */
export const Pop: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, children, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 16, mass: 1.2 } });
  return <div style={{ opacity: Math.min(1, s * 1.5), transform: `scale(${0.85 + 0.15 * s})`, ...style }}>{children}</div>;
};

/** Animated number. */
export const Num: React.FC<{ from?: number; to: number; at: number; dur?: number; fmt: (n: number) => string; style?: React.CSSProperties }> = ({ from = 0, to, at, dur = 36, fmt, style }) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [at, at + dur], [from, to], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{fmt(v)}</span>;
};

/** A labelled value tile (used for account metrics). */
export const Tile: React.FC<{ label: string; value: React.ReactNode; color?: string; sub?: string; dark?: boolean; size?: number }> = ({ label, value, color = E.ink, sub, dark, size = 54 }) => (
  <div
    style={{
      flex: 1,
      borderRadius: 22,
      padding: "22px 26px",
      background: dark ? E.panel2 : "#F7F9FC",
      border: `1px solid ${dark ? "#253753" : E.line}`,
    }}
  >
    <div style={{ fontFamily: EF.mono, fontSize: 20, letterSpacing: 2.5, color: dark ? "#8FA3BF" : E.sub, textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: size, color, lineHeight: 1.15, marginTop: 6 }}>{value}</div>
    {sub && <div style={{ fontFamily: EF.body, fontSize: 22, color: dark ? "#8FA3BF" : E.sub, marginTop: 4 }}>{sub}</div>}
  </div>
);

/** A highlighted formula strip. */
export const Formula: React.FC<{ parts: { t: string; c?: string }[]; at: number; size?: number }> = ({ parts, at, size = 40 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 14, fontFamily: EF.display, fontWeight: 700, fontSize: size }}>
      {parts.map((pt, i) => {
        const a = p(f, at + i * 5, 12);
        return (
          <span
            key={i}
            style={{
              opacity: a,
              transform: `translateY(${(1 - a) * 10}px)`,
              color: pt.c ? "white" : E.sub,
              background: pt.c ?? "transparent",
              borderRadius: 14,
              padding: pt.c ? "8px 18px" : 0,
            }}
          >
            {pt.t}
          </span>
        );
      })}
    </div>
  );
};

/** A key-takeaway banner at the bottom of the left column. */
export const KeyPoint: React.FC<{ at: number; accent: string; children: React.ReactNode }> = ({ at, accent, children }) => {
  const f = useCurrentFrame();
  const a = p(f, at, 18);
  return (
    <div
      style={{
        position: "absolute",
        left: 110,
        top: 760,
        width: 740,
        borderLeft: `6px solid ${accent}`,
        background: `${accent}12`,
        borderRadius: "0 18px 18px 0",
        padding: "16px 24px",
        fontFamily: EF.body,
        fontSize: 28,
        lineHeight: 1.35,
        color: E.ink,
        opacity: a,
        transform: `translateX(${(1 - a) * -20}px)`,
      }}
    >
      <span style={{ fontFamily: EF.mono, fontSize: 20, letterSpacing: 2.5, color: accent, fontWeight: 700 }}>KEY POINT · </span>
      {children}
    </div>
  );
};

/* ───────────────────────── Price chart engine ───────────────────────── */

/** Keyframes may be cued from different narration lines; force them into time order with a minimum gap. */
export const normPath = (path: { f: number; p: number }[]) => {
  const out: { f: number; p: number }[] = [];
  for (const k of path) out.push({ f: out.length ? Math.max(k.f, out[out.length - 1].f + 12) : k.f, p: k.p });
  return out;
};

/** Smoothly interpolated price along keyframes ({f: frame, p: price}). Shared by charts and P&L read-outs. */
export const pathPrice = (raw: { f: number; p: number }[], fr: number) => {
  const path = normPath(raw);
  if (fr <= path[0].f) return path[0].p;
  for (let i = 1; i < path.length; i++) {
    if (fr <= path[i].f) {
      const t = (fr - path[i - 1].f) / Math.max(1, path[i].f - path[i - 1].f);
      return path[i - 1].p + (path[i].p - path[i - 1].p) * t * t * (3 - 2 * t);
    }
  }
  return path[path.length - 1].p;
};

export type Level = { price: number; label: string; color: string; at: number; dash?: boolean; side?: "left" | "right" };
export type Zone = { from: number; to: number; color: string; at: number; label?: string; side?: "left" | "right" | "center" };

/**
 * Candlestick history ending at `start`, then a live price line that follows `path` keyframes
 * ({frame, price}). Horizontal `levels` (entry, stop loss, take profit, orders) draw in on cue.
 */
export const Chart: React.FC<{
  lo: number;
  hi: number;
  start: number;
  path: { f: number; p: number }[];
  levels?: Level[];
  zones?: Zone[];
  seed?: string;
  w?: number;
  h?: number;
  digits?: number;
  history?: number;
  trend?: number;
  markers?: { f: number; label: string; color: string }[];
}> = ({ lo, hi, start, path: rawPath, levels = [], zones = [], seed = "c", w = 880, h = 690, digits = 4, history = 26, trend = 0, markers = [] }) => {
  const f = useCurrentFrame();
  const path = normPath(rawPath);
  const padL = 30;
  const padR = 150;
  const padT = 40;
  const padB = 50;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * plotH;
  const histW = plotW * 0.36;
  const cw = histW / history;
  // deterministic history walking back from `start`
  const closes: number[] = [start];
  for (let i = 1; i < history; i++) {
    const prev = closes[i - 1];
    closes.push(prev - trend / history + (random(`${seed}${i}`) - 0.5) * (hi - lo) * 0.06);
  }
  closes.reverse();
  const candles = closes.map((c, i) => {
    const o = i === 0 ? c + (random(`${seed}o`) - 0.5) * (hi - lo) * 0.04 : closes[i - 1];
    const wick = (hi - lo) * 0.02 * (0.5 + random(`${seed}w${i}`));
    return { o, c, h: Math.max(o, c) + wick, l: Math.min(o, c) - wick, x: padL + i * cw + cw / 2 };
  });
  // live path
  const liveX0 = padL + histW + cw / 2;
  const span = Math.max(1, (path[path.length - 1]?.f ?? 1) - (path[0]?.f ?? 0));
  const priceAt = (fr: number) => pathPrice(path, fr);
  const xAt = (fr: number) => liveX0 + ((Math.min(fr, path[path.length - 1].f) - path[0].f) / span) * (plotW - histW - cw);
  const pts: string[] = [];
  const endF = Math.min(f, path[path.length - 1].f);
  for (let fr = path[0].f; fr <= endF; fr += 2) pts.push(`${xAt(fr)},${y(priceAt(fr))}`);
  const cur = priceAt(f);
  const curX = xAt(f);
  const gridVals = Array.from({ length: 5 }).map((_, i) => lo + ((hi - lo) * (i + 0.5)) / 5);
  return (
    <svg width={w} height={h}>
      {gridVals.map((v) => (
        <g key={v}>
          <line x1={padL} x2={padL + plotW} y1={y(v)} y2={y(v)} stroke="#25395A" strokeWidth={1} />
          <text x={w - 12} y={y(v) + 7} textAnchor="end" fontFamily={EF.mono} fontSize={20} fill="#6F86A6">
            {v.toFixed(digits)}
          </text>
        </g>
      ))}
      {zones.map((z, i) => {
        const a = p(f, z.at, 16);
        return (
          <g key={i} opacity={a}>
            <rect x={padL} width={plotW} y={y(Math.max(z.from, z.to))} height={Math.abs(y(z.from) - y(z.to))} fill={z.color} opacity={0.16} />
            {z.label && (
              <text
                x={z.side === "left" ? padL + 14 : z.side === "center" ? padL + plotW * 0.66 : padL + plotW - 14}
                y={(y(z.from) + y(z.to)) / 2 + 9}
                textAnchor={z.side === "left" ? "start" : z.side === "center" ? "middle" : "end"} fontFamily={EF.display} fontWeight={700} fontSize={26} fill={z.color}>
                {z.label}
              </text>
            )}
          </g>
        );
      })}
      {candles.map((c, i) => {
        const up = c.c >= c.o;
        const col = up ? E.green : E.red;
        return (
          <g key={i} opacity={p(f, 6 + i * 0.6, 8)}>
            <line x1={c.x} x2={c.x} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={2} />
            <rect x={c.x - cw * 0.32} width={cw * 0.64} y={y(Math.max(c.o, c.c))} height={Math.max(2, Math.abs(y(c.o) - y(c.c)))} fill={col} rx={2} />
          </g>
        );
      })}
      {levels.map((l, i) => {
        const a = p(f, l.at, 14);
        const yy = y(l.price);
        return (
          <g key={i} opacity={a}>
            <line x1={padL} x2={padL + (plotW + 10) * a} y1={yy} y2={yy} stroke={l.color} strokeWidth={3} strokeDasharray={l.dash ? "10 8" : undefined} />
            <rect x={w - padR + 8} y={yy - 20} width={padR - 12} height={40} rx={8} fill={l.color} />
            <text x={w - padR / 2 + 2} y={yy + 8} textAnchor="middle" fontFamily={EF.mono} fontWeight={700} fontSize={20} fill="white">
              {l.price.toFixed(digits)}
            </text>
            {/* dark backing so labels stay readable over candles and the price line */}
            <rect
              x={l.side === "left" ? padL + 4 : padL + plotW - 20 - l.label.length * 13.2}
              y={yy - 44}
              width={l.label.length * 13.2 + 16}
              height={34}
              rx={8}
              fill="#0F1B2E"
              opacity={0.88}
            />
            <text x={(l.side === "left" ? padL + 12 : padL + plotW - 12)} y={yy - 18} textAnchor={l.side === "left" ? "start" : "end"} fontFamily={EF.display} fontWeight={700} fontSize={26} fill={l.color}>
              {l.label}
            </text>
          </g>
        );
      })}
      {f >= path[0].f && (
        <>
          <polyline points={pts.join(" ")} fill="none" stroke="#E8EEF7" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={curX} cy={y(cur)} r={11} fill="#E8EEF7" />
          <circle cx={curX} cy={y(cur)} r={22 + Math.sin(f / 5) * 4} fill="#E8EEF7" opacity={0.18} />
        </>
      )}
      {markers.map((m, i) => {
        const a = p(f, m.f, 10);
        const mx = xAt(m.f);
        const my = y(priceAt(m.f));
        return (
          <g key={i} opacity={a}>
            <circle cx={mx} cy={my} r={14} fill={m.color} stroke="white" strokeWidth={4} />
            <rect x={mx - 26 - m.label.length * 13.5} y={my - 64} width={m.label.length * 13.5 + 16} height={40} rx={10} fill="white" />
            <text x={mx - 18} y={my - 36} textAnchor="end" fontFamily={EF.display} fontWeight={800} fontSize={24} fill={m.color}>
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
