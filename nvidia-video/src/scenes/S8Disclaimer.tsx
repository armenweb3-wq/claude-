import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Backdrop, Column, Headline, Kicker, prog } from "../components/primitives";
import { fmtUSD, positions, price, priceMovePct } from "../data/content";
import { beat } from "../data/timeline";
import { colors, fonts } from "../theme";

const [a, b] = positions;

const items: { t: string; warn?: boolean }[] = [
  { t: `Scenario prices ${fmtUSD(price.start, 2)} → ${fmtUSD(price.target, 2)} (+${priceMovePct}%) are illustrative, not a forecast.` },
  { t: `Leverage ≈${a.leverage.toFixed(1)}× on ${fmtUSD(a.capital)} and ≈${b.leverage.toFixed(1)}× on ${fmtUSD(b.capital)} (position ÷ own capital).` },
  { t: "Gross figures exclude margin interest, commissions, spreads, taxes and FX." },
  {
    t: `An 8% fall would mean losses of −${fmtUSD(a.grossLossIfDown, 2)} and −${fmtUSD(b.grossLossIfDown, 2)} (${a.returnOnCapitalPct.toFixed(0)}% / ${b.returnOnCapitalPct.toFixed(0)}% of capital).`,
    warn: true,
  },
  { t: "Revenue and catalyst details as supplied — verify with NVIDIA filings. Not affiliated with or endorsed by NVIDIA or its founder." },
];

export const S8Disclaimer: React.FC = () => {
  const f = useCurrentFrame();
  const losses = beat("disclaimer", "losses");
  const end = beat("disclaimer", "end");
  const listOut = prog(f, end, 18);
  const endIn = prog(f, end + 8, 24);
  return (
    <AbsoluteFill>
      <Backdrop glow={0.6} />
      <AbsoluteFill style={{ opacity: 1 - listOut, filter: listOut > 0.02 ? `blur(${listOut * 8}px)` : undefined }}>
        <Column top={210} gap={22}>
          <Kicker delay={4}>Assumptions & disclaimer</Kicker>
          <Headline text="Hypothetical. Before costs. Not guaranteed." accent={["Not", "guaranteed"]} delay={6} size={80} />
          <div style={{ height: 8 }} />
          {items.map((it, i) => {
            const at = it.warn ? losses : 14 + i * 7;
            const p = prog(f, at, 18);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 20,
                  alignItems: "flex-start",
                  opacity: p,
                  transform: `translateY(${(1 - p) * 14}px)`,
                  padding: it.warn ? "18px 22px" : "0 22px",
                  borderRadius: 18,
                  background: it.warn ? "rgba(229,72,77,0.10)" : undefined,
                  border: it.warn ? "1px solid rgba(229,72,77,0.45)" : undefined,
                }}
              >
                <span style={{ fontFamily: fonts.mono, fontSize: 26, color: it.warn ? colors.red : colors.green, paddingTop: 2 }}>{it.warn ? "!" : "—"}</span>
                <span style={{ fontFamily: fonts.body, fontSize: 31, lineHeight: 1.4, color: it.warn ? colors.text : "#cfd3d0" }}>{it.t}</span>
              </div>
            );
          })}
        </Column>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: endIn, alignItems: "center", justifyContent: "center", paddingBottom: 380 }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 28, letterSpacing: 10, color: colors.green, marginBottom: 26 }}>NVDA</div>
        <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 96, color: colors.text, textAlign: "center", lineHeight: 1.04, letterSpacing: -2 }}>
          The AI
          <br />
          infrastructure story.
        </div>
        <div style={{ width: 120 * endIn, height: 3, background: colors.green, margin: "34px 0" }} />
        <div style={{ fontFamily: fonts.body, fontSize: 30, color: colors.muted, textAlign: "center" }}>
          Hypothetical · before costs · leverage magnifies losses
          <br />
          Educational content · not financial advice
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
