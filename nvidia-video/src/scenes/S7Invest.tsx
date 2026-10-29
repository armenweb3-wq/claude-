import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, clamp, Column, ComplianceStrip, Counter, Headline, Kicker, prog } from "../components/primitives";
import { fmtInt, fmtUSD, positions, priceMovePct } from "../data/content";
import { beat } from "../data/timeline";
import { colors, fonts, SAFE } from "../theme";

const pos = positions[0];

/** A stroke that draws itself — the "marker pen" used for every call-out. */
const Stroke: React.FC<{ d: string; p: number; width?: number; color?: string; len?: number }> = ({ d, p, width = 6, color = colors.greenBright, len = 2400 }) => (
  <path
    d={d}
    fill="none"
    stroke={color}
    strokeWidth={width}
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeDasharray={len}
    strokeDashoffset={len * (1 - p)}
    style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
  />
);

const Card: React.FC<{ top: number; height: number; children: React.ReactNode; enter: number; glow?: number }> = ({ top, height, children, enter, glow = 0 }) => (
  <div
    style={{
      position: "absolute",
      left: SAFE.x,
      right: SAFE.x,
      top,
      height,
      borderRadius: 32,
      padding: "28px 40px",
      background: `linear-gradient(160deg, ${colors.charcoal2}, ${colors.charcoal})`,
      border: `1px solid ${glow > 0.5 ? colors.green + "AA" : colors.line}`,
      boxShadow: `0 30px 80px rgba(0,0,0,0.55), 0 0 ${90 * glow}px ${colors.green}40`,
      opacity: enter,
      transform: `translateY(${(1 - enter) * 70}px)`,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    }}
  >
    {children}
  </div>
);

const Label: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = colors.muted }) => (
  <div style={{ fontFamily: fonts.mono, fontSize: 24, letterSpacing: 4, color, textTransform: "uppercase" }}>{children}</div>
);

export const S7Invest: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const investAt = beat("invest", "invest");
  const profitAt = beat("invest", "profit");
  const circleAt = beat("invest", "circle");
  const investIn = spring({ frame: f - investAt, fps, config: { damping: 22 } });
  const arrowP = prog(f, profitAt - 14, 18);
  const profitIn = spring({ frame: f - profitAt, fps, config: { damping: 20 } });
  const circleP = interpolate(f, [circleAt, circleAt + 18], [0, 1], clamp);
  const noteP = prog(f, circleAt + 6, 12);
  const punch = 1 + 0.035 * Math.sin(Math.PI * interpolate(f, [circleAt, circleAt + 14], [0, 1], clamp));
  const bob = Math.sin(f / 5) * 8;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={22}>
        <Kicker delay={2}>Your scenario · hypothetical</Kicker>
        <Headline text="By investing $25,000…" accent={["$25,000…"]} delay={4} size={90} />
      </Column>

      {/* YOU INVEST */}
      <Card top={420} height={250} enter={investIn}>
        <Label>You invest</Label>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 112, color: colors.text, letterSpacing: -3, lineHeight: 1.05 }}>
          <Counter to={pos.capital} start={investAt} dur={24} format={(n) => fmtUSD(n)} />
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: 27, color: colors.muted }}>
          {fmtInt(pos.shares)} shares · <span style={{ color: colors.greenBright }}>≈{pos.leverage.toFixed(1)}× leverage</span> ({fmtUSD(pos.exposure)} position)
        </div>
      </Card>

      {/* Hand-drawn arrow from stake to outcome, with its condition written beside it */}
      <svg width={1080} height={1920} style={{ position: "absolute", overflow: "visible" }}>
        <Stroke d="M300 690 C 280 740, 320 790, 296 838" p={arrowP} />
        <Stroke d="M270 812 L 296 842 L 324 814" p={interpolate(arrowP, [0.7, 1], [0, 1], clamp)} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 370,
          top: 712,
          fontFamily: fonts.hand,
          fontWeight: 700,
          fontSize: 50,
          color: colors.greenBright,
          opacity: arrowP,
          transform: `rotate(-3deg)`,
        }}
      >
        if NVDA rises {priceMovePct}%…
      </div>

      {/* COULD POTENTIALLY MAKE */}
      <div style={{ transform: `scale(${punch})`, transformOrigin: "50% 1000px", position: "absolute", inset: 0 }}>
        <Card top={860} height={360} enter={profitIn} glow={circleP}>
          <Label color={colors.green}>You could potentially make</Label>
          <div
            style={{
              fontFamily: fonts.display,
              fontWeight: 800,
              fontSize: 138,
              color: colors.greenBright,
              letterSpacing: -4,
              lineHeight: 1.05,
              textShadow: `0 0 40px ${colors.green}77`,
            }}
          >
            <Counter to={pos.grossProfit} start={profitAt} dur={36} format={(n) => fmtUSD(n, 2)} />
          </div>
          <div style={{ fontFamily: fonts.body, fontSize: 27, color: colors.muted, marginTop: 22 }}>Illustrative gross profit · before costs</div>
        </Card>
        {/* Marker circle around the number + pointer */}
        <svg width={1080} height={1920} style={{ position: "absolute", overflow: "visible" }}>
          <Stroke d="M700 968 C 820 974, 866 1010, 858 1042 C 846 1090, 640 1110, 420 1108 C 200 1106, 52 1084, 50 1036 C 48 986, 230 958, 450 956 C 600 955, 720 962, 780 980" p={circleP} width={7} />
        </svg>
      </div>
      <div
        style={{
          position: "absolute",
          right: SAFE.x + 6,
          top: 1240 + bob * noteP,
          display: "flex",
          alignItems: "center",
          gap: 14,
          opacity: noteP,
        }}
      >
        <svg width={70} height={70} viewBox="0 0 70 70" style={{ transform: "rotate(-40deg)" }}>
          <path d="M8 62 C 20 40, 38 24, 60 10 M44 10 L60 10 L56 26" fill="none" stroke={colors.greenBright} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: fonts.hand, fontWeight: 700, fontSize: 50, color: colors.text }}>
          ≈ +{pos.returnOnCapitalPct.toFixed(0)}% on your $25K
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: SAFE.x,
          top: 1244,
          fontFamily: fonts.body,
          fontSize: 25,
          lineHeight: 1.35,
          color: "#e6a3a5",
          opacity: prog(f, profitAt + 20, 16),
          maxWidth: 400,
        }}
      >
        An 8% fall would lose
        <br />−{fmtUSD(pos.grossLossIfDown, 2)}
      </div>
      <ComplianceStrip text="Hypothetical · leveraged · before costs · not guaranteed" delay={investAt} />
    </AbsoluteFill>
  );
};
