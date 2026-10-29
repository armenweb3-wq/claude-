import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { Backdrop, Body, clamp, Column, Headline, Kicker, prog } from "../components/primitives";
import { beat } from "../data/timeline";
import { colors, fonts } from "../theme";

const Panel: React.FC<{ title: string; sub: string; active: number; children: React.ReactNode; height: number }> = ({
  title,
  sub,
  active,
  children,
  height,
}) => (
  <div
    style={{
      borderRadius: 28,
      border: `1px solid ${active > 0.5 ? colors.green + "88" : colors.line}`,
      background: "rgba(16,18,19,0.82)",
      padding: "28px 32px",
      display: "flex",
      flexDirection: "column",
      gap: 18,
      height,
      boxShadow: active > 0.5 ? `0 0 80px ${colors.green}22` : "none",
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 48, color: colors.text }}>{title}</div>
      <div style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 2, color: colors.muted, textTransform: "uppercase" }}>{sub}</div>
    </div>
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
    </div>
  </div>
);

/** CPU: a handful of big cores working one task at a time. */
const CpuCores: React.FC = () => {
  const f = useCurrentFrame();
  const current = Math.floor(f / 7) % 8;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 14, height: "100%" }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            borderRadius: 12,
            background: i === current ? colors.green : colors.charcoal2,
            border: `1px solid ${colors.line}`,
            boxShadow: i === current ? `0 0 30px ${colors.green}` : "none",
          }}
        />
      ))}
    </div>
  );
};

/** GPU: thousands of small cores firing in parallel waves. */
const GpuCores: React.FC<{ start: number }> = ({ start }) => {
  const f = useCurrentFrame();
  const cols = 36;
  const rows = 22;
  const cell = 24;
  const gap = 0.5;
  const t = f - start;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${cols * cell} ${rows * cell}`} preserveAspectRatio="xMidYMid meet">
      {Array.from({ length: rows * cols }).map((_, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const d = Math.hypot(c - cols / 2, r - rows / 2);
        const wake = interpolate(t, [d * 1.1, d * 1.1 + 8], [0, 1], clamp);
        const wave = 0.55 + 0.45 * Math.sin(t / 5 - d * 0.6 + random(i) * 1.2);
        const on = wake * wave;
        return (
          <rect
            key={i}
            x={c * cell + gap * 2}
            y={r * cell + gap * 2}
            width={cell - 4}
            height={cell - 4}
            rx={3}
            fill={on > 0.05 ? colors.green : colors.charcoal2}
            fillOpacity={on > 0.05 ? 0.25 + on * 0.75 : 1}
          />
        );
      })}
    </svg>
  );
};

export const S2Gpu: React.FC = () => {
  const f = useCurrentFrame();
  const g = beat("gpu", "gpuReveal");
  const gpuIn = prog(f, g - 10, 24);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={28}>
        <Kicker delay={4}>Why AI needs GPUs</Kicker>
        <Headline text="Every AI answer runs on massive compute." accent={["massive", "compute"]} delay={8} size={86} />
        <div style={{ height: 6 }} />
        <div style={{ opacity: interpolate(gpuIn, [0, 1], [1, 0.45]) }}>
          <Panel title="CPU" sub="Few cores · one step at a time" active={1 - gpuIn} height={210}>
            <CpuCores />
          </Panel>
        </div>
        <div style={{ opacity: gpuIn, transform: `translateY(${(1 - gpuIn) * 60}px)` }}>
          <Panel title="GPU" sub="Thousands of cores · all at once" active={gpuIn} height={520}>
            <GpuCores start={g} />
          </Panel>
        </div>
        <div style={{ opacity: gpuIn, display: "flex", justifyContent: "center", marginTop: 6 }}>
          <Body size={30} delay={g + 10} style={{ textAlign: "center" }}>
            AI models are mostly matrix maths — <span style={{ color: colors.text }}>ideal for parallel chips</span>
          </Body>
        </div>
      </Column>
    </AbsoluteFill>
  );
};
