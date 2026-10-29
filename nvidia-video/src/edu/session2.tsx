import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import vo from "../data/voiceover-edu2.json";
import { EduFilm, useScene } from "./EduFilm";
import { Card, Chart, E, EF, In, KeyPoint, p, Points, Pop, TopicTitle, usd } from "./kit";
import { CourseTitle, Recap } from "./shared";
import { makeTimeline } from "./timeline";

const ACCENT = E.teal;
const tl = makeTimeline(vo);
const PIP_VALUE = 10; // USD per pip per standard lot on EUR/USD

/** Maps a price to the chart's y position (must match Chart's default geometry). */
const yOf = (v: number, lo: number, hi: number) => 40 + (1 - (v - lo) / (hi - lo)) * 600;

const Overlay: React.FC<{ at: number; x?: number; y?: number; w?: number; children: React.ReactNode; tone?: "dark" | "light" }> = ({ at, x = 30, y = 30, w = 420, children, tone = "dark" }) => {
  const f = useCurrentFrame();
  const a = p(f, at, 14);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        padding: "18px 22px",
        borderRadius: 18,
        background: tone === "dark" ? "rgba(23,38,61,0.95)" : "white",
        border: `1px solid ${tone === "dark" ? "#2C4166" : E.line}`,
        boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
        opacity: a,
        transform: `translateY(${(1 - a) * 12}px)`,
        color: tone === "dark" ? "white" : E.ink,
      }}
    >
      {children}
    </div>
  );
};
const Lbl: React.FC<{ children: React.ReactNode; c?: string }> = ({ children, c = "#8FA3BF" }) => (
  <div style={{ fontFamily: EF.mono, fontSize: 19, letterSpacing: 2.5, color: c, textTransform: "uppercase" }}>{children}</div>
);
const Big: React.FC<{ children: React.ReactNode; c?: string; s?: number }> = ({ children, c = "white", s = 40 }) => (
  <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: s, color: c, lineHeight: 1.15 }}>{children}</div>
);

const Title: React.FC = () => {
  const { at } = useScene();
  return (
    <CourseTitle
      session={2}
      title="Orders & Market Types"
      objective="The main order types for executing trades and managing risk."
      topics={["Market orders", "Stop Loss", "Take Profit", "Pending orders"]}
      topicsAt={at(1)}
      accent={ACCENT}
    />
  );
};

const Market: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const Btn: React.FC<{ side: "SELL" | "BUY"; price: string; c: string; label: string }> = ({ side, price, c, label }) => (
    <div style={{ flex: 1, borderRadius: 24, background: c, padding: "26px 28px", color: "white" }}>
      <div style={{ fontFamily: EF.mono, fontSize: 22, letterSpacing: 3, opacity: 0.85 }}>
        {side} · {label}
      </div>
      <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 64, fontVariantNumeric: "tabular-nums" }}>
        {price.slice(0, -1)}
        <span style={{ fontSize: 40, verticalAlign: "top" }}>{price.slice(-1)}</span>
      </div>
    </div>
  );
  return (
    <>
      <TopicTitle n={1} title="Market orders" tag="Trade now, at the best available price." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Executes immediately", at: at(1) },
          { text: <>You <b style={{ color: E.blue }}>buy at the ask</b>, <b style={{ color: E.red }}>sell at the bid</b></>, at: at(2) },
          { text: "Ask − bid = the spread (a trading cost)", at: at(2, 3) },
        ]}
      />
      <Card>
        <div style={{ padding: 44, display: "flex", flexDirection: "column", gap: 30, height: "100%", boxSizing: "border-box", justifyContent: "center" }}>
          <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 44, color: E.ink }}>EUR/USD</div>
          <div style={{ display: "flex", gap: 18, position: "relative" }}>
            <Btn side="SELL" price="1.09990" c={E.red} label="bid" />
            <Btn side="BUY" price="1.10000" c={E.blue} label="ask" />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: -26,
                transform: "translateX(-50%)",
                padding: "8px 18px",
                borderRadius: 100,
                background: E.ink,
                color: "white",
                fontFamily: EF.mono,
                fontSize: 22,
                opacity: p(f, at(2, 3), 12),
              }}
            >
              spread 1.0 pip
            </div>
          </div>
          <In at={at(1)}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "20px 26px", borderRadius: 20, background: `${E.green}14`, border: `2px solid ${E.green}` }}>
              <div style={{ width: 46, height: 46, borderRadius: 23, background: E.green, color: "white", fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>
              <div style={{ fontFamily: EF.body, fontSize: 30, color: E.ink }}>
                Market order · <b>Buy 1 lot</b> · filled at <b>1.10000</b>
              </div>
            </div>
          </In>
        </div>
      </Card>
    </>
  );
};

const StopLoss: React.FC = () => {
  const { at, end } = useScene();
  const lo = 1.086;
  const hi = 1.104;
  const hit = end(3, 0.5);
  const path = [
    { f: at(2), p: 1.1 },
    { f: at(2, 2), p: 1.1012 },
    { f: at(3), p: 1.0985 },
    { f: hit, p: 1.095 },
  ];
  return (
    <>
      <TopicTitle n={2} title="Stop loss" tag="Closes your trade automatically if price moves against you." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Limits the loss, decided in advance", at: at(1) },
          { text: "Buy 1.1000 · stop 1.0950 = 50 pips", at: at(2) },
          { text: <>50 pips × $10 × 1 lot ≈ <b style={{ color: E.red }}>{usd(50 * PIP_VALUE)}</b> max planned loss</>, at: at(3) },
          { text: "Fast markets and gaps can cause slippage", at: at(4) },
        ]}
      />
      <Card dark>
        <Chart
          lo={lo}
          hi={hi}
          start={1.1}
          path={path}
          seed="sl"
          trend={0.001}
          levels={[
            { price: 1.1, label: "Buy (entry)", color: E.blue, at: at(2), side: "left" },
            { price: 1.095, label: "Stop loss", color: E.red, at: at(2, 2.5), side: "left" },
          ]}
          zones={[{ from: 1.095, to: 1.1, color: E.red, at: at(3), label: "Risk: 50 pips", side: "center" }]}
          markers={[{ f: hit, label: "Stopped out: −$500", color: E.red }]}
        />
        <Overlay at={at(4)} x={30} y={480} w={520}>
          <Lbl c={E.amber}>Slippage</Lbl>
          <div style={{ fontFamily: EF.body, fontSize: 24, lineHeight: 1.35, marginTop: 6 }}>If price jumps past your stop (news, weekend gap), the fill can be worse than 1.0950.</div>
        </Overlay>
      </Card>
    </>
  );
};

const StopPlacement: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const lo = 1.088;
  const hi = 1.104;
  const path = [
    { f: at(0), p: 1.1 },
    { f: at(2), p: 1.1006 },
    { f: at(4), p: 1.0997 },
    { f: at(5, 3), p: 1.1004 },
  ];
  const ghost = (price: number, label: string, c: string) => {
    const a = p(f, at(2), 12) * (1 - p(f, at(3), 12));
    return (
      <div style={{ position: "absolute", left: 30, width: 700, top: yOf(price, lo, hi) - 1, borderTop: `3px dashed ${c}`, opacity: a }}>
        <div style={{ fontFamily: EF.display, fontWeight: 700, fontSize: 24, color: c, marginTop: 4 }}>{label}</div>
      </div>
    );
  };
  return (
    <>
      <TopicTitle n={2} title="Placing a stop loss" tag="Where your trade idea is proven wrong." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Just beyond a recent low, support or resistance", at: at(1) },
          { text: "Not too close (noise), not too far (big loss)", at: at(2) },
          { text: "Choose the stop first, then the trade size", at: at(3) },
        ]}
      />
      <KeyPoint at={at(5)} accent={ACCENT}>
        Risk ÷ (stop in pips × pip value) = position size.
      </KeyPoint>
      <Card dark>
        <Chart
          lo={lo}
          hi={hi}
          start={1.1}
          path={path}
          seed="place"
          levels={[
            { price: 1.1, label: "Entry", color: E.blue, at: at(0, 0.5), side: "left" },
            { price: 1.095, label: "Stop: beyond support", color: E.red, at: at(1, 2), side: "left" },
          ]}
          zones={[{ from: 1.096, to: 1.0972, color: E.green, at: at(1), label: "Support (recent low)" }]}
        />
        {ghost(1.099, "Too close: noise can hit it", E.amber)}
        {ghost(1.09, "Too far: loss too large", E.amber)}
        <Overlay at={at(4)} x={30} y={430} w={560} tone="light">
          <Lbl c={E.sub}>Position size</Lbl>
          <Big c={E.ink} s={34}>
            1% × $10,000 = <span style={{ color: E.red }}>$100 risk</span>
          </Big>
          <div style={{ opacity: p(f, at(5), 12) }}>
            <Big c={E.ink} s={34}>
              $100 ÷ (50 × $10) = <span style={{ color: ACCENT }}>0.2 lots</span>
            </Big>
          </div>
        </Overlay>
      </Card>
    </>
  );
};

const TakeProfit: React.FC = () => {
  const { at, end } = useScene();
  const lo = 1.092;
  const hi = 1.114;
  const hit = end(2, -0.5);
  const path = [
    { f: at(2), p: 1.1 },
    { f: at(2, 2.5), p: 1.1035 },
    { f: at(2, 4), p: 1.1022 },
    { f: hit, p: 1.11 },
  ];
  return (
    <>
      <TopicTitle n={3} title="Take profit" tag="Closes the trade automatically at your target." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Locks in gains, even when you're away", at: at(1) },
          { text: <>Target 1.1100 = 100 pips ≈ <b style={{ color: E.green }}>$1,000</b> (1 lot)</>, at: at(2) },
          { text: "Risk 50 to make 100 → risk : reward = 1 : 2", at: at(3) },
          { text: "Targets should fit your strategy and the market", at: at(4) },
        ]}
      />
      <Card dark>
        <Chart
          lo={lo}
          hi={hi}
          start={1.1}
          path={path}
          seed="tp"
          levels={[
            { price: 1.11, label: "Take profit", color: E.green, at: at(2, 2), side: "left" },
            { price: 1.1, label: "Entry", color: E.blue, at: at(2), side: "left" },
            { price: 1.095, label: "Stop loss", color: E.red, at: at(2, 1), side: "left" },
          ]}
          zones={[
            { from: 1.1, to: 1.11, color: E.green, at: at(3), label: "Reward 100 pips", side: "center" },
            { from: 1.095, to: 1.1, color: E.red, at: at(3), label: "Risk 50", side: "center" },
          ]}
          markers={[{ f: hit, label: "Target hit: +$1,000", color: E.green }]}
        />
        <Pop at={at(3, 1.5)} style={{ position: "absolute", right: 170, bottom: 40 }}>
          <div style={{ padding: "14px 26px", borderRadius: 16, background: "white", fontFamily: EF.display, fontWeight: 800, fontSize: 40, color: E.ink }}>
            R : R = <span style={{ color: E.red }}>1</span> : <span style={{ color: E.green }}>2</span>
          </div>
        </Pop>
      </Card>
    </>
  );
};

const Pending: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const lo = 1.09;
  const hi = 1.11;
  const path = [
    { f: at(1), p: 1.1 },
    { f: at(4), p: 1.1006 },
    { f: at(6), p: 1.0996 },
    { f: at(7, 4), p: 1.1002 },
  ];
  return (
    <>
      <TopicTitle n={4} title="Pending orders" tag="Open a trade later, only if price reaches your level." accent={ACCENT} />
      <Points
        accent={ACCENT}
        top={400}
        size={31}
        items={[
          { text: <><b style={{ color: E.blue }}>Buy Limit</b> · below · dip, then rise</>, at: at(3) },
          { text: <><b style={{ color: E.red }}>Sell Limit</b> · above · rise, then fall</>, at: at(4) },
          { text: <><b style={{ color: E.blue }}>Buy Stop</b> · above · breakout up</>, at: at(5) },
          { text: <><b style={{ color: E.red }}>Sell Stop</b> · below · breakdown</>, at: at(6) },
        ]}
      />
      <KeyPoint at={at(7)} accent={ACCENT}>
        Limit orders look for a better price. Stop orders follow momentum.
      </KeyPoint>
      <Card dark>
        <Chart
          lo={lo}
          hi={hi}
          start={1.1}
          path={path}
          seed="pend"
          levels={[
            { price: 1.1, label: "Market price", color: "#8FA3BF", at: at(1), dash: true, side: "left" },
            { price: 1.096, label: "Buy Limit", color: E.blue, at: at(3), side: "left" },
            { price: 1.104, label: "Sell Limit", color: E.red, at: at(4), side: "left" },
            { price: 1.107, label: "Buy Stop", color: E.blue, at: at(5), side: "left", dash: true },
            { price: 1.093, label: "Sell Stop", color: E.red, at: at(6), side: "left", dash: true },
          ]}
        />
        <div style={{ position: "absolute", right: 170, top: 40, display: "flex", flexDirection: "column", gap: 8, opacity: p(f, at(7), 14) }}>
          <div style={{ padding: "8px 16px", borderRadius: 12, background: "#22385B", color: "white", fontFamily: EF.mono, fontSize: 20 }}>solid = LIMIT · better price</div>
          <div style={{ padding: "8px 16px", borderRadius: 12, background: "#22385B", color: "white", fontFamily: EF.mono, fontSize: 20 }}>dashed = STOP · momentum</div>
        </div>
      </Card>
    </>
  );
};

const Plan: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const Field: React.FC<{ k: string; v: string; c?: string; hl?: number }> = ({ k, v, c = "white", hl = 0 }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "16px 22px",
        borderRadius: 14,
        background: "#17263D",
        border: `2px solid ${hl > 0.5 ? c : "#253753"}`,
        boxShadow: hl > 0.5 ? `0 0 24px ${c}55` : "none",
      }}
    >
      <span style={{ fontFamily: EF.mono, fontSize: 22, color: "#8FA3BF", letterSpacing: 2 }}>{k}</span>
      <span style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 30, color: c }}>{v}</span>
    </div>
  );
  const hl = p(f, at(0, 2), 10);
  return (
    <>
      <TopicTitle n={4} title="Planning entries in advance" tag="Set the whole trade before it opens." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "No need to watch the screen", at: at(2) },
          { text: "Fewer emotional, last-minute decisions", at: at(2, 2) },
          { text: "Every trade starts with a defined risk", at: at(2, 4) },
          { text: "May never trigger; fills can differ in fast markets", at: at(3) },
        ]}
      />
      <Card dark>
        <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 14, height: "100%", boxSizing: "border-box" }}>
          <Lbl>New order · EUR/USD</Lbl>
          <Field k="TYPE" v="Buy Limit" c={E.teal} />
          <Field k="ENTRY PRICE" v="1.0960" />
          <Field k="VOLUME" v="0.20 lots" />
          <Field k="STOP LOSS" v="1.0910  (−50 pips)" c={E.red} hl={hl} />
          <Field k="TAKE PROFIT" v="1.1060  (+100 pips)" c={E.green} hl={hl} />
          <div style={{ flex: 1 }} />
          <In at={at(1)}>
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ flex: 1, padding: "14px 20px", borderRadius: 14, background: `${E.red}22`, color: "white", fontFamily: EF.body, fontSize: 24 }}>
                Max risk <b style={{ color: E.red }}>{usd(50 * PIP_VALUE * 0.2)}</b>
              </div>
              <div style={{ flex: 1, padding: "14px 20px", borderRadius: 14, background: `${E.green}22`, color: "white", fontFamily: EF.body, fontSize: 24 }}>
                Target <b style={{ color: E.green }}>{usd(100 * PIP_VALUE * 0.2)}</b>
              </div>
            </div>
          </In>
          <div style={{ padding: "18px 0", textAlign: "center", borderRadius: 16, background: E.teal, color: "white", fontFamily: EF.display, fontWeight: 800, fontSize: 30 }}>Place order</div>
        </div>
      </Card>
    </>
  );
};

const RecapScene: React.FC = () => {
  const { at } = useScene();
  return (
    <Recap
      accent={ACCENT}
      title="Session 2 recap"
      items={[
        { t: "Market order: trades now, at the current price.", at: at(1) },
        { t: "Stop loss: limits your loss at a level you choose.", at: at(2) },
        { t: "Take profit: locks in your gain at your target.", at: at(2, 2) },
        { t: "Pending orders: limit for a better price, stop for momentum.", at: at(3) },
      ]}
      next={{ label: "Next · Session 3", text: "Advanced strategies", at: at(4) }}
    />
  );
};

export const session2 = {
  tl,
  element: () => (
    <EduFilm
      tl={tl}
      session={2}
      name="Orders & market types"
      accent={ACCENT}
      topics={{ market: 1, sl: 2, slplace: 2, tp: 3, pending: 4, plan: 4 }}
      scenes={{ title: Title, market: Market, sl: StopLoss, slplace: StopPlacement, tp: TakeProfit, pending: Pending, plan: Plan, recap: RecapScene }}
    />
  ),
};

export const Session2: React.FC = () => <AbsoluteFill>{session2.element()}</AbsoluteFill>;
