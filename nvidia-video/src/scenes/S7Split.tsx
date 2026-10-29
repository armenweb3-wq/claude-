import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, clamp, Column, Counter, Headline, Kicker, prog } from "../components/primitives";
import { fmtInt, fmtUSD, gainPerShare, positions } from "../data/content";
import { beat } from "../data/timeline";
import { colors, fonts } from "../theme";

const COL_W = 456;
const TOP = 480;
const CARD_H = 790;

const Row: React.FC<{ label: string; children: React.ReactNode; at: number; strong?: boolean }> = ({ label, children, at, strong }) => {
  const f = useCurrentFrame();
  const p = prog(f, at, 18);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "15px 0",
        borderBottom: `1px solid ${colors.line}`,
        opacity: p,
        transform: `translateX(${(1 - p) * -20}px)`,
      }}
    >
      <span style={{ fontFamily: fonts.mono, fontSize: 21, letterSpacing: 1.5, color: colors.muted, textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontFamily: fonts.display, fontWeight: strong ? 700 : 600, fontSize: 34, color: strong ? colors.greenBright : colors.text, fontVariantNumeric: "tabular-nums" }}>
        {children}
      </span>
    </div>
  );
};

const ScenarioCard: React.FC<{ index: number; start: number; emphasis: number; x: number }> = ({ index, start, emphasis, x }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = positions[index];
  const s = spring({ frame: f - start, fps, config: { damping: 22, mass: 0.9 } });
  const step = 5;
  const profitAt = start + step * 6;
  const glow = interpolate(emphasis, [0, 1], [0, 1]);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: TOP,
        width: COL_W,
        height: CARD_H,
        borderRadius: 32,
        padding: "30px 30px",
        background: `linear-gradient(180deg, ${colors.charcoal2}, ${colors.charcoal})`,
        border: `1px solid ${glow > 0.5 ? colors.green + "AA" : colors.line}`,
        boxShadow: `0 30px 80px rgba(0,0,0,0.55), 0 0 ${80 * glow}px ${colors.green}44`,
        opacity: s,
        transform: `translateY(${(1 - s) * 80}px) scale(${0.96 + s * 0.04})`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 4, color: colors.green }}>SCENARIO {index === 0 ? "A" : "B"}</span>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 22,
            fontWeight: 700,
            color: "#0b1200",
            background: colors.green,
            borderRadius: 100,
            padding: "4px 14px",
          }}
        >
          ≈{p.leverage.toFixed(1)}×
        </span>
      </div>
      <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 76, color: colors.text, letterSpacing: -2, lineHeight: 1.1 }}>
        <Counter to={p.capital} start={start + 4} dur={26} format={(n) => fmtUSD(n)} />
      </div>
      <div style={{ fontFamily: fonts.body, fontSize: 24, color: colors.muted, marginBottom: 10 }}>own capital</div>
      <Row label="Shares" at={start + step}>
        <Counter to={p.shares} start={start + step} dur={24} format={fmtInt} />
      </Row>
      <Row label="Position @ $218" at={start + step * 2}>
        {fmtUSD(p.exposure)}
      </Row>
      <Row label="Leverage" at={start + step * 3}>
        {p.leverage.toFixed(2)}×
      </Row>
      <Row label="Gain / share" at={start + step * 4}>
        {fmtUSD(gainPerShare, 2)}
      </Row>
      <Row label="Return on capital" at={start + step * 5} strong>
        +{p.returnOnCapitalPct.toFixed(1)}%
      </Row>
      <div style={{ flex: 1 }} />
      <div style={{ fontFamily: fonts.mono, fontSize: 20, letterSpacing: 2.5, color: colors.muted, textTransform: "uppercase", opacity: prog(f, profitAt, 14) }}>
        Potential profit
      </div>
      <div
        style={{
          fontFamily: fonts.display,
          fontWeight: 800,
          fontSize: 66,
          letterSpacing: -1.5,
          color: colors.greenBright,
          lineHeight: 1.1,
          textShadow: `0 0 ${30 + glow * 30}px ${colors.green}88`,
          opacity: prog(f, profitAt, 10),
        }}
      >
        <Counter to={p.grossProfit} start={profitAt} dur={28} format={(n) => fmtUSD(n, 2)} />
      </div>
      <div style={{ fontFamily: fonts.body, fontSize: 22, color: colors.muted, marginTop: 6, opacity: prog(f, profitAt + 20, 14) }}>
        before interest and fees
      </div>
    </div>
  );
};

export const S7Split: React.FC = () => {
  const f = useCurrentFrame();
  const left = beat("split", "left");
  const right = beat("split", "right");
  const emph = prog(f, beat("split", "emphasis"), 20);
  const divider = prog(f, 4, 30);
  const placeholder = 1 - prog(f, right - 6, 12);
  return (
    <AbsoluteFill>
      <Backdrop glow={0.8} />
      <Column top={210} gap={22}>
        <Kicker delay={2}>Same 8% rise · bigger position</Kicker>
        <Headline text="Scale it up." accent={["up"]} delay={4} size={88} />
      </Column>
      {/* Glowing centre divider */}
      <div
        style={{
          position: "absolute",
          left: 539,
          top: TOP,
          width: 2,
          height: CARD_H * divider,
          background: `linear-gradient(180deg, transparent, ${colors.green}, transparent)`,
          boxShadow: `0 0 24px ${colors.green}`,
        }}
      />
      <ScenarioCard index={0} start={left} emphasis={emph} x={72} />
      {/* Right side waits as a dim silhouette until its voiceover line. */}
      <div
        style={{
          position: "absolute",
          left: 552,
          top: TOP,
          width: COL_W,
          height: CARD_H,
          borderRadius: 32,
          border: `1px dashed ${colors.line}`,
          opacity: placeholder * prog(f, 10, 20),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fonts.mono,
          fontSize: 24,
          letterSpacing: 4,
          color: colors.dim,
        }}
      >
        SCENARIO B
      </div>
      <ScenarioCard index={1} start={right} emphasis={emph} x={552} />
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          top: TOP - 50,
          textAlign: "center",
          fontFamily: fonts.mono,
          fontSize: 20,
          letterSpacing: 1.5,
          whiteSpace: "nowrap",
          color: colors.muted,
          opacity: interpolate(f, [left + 10, left + 30], [0, 1], clamp),
        }}
      >
        $218.00 → $235.44 · LEVERAGE = POSITION ÷ OWN CAPITAL
      </div>
    </AbsoluteFill>
  );
};
