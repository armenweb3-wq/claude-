import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { Backdrop, clamp, Column, easeInOut, Headline, Kicker, prog } from "../components/primitives";
import { beat } from "../data/timeline";
import { colors, fonts } from "../theme";

/** Stylised accelerator package: die, memory stacks, animated power traces and a light sweep. */
const Chip: React.FC = () => {
  const f = useCurrentFrame();
  const sweep = ((f * 6) % 900) - 300;
  const traces = Array.from({ length: 28 }).map((_, i) => {
    const side = i % 4;
    const k = Math.floor(i / 4) * 52 - 156;
    const len = 120 + random(`t${i}`) * 90;
    if (side === 0) return `M${300 + k} 120 v-${len}`;
    if (side === 1) return `M${300 + k} 480 v${len}`;
    if (side === 2) return `M120 ${300 + k} h-${len}`;
    return `M480 ${300 + k} h${len}`;
  });
  return (
    <svg width={760} height={760} viewBox="-80 -80 760 760">
      <defs>
        <linearGradient id="die" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2b3a14" />
          <stop offset="50%" stopColor="#11160a" />
          <stop offset="100%" stopColor="#2b3a14" />
        </linearGradient>
        <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity={0} />
          <stop offset="50%" stopColor="#fff" stopOpacity={0.22} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <clipPath id="pkg">
          <rect x={120} y={120} width={360} height={360} rx={18} />
        </clipPath>
        <filter id="glow">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {traces.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke={colors.green}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="30 260"
          strokeDashoffset={-(f * 5 + i * 37)}
          filter="url(#glow)"
          opacity={0.9}
        />
      ))}
      {traces.map((d, i) => (
        <path key={`b${i}`} d={d} stroke={colors.green} strokeOpacity={0.14} strokeWidth={2} fill="none" />
      ))}
      <rect x={120} y={120} width={360} height={360} rx={18} fill="#0c0e0d" stroke="#3a3f3c" strokeWidth={2} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={`m${i}`} x={i < 2 ? 140 : 404} y={i % 2 ? 300 : 150} width={56} height={130} rx={6} fill="#1d2120" stroke="#444a47" />
      ))}
      <rect x={214} y={160} width={172} height={280} rx={8} fill="url(#die)" stroke={colors.green} strokeWidth={2} filter="url(#glow)" />
      {Array.from({ length: 6 }).map((_, r) =>
        Array.from({ length: 4 }).map((__, c) => (
          <rect
            key={`${r}-${c}`}
            x={226 + c * 40}
            y={174 + r * 44}
            width={32}
            height={36}
            rx={3}
            fill={colors.green}
            opacity={0.12 + 0.3 * (0.5 + 0.5 * Math.sin(f / 6 + r + c * 1.7))}
          />
        )),
      )}
      <g clipPath="url(#pkg)">
        <rect x={sweep} y={0} width={200} height={600} fill="url(#sweep)" transform="skewX(-20)" />
      </g>
    </svg>
  );
};

/** One-point-perspective server hall rendered with a simple projection; the camera dollies forward. */
const Corridor: React.FC<{ start: number }> = ({ start }) => {
  const f = useCurrentFrame();
  const t = Math.max(0, f - start);
  const cam = t * 0.09;
  const cx = 540;
  const cy = 860;
  const focal = 520;
  const halfW = 3.2;
  const rackH = 4.2;
  const floorY = 2.2;
  const spacing = 1.6;
  const count = 22;
  const proj = (x: number, y: number, z: number) => ({ x: cx + (x / z) * focal, y: cy + (y / z) * focal });
  const racks: React.ReactNode[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const z0 = 1.2 + i * spacing - (cam % spacing);
    const z1 = z0 + spacing * 0.92;
    if (z0 < 0.6) continue;
    const fog = interpolate(z0, [1, 30], [1, 0.08], clamp);
    for (const side of [-1, 1]) {
      const a = proj(side * halfW, floorY - rackH, z0);
      const b = proj(side * halfW, floorY - rackH, z1);
      const c = proj(side * halfW, floorY, z1);
      const d = proj(side * halfW, floorY, z0);
      const idx = i + Math.floor(cam / spacing);
      racks.push(
        <g key={`${i}${side}`} opacity={fog}>
          <polygon points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`} fill="#0f1211" stroke="#2c3330" strokeWidth={1} />
          {Array.from({ length: 9 }).map((_, k) => {
            const yy = floorY - rackH + 0.35 + k * 0.42;
            const p = proj(side * halfW, yy, z0 + 0.18);
            const q = proj(side * halfW, yy, z1 - 0.18);
            const blink = random(`led-${idx}-${side}-${k}-${Math.floor((f + k * 3) / 5)}`) > 0.35;
            return (
              <line
                key={k}
                x1={p.x}
                y1={p.y}
                x2={q.x}
                y2={q.y}
                stroke={blink ? colors.green : "#1f3a05"}
                strokeWidth={Math.max(1, 6 / z0)}
                strokeLinecap="round"
                strokeDasharray={`${Math.max(1, 6 / z0)} ${Math.max(2, 14 / z0)}`}
              />
            );
          })}
        </g>,
      );
    }
    const l1 = proj(-1.2, floorY - rackH - 0.6, z0);
    const l2 = proj(1.2, floorY - rackH - 0.6, z0);
    racks.push(<line key={`light${i}`} x1={l1.x} y1={l1.y} x2={l2.x} y2={l2.y} stroke="#ffffff" strokeOpacity={0.35 * fog} strokeWidth={Math.max(1, 8 / z0)} />);
  }
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.green} stopOpacity={0.0} />
          <stop offset="100%" stopColor={colors.green} stopOpacity={0.16} />
        </linearGradient>
        <radialGradient id="vp">
          <stop offset="0%" stopColor={colors.green} stopOpacity={0.55} />
          <stop offset="100%" stopColor={colors.green} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={0} y={cy} width={1080} height={1920 - cy} fill="url(#floor)" />
      <circle cx={cx} cy={cy - 40} r={260} fill="url(#vp)" />
      {Array.from({ length: 14 }).map((_, i) => {
        const z = 1 + i * 1.4 - ((cam * 1) % 1.4);
        const p1 = proj(-halfW, floorY, z);
        const p2 = proj(halfW, floorY, z);
        return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={colors.green} strokeOpacity={0.12} />;
      })}
      {racks}
    </svg>
  );
};

export const S3DataCenter: React.FC = () => {
  const f = useCurrentFrame();
  const r = beat("datacenter", "racks");
  const dive = interpolate(f, [r - 18, r + 10], [0, 1], { ...clamp, easing: easeInOut });
  const tiltX = 18 + Math.sin(f / 40) * 6;
  const tiltY = -16 + f * 0.12;
  const chipIn = prog(f, 0, 30);
  const textSwap = prog(f, r, 20);
  return (
    <AbsoluteFill>
      <Backdrop grid={dive < 0.5} />
      <AbsoluteFill style={{ opacity: dive }}>
        <Corridor start={r - 18} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          perspective: 1400,
          alignItems: "center",
          justifyContent: "center",
          opacity: chipIn * (1 - dive),
          transform: `translateY(90px) scale(${1 + dive * 2.4})`,
          filter: dive > 0.05 ? `blur(${dive * 10}px)` : undefined,
        }}
      >
        <div style={{ transform: `rotateX(${tiltX}deg) rotateZ(${tiltY}deg) scale(${0.85 + chipIn * 0.15})` }}>
          <Chip />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(7,9,10,0.95) 0%, rgba(7,9,10,0.6) 28%, transparent 42%)" }} />
      <Column top={210} gap={28}>
        <Kicker delay={4}>The infrastructure</Kicker>
        <div style={{ position: "relative", height: 300 }}>
          <div style={{ position: "absolute", inset: 0, opacity: 1 - textSwap }}>
            <Headline text="NVIDIA: a leading supplier of AI computing." accent={["NVIDIA:"]} delay={6} size={86} />
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: textSwap }}>
            <Headline text="From a single chip to entire AI data centers." accent={["AI", "data", "centers"]} delay={r + 2} size={86} />
          </div>
        </div>
      </Column>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1250,
          display: "flex",
          justifyContent: "center",
          gap: 22,
          fontFamily: fonts.mono,
          fontSize: 24,
          letterSpacing: 3,
          color: colors.muted,
          textTransform: "uppercase",
          opacity: prog(f, r + 10, 20),
        }}
      >
        {["Chips", "Systems", "Networking", "Software"].map((w, i) => (
          <span key={w} style={{ color: i === 0 ? colors.green : undefined }}>
            {w}
            {i < 3 ? <span style={{ color: colors.dim }}>  ·</span> : null}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
