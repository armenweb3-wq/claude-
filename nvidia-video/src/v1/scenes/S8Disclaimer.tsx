import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Backdrop, prog } from "../components/primitives";
import { fmtUSD, positions, priceMovePct } from "../data/content";
import { beat } from "../data/timeline";
import { colors, fonts, SAFE } from "../theme";

const [a, b] = positions;

/** Closing card: the story in one line, the two outcomes, and a calm, small-print note. */
export const S8Disclaimer: React.FC = () => {
  const f = useCurrentFrame();
  const t = beat("disclaimer", "end");
  const inA = prog(f, t, 24);
  const inB = prog(f, t + 16, 24);
  const inNote = prog(f, t + 34, 30);
  return (
    <AbsoluteFill>
      <Backdrop glow={0.7} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 300 }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 28, letterSpacing: 10, color: colors.green, opacity: inA }}>NVDA</div>
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 104,
            color: colors.text,
            textAlign: "center",
            lineHeight: 1.04,
            letterSpacing: -2,
            marginTop: 24,
            opacity: inA,
            transform: `translateY(${(1 - inA) * 20}px)`,
          }}
        >
          The AI
          <br />
          infrastructure story.
        </div>
        <div style={{ width: 140 * inA, height: 4, background: colors.green, margin: "40px 0" }} />
        <div style={{ display: "flex", gap: 22, opacity: inB, transform: `translateY(${(1 - inB) * 16}px)` }}>
          {[a, b].map((p) => (
            <div key={p.capital} style={{ padding: "20px 28px", borderRadius: 22, border: `1px solid ${colors.line}`, background: `${colors.charcoal}cc`, textAlign: "center" }}>
              <div style={{ fontFamily: fonts.body, fontSize: 28, color: colors.muted }}>Invest {fmtUSD(p.capital)}</div>
              <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 52, color: colors.greenBright }}>{fmtUSD(p.grossProfit, 2)}</div>
              <div style={{ fontFamily: fonts.body, fontSize: 22, color: colors.muted }}>potential return</div>
            </div>
          ))}
        </div>
      </AbsoluteFill>
      {/* Small, neutral note — informative, not alarming */}
      <div
        style={{
          position: "absolute",
          left: SAFE.x + 20,
          right: SAFE.x + 20,
          top: 1210,
          textAlign: "center",
          fontFamily: fonts.body,
          fontSize: 23,
          lineHeight: 1.5,
          color: colors.dim,
          opacity: inNote,
        }}
      >
        Illustrative example based on a {priceMovePct}% price move and the leverage shown. Figures are before interest, fees and taxes and
        aren't guaranteed; leverage can increase losses as well as gains. For information only, not financial advice.
      </div>
    </AbsoluteFill>
  );
};
