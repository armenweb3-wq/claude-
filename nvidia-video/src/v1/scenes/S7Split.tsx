import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fonts as sharedFonts } from "../../theme";
import { Backdrop, clamp, Column, Counter, Headline, Kicker, prog } from "../components/primitives";
import { fmtInt, fmtUSD, positions, priceMovePct } from "../data/content";
import { beat } from "../data/timeline";
import { colors, fonts, SAFE } from "../theme";

/**
 * Page 7: the investment and its potential return, front and centre.
 * Each tier reads "You invest → Potential return", with the return counted up and circled.
 */
const TIER_H = 450;

const Tier: React.FC<{ index: number; top: number; start: number; circleAt: number }> = ({ index, top, start, circleAt }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = positions[index];
  const enter = spring({ frame: f - start, fps, config: { damping: 22, mass: 0.9 } });
  const returnAt = start + 26;
  const circle = interpolate(f, [circleAt, circleAt + 20], [0, 1], clamp);
  const glow = prog(f, circleAt, 16);
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.x,
        right: SAFE.x,
        top,
        height: TIER_H,
        borderRadius: 34,
        padding: "30px 40px",
        boxSizing: "border-box",
        background: `linear-gradient(160deg, ${colors.charcoal2}, ${colors.charcoal})`,
        border: `2px solid ${glow > 0.5 ? colors.green : colors.line}`,
        boxShadow: `0 30px 80px rgba(0,0,0,0.55), 0 0 ${90 * glow}px ${colors.green}44`,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 80}px)`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* You invest */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 26, letterSpacing: 4, color: colors.muted }}>YOU INVEST</span>
        <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 84, color: colors.text, letterSpacing: -2 }}>
          <Counter to={p.capital} start={start + 4} dur={22} format={(n) => fmtUSD(n)} />
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "2px 0 6px", opacity: prog(f, returnAt - 8, 10) }}>
        <svg width={44} height={44} viewBox="0 0 44 44">
          <path d="M22 4 V36 M10 26 L22 38 L34 26" stroke={colors.green} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: sharedFonts.hand, fontWeight: 700, fontSize: 44, color: colors.greenBright }}>if NVDA rises {priceMovePct}%</span>
      </div>
      {/* Potential return */}
      <div style={{ fontFamily: fonts.mono, fontSize: 26, letterSpacing: 4, color: colors.green, opacity: prog(f, returnAt, 10), marginBottom: 14 }}>POTENTIAL RETURN</div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: prog(f, returnAt, 10) }}>
        <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 116, color: colors.greenBright, letterSpacing: -3, lineHeight: 1.05, textShadow: `0 0 40px ${colors.green}66` }}>
          <Counter to={p.grossProfit} start={returnAt} dur={40} format={(n) => fmtUSD(n, 2)} />
        </span>
        <span
          style={{
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 40,
            color: colors.ink,
            background: colors.green,
            borderRadius: 100,
            padding: "8px 20px",
            opacity: prog(f, circleAt, 12),
            transform: `scale(${0.8 + 0.2 * prog(f, circleAt, 12)})`,
          }}
        >
          +{p.returnOnCapitalPct.toFixed(0)}%
        </span>
        {/* marker circle around the return */}
        <svg width={700} height={150} style={{ position: "absolute", left: -26, top: -12, overflow: "visible" }}>
          <path
            d="M520 14 C 640 20, 688 50, 668 82 C 648 122, 420 132, 250 129 C 90 126, 6 106, 10 72 C 14 32, 160 10, 360 9 C 440 8, 520 11, 580 20"
            fill="none"
            stroke={colors.greenBright}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={1700}
            strokeDashoffset={1700 * (1 - circle)}
            style={{ filter: `drop-shadow(0 0 8px ${colors.green})` }}
          />
        </svg>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ fontFamily: fonts.body, fontSize: 24, color: colors.muted, opacity: prog(f, returnAt + 20, 14) }}>
        {fmtInt(p.shares)} shares · ≈{p.leverage.toFixed(1)}× leverage · before costs
      </div>
    </div>
  );
};

export const S7Split: React.FC = () => {
  const left = beat("split", "left");
  const right = beat("split", "right");
  return (
    <AbsoluteFill>
      <Backdrop glow={0.9} />
      <Column top={210} gap={20}>
        <Kicker delay={2}>Your investment · potential return</Kicker>
        <Headline text="What it could make you." accent={["make", "you."]} delay={4} size={86} />
      </Column>
      <Tier index={0} top={450} start={left} circleAt={beat("split", "circleA")} />
      <Tier index={1} top={450 + TIER_H + 30} start={right} circleAt={beat("split", "emphasis")} />
    </AbsoluteFill>
  );
};
