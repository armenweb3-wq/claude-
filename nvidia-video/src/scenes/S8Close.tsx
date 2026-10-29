import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Column, Headline, Kicker, prog } from "../components/primitives";
import { fmtUSD, positions, priceMovePct } from "../data/content";
import { beat } from "../data/timeline";
import { colors, fonts, SAFE } from "../theme";
import { ChipIcon, ShovelIcon } from "./SWhy";

const pos = positions[0];

const Row: React.FC<{ up: boolean; at: number }> = ({ up, at }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 200, mass: 1.6 } });
  const c = up ? colors.greenBright : colors.red;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        padding: "26px 34px",
        borderRadius: 28,
        background: `${c}14`,
        border: `2px solid ${c}88`,
        opacity: s,
        transform: `translateX(${(1 - s) * (up ? -60 : 60)}px)`,
      }}
    >
      <div style={{ fontSize: 80, color: c, lineHeight: 1 }}>{up ? "▲" : "▼"}</div>
      <div>
        <div style={{ fontFamily: fonts.body, fontSize: 34, color: colors.muted }}>
          Price {up ? "rises" : "falls"} {priceMovePct}%
        </div>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 72, color: c }}>
          {up ? "+" : "−"}
          {fmtUSD(pos.grossProfit, 2)}
        </div>
      </div>
    </div>
  );
};

/** One plain sentence on risk, then the end card. */
export const S8Close: React.FC = () => {
  const f = useCurrentFrame();
  const risk = beat("close", "risk");
  const end = beat("close", "end");
  const out = prog(f, end - 6, 16);
  const endIn = prog(f, end + 8, 24);
  return (
    <AbsoluteFill>
      <Backdrop glow={0.8} />
      <AbsoluteFill style={{ opacity: 1 - out }}>
        <Column top={210} gap={30}>
          <Kicker delay={4}>One thing to remember</Kicker>
          <Headline text="Leverage works both ways." accent={["both", "ways."]} delay={8} size={92} />
          <div style={{ height: 30 }} />
          <Row up at={risk + 40} />
          <Row up={false} at={risk + 90} />
          <div style={{ fontFamily: fonts.body, fontSize: 32, color: colors.muted, textAlign: "center", opacity: prog(f, risk + 120, 20) }}>
            on {fmtUSD(pos.capital)} of your own money
          </div>
        </Column>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: endIn, alignItems: "center", paddingTop: 300 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <ShovelIcon size={200} />
          <div style={{ fontSize: 70, color: colors.muted }}>→</div>
          <ChipIcon size={200} />
        </div>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 150, color: colors.text, letterSpacing: -3, marginTop: 30 }}>NVIDIA</div>
        <div style={{ width: 160 * endIn, height: 4, background: colors.green, margin: "20px 0 30px" }} />
        <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 56, color: colors.text, textAlign: "center", lineHeight: 1.2, padding: `0 ${SAFE.x}px` }}>
          selling the <span style={{ color: colors.gold }}>shovels</span>
          <br />
          of the AI age
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
