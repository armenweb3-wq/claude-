import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Body, clamp, Column, Counter, Headline, Kicker, prog, SLOW } from "../components/primitives";
import { fmtInt, fmtUSD, positions } from "../data/content";
import { beat } from "../data/timeline";
import { colors, fonts, SAFE } from "../theme";

const pos = positions[0];
const BAR_W = 1080 - SAFE.x * 2;
const BAR_TOP = 720;
const BAR_H = 130;

/** Shows, to scale, how $25,000 of your own money plus a broker loan becomes a $124,696 position. */
export const SLeverage: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const own = beat("leverage", "own");
  const borrow = beat("leverage", "borrow");
  const total = beat("leverage", "total");
  const multiple = beat("leverage", "multiple");
  const ownW = (pos.capital / pos.exposure) * BAR_W;
  const ownP = prog(f, own, 20);
  const borrowP = interpolate(f, [borrow, borrow + 40 * SLOW], [0, 1], clamp);
  const totalIn = spring({ frame: f - total, fps, config: { damping: 200, mass: 1.6 } });
  const multIn = spring({ frame: f - multiple, fps, config: { damping: 14, mass: 1.4 } });
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>How the idea works</Kicker>
        <Headline text="Borrowed money is called leverage." accent={["leverage."]} delay={8} size={84} />
      </Column>

      {/* labels above the bar */}
      <div style={{ position: "absolute", left: SAFE.x, top: BAR_TOP - 110, width: 330, opacity: ownP }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 24, letterSpacing: 3, color: colors.greenBright }}>YOUR MONEY</div>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 50, color: colors.text }}>{fmtUSD(pos.capital)}</div>
      </div>
      <div style={{ position: "absolute", right: SAFE.x, top: BAR_TOP - 110, textAlign: "right", opacity: prog(f, borrow, 16) }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 24, letterSpacing: 3, color: colors.teal }}>BORROWED FROM BROKER</div>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 50, color: colors.text }}>
          ≈ <Counter to={pos.borrowed} start={borrow} dur={40} format={(n) => fmtUSD(Math.round(n / 1000) * 1000)} />
        </div>
      </div>

      {/* the to-scale bar */}
      <div style={{ position: "absolute", left: SAFE.x, top: BAR_TOP, width: BAR_W, height: BAR_H, borderRadius: 20, background: "rgba(255,255,255,0.05)", border: `2px solid ${colors.line}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: ownW * ownP, background: `linear-gradient(180deg, ${colors.greenBright}, ${colors.green})` }} />
        <div
          style={{
            position: "absolute",
            left: ownW,
            top: 0,
            bottom: 0,
            width: (BAR_W - ownW) * borrowP,
            background: `repeating-linear-gradient(135deg, ${colors.teal}cc 0 18px, ${colors.teal}88 18px 36px)`,
          }}
        />
      </div>

      {/* bracket + total */}
      <svg width={1080} height={1920} style={{ position: "absolute", opacity: totalIn }}>
        <path d={`M${SAFE.x} ${BAR_TOP + BAR_H + 24} v22 H ${SAFE.x + BAR_W} v-22`} fill="none" stroke={colors.text} strokeWidth={4} />
        <path d={`M540 ${BAR_TOP + BAR_H + 46} v24`} stroke={colors.text} strokeWidth={4} />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: BAR_TOP + BAR_H + 80, textAlign: "center", opacity: totalIn, transform: `translateY(${(1 - totalIn) * 20}px)` }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 96, color: colors.text, letterSpacing: -2 }}>
          <Counter to={pos.shares} start={total} dur={30} format={fmtInt} /> shares
        </div>
        <Body size={36} color={colors.muted}>
          worth {fmtUSD(pos.exposure)} at $218 each
        </Body>
      </div>

      {/* the multiple */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1200, display: "flex", justifyContent: "center", opacity: Math.min(1, multIn) }}>
        <div
          style={{
            transform: `scale(${0.7 + 0.3 * multIn})`,
            padding: "14px 36px",
            borderRadius: 100,
            background: colors.green,
            color: colors.ink,
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 48,
          }}
        >
          ≈ {pos.leverage.toFixed(0)}× what your money buys alone
        </div>
      </div>
    </AbsoluteFill>
  );
};
