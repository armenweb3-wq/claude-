import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import vo from "../data/voiceover-avg-gold.json";
import { EduFilm, useScene } from "./EduFilm";
import { Card, Chart, E, EF, Formula, In, KeyPoint, p, pathPrice, Points, Pop, TopicTitle, usd } from "./kit";
import { makeTimeline } from "./timeline";

/*
 * 60-second explainer: averaging into a losing gold position.
 * XAU/USD: 1 standard lot = 100 oz, so a $1 move = $100 per lot.
 */
const ACCENT = E.amber;
const tl = makeTimeline(vo);
const OZ = 100;
const ENTRY = 4000;
const LOW = 3960;
const LOSS = (LOW - ENTRY) * OZ; // −4,000
const ADD = 2; // "twice the position"
const LOTS = 1 + ADD;
const AVG = (ENTRY * 1 + LOW * ADD) / LOTS; // 3,973.33
const NEED = AVG - LOW; // 13.33
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const plAt = (price: number, lots: number, avg: number) => Math.round((price - avg) * OZ * lots);
const usd2 = (n: number) => usd(n, 2);

const Panel: React.FC<{ rows: { k: string; v: React.ReactNode; c?: string }[]; at: number; big?: { k: string; v: number } }> = ({ rows, at, big }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 30, bottom: 30, width: 470, padding: "16px 22px", borderRadius: 18, background: "rgba(23,38,61,0.96)", border: "1px solid #2C4166", opacity: p(f, at, 12) }}>
      {rows.map((r) => (
        <div key={r.k} style={{ display: "flex", justifyContent: "space-between", fontFamily: EF.mono, fontSize: 21, color: "#8FA3BF", letterSpacing: 1.5, marginBottom: 6 }}>
          <span>{r.k}</span>
          <span style={{ color: r.c ?? "white", fontWeight: 700 }}>{r.v}</span>
        </div>
      ))}
      {big && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid #2C4166", paddingTop: 8 }}>
          <span style={{ fontFamily: EF.mono, fontSize: 21, color: "#8FA3BF", letterSpacing: 1.5 }}>{big.k}</span>
          <span style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 46, color: big.v >= 0 ? E.green : E.red, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {(big.v > 0 ? "+" : "") + usd(big.v)}
          </span>
        </div>
      )}
    </div>
  );
};

const Title: React.FC = () => {
  const f = useCurrentFrame();
  const a = p(f, 4, 22);
  return (
    <div style={{ position: "absolute", left: 160, right: 160, top: 230, opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}>
      <div style={{ fontFamily: EF.mono, fontSize: 30, letterSpacing: 6, color: ACCENT, fontWeight: 700 }}>TRADING EDUCATION · GOLD (XAU/USD)</div>
      <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 150, lineHeight: 1, color: E.ink, letterSpacing: -4, marginTop: 20 }}>Averaging</div>
      <div style={{ fontFamily: EF.display, fontWeight: 700, fontSize: 64, color: E.sub, marginTop: 10 }}>
        a losing position: <span style={{ color: ACCENT }}>how it really works</span>
      </div>
      <div style={{ width: 180 * a, height: 8, borderRadius: 4, background: ACCENT, marginTop: 40 }} />
    </div>
  );
};

const Setup: React.FC = () => {
  const { at, end } = useScene();
  const f = useCurrentFrame();
  const path = [
    { f: at(0), p: ENTRY },
    { f: at(1), p: 3988 },
    { f: end(1, -0.3), p: LOW },
  ];
  const price = pathPrice(path, f);
  return (
    <>
      <TopicTitle n={1} title="The losing trade" tag="Gold: 1 lot = 100 oz, so $1 = $100." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: <>Buy <b>1 lot</b> of gold at <b>$4,000</b></>, at: at(0) },
          { text: "Every $1 move = $100 profit or loss", at: at(0, 2.5) },
          { text: <>Gold drops $40 to $3,960 → <b style={{ color: E.red }}>−$4,000</b></>, at: at(1) },
        ]}
      />
      <Card dark>
        <Chart lo={3930} hi={4020} start={ENTRY} path={path} seed="gold1" trend={12} digits={0} levels={[{ price: ENTRY, label: "Buy 1 lot", color: E.blue, at: at(0), side: "left" }]} />
        <Panel at={at(0, 1)} rows={[{ k: "POSITION", v: "1 lot" }, { k: "PRICE", v: usd2(price) }]} big={{ k: "P&L", v: plAt(price, 1, ENTRY) }} />
      </Card>
    </>
  );
};

const Double: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const added = f >= at(0, 1.5);
  const lots = added ? LOTS : 1;
  const avg = added ? AVG : ENTRY;
  const path = [
    { f: 0, p: LOW },
    { f: at(1, 4), p: LOW },
  ];
  const price = pathPrice(path, f);
  return (
    <>
      <TopicTitle n={2} title="Buy twice the position" tag="Add 2 lots at the lower price." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: <>Add <b>2 lots</b> at $3,960 (twice the first trade)</>, at: at(0) },
          { text: <>Now <b>3 lots</b>, average price <b style={{ color: ACCENT }}>{usd2(AVG)}</b></>, at: at(1) },
        ]}
      />
      <KeyPoint at={at(1, 2)} accent={ACCENT}>
        (1 × $4,000 + 2 × $3,960) ÷ 3 = {usd2(AVG)}
      </KeyPoint>
      <Card dark>
        <Chart
          lo={3930}
          hi={4020}
          start={LOW}
          path={path}
          seed="gold2"
          trend={-30}
          digits={0}
          levels={[
            { price: ENTRY, label: "Bought 1 lot", color: E.blue, at: 0, side: "left" },
            { price: AVG, label: "Average price", color: ACCENT, at: at(1), side: "left", dash: true },
            { price: LOW, label: "Bought 2 more lots", color: E.blue, at: at(0, 1.5), side: "right" },
          ]}
        />
        <Panel
          at={0}
          rows={[
            { k: "POSITION", v: `${lots} lot${lots > 1 ? "s" : ""}`, c: added ? ACCENT : "white" },
            { k: "AVERAGE", v: usd2(avg) },
            { k: "$1 MOVE =", v: usd(100 * lots), c: added ? ACCENT : "white" },
          ]}
          big={{ k: "P&L", v: plAt(price, lots, avg) }}
        />
      </Card>
    </>
  );
};

const Recover: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const path = [
    { f: at(0, 0.3), p: LOW },
    { f: at(0, 3.5), p: AVG },
  ];
  const price = pathPrice(path, f);
  const pl = plAt(price, LOTS, AVG);
  const be = f >= at(0, 3.5);
  return (
    <>
      <TopicTitle n={3} title="The way out" tag="A smaller bounce gets you back to zero." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: <>1 lot needed <b>+$40</b> to recover</>, at: at(0) },
          { text: <>3 lots need only <b style={{ color: E.green }}>+{usd2(NEED)}</b></>, at: at(0, 1.5) },
          { text: <>Because each $1 is now worth <b>$300</b></>, at: at(1) },
        ]}
      />
      <Card dark>
        <Chart
          lo={3930}
          hi={4020}
          start={LOW}
          path={path}
          seed="gold3"
          trend={-20}
          digits={0}
          levels={[
            { price: ENTRY, label: "1 lot: break-even $4,000 (+$40)", color: "#8FA3BF", at: at(0), side: "left", dash: true },
            { price: AVG, label: `3 lots: break-even ${usd2(AVG)} (+${usd2(NEED)})`, color: E.green, at: at(0, 1), side: "left" },
          ]}
          markers={be ? [{ f: at(0, 3.5), label: "Back to $0", color: E.green }] : []}
        />
        <Panel at={at(0)} rows={[{ k: "POSITION", v: "3 lots" }, { k: "PRICE", v: usd2(price) }]} big={{ k: "P&L", v: pl }} />
      </Card>
    </>
  );
};

const Rule: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const rows = [1, 2, 3, 4, 8].map((lots) => ({ lots, move: -LOSS / (lots * OZ) }));
  return (
    <>
      <TopicTitle n={4} title="The rule" tag={`For a ${usd(-LOSS)} loss on gold.`} accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Move needed = loss ÷ (total lots × $100)", at: at(0) },
          { text: "More lots → smaller move to break even", at: at(1) },
          { text: "…but every extra lot adds risk", at: at(1, 3) },
        ]}
      />
      <Card>
        <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 26, height: "100%", boxSizing: "border-box" }}>
          <Formula at={at(0)} size={34} parts={[{ t: "Move", c: E.green }, { t: "=" }, { t: "$4,000 loss", c: E.red }, { t: "÷" }, { t: "(lots × $100)", c: ACCENT }]} />
          <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 14 }}>
            {rows.map((r, i) => {
              const t = at(1) + (i - 1) * 16;
              const w = interpolate(f, [t, t + 30], [0, (r.move / 40) * 520], clamp);
              const hl = r.lots === LOTS;
              return (
                <div key={r.lots} style={{ display: "flex", alignItems: "center", gap: 18, opacity: p(f, t, 10) }}>
                  <div style={{ width: 140, fontFamily: EF.mono, fontSize: 30, color: hl ? ACCENT : E.ink, fontWeight: hl ? 700 : 400 }}>
                    {r.lots} lot{r.lots > 1 ? "s" : ""}
                  </div>
                  <div style={{ width: w, height: 54, borderRadius: 12, background: hl ? ACCENT : `${E.green}cc` }} />
                  <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 40, color: E.ink, whiteSpace: "nowrap" }}>+{usd2(r.move)}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontFamily: EF.body, fontSize: 22, color: E.sub, opacity: p(f, at(1, 3), 12) }}>Gold move needed to get back to $0 (before spread and swaps)</div>
        </div>
      </Card>
    </>
  );
};

const Risk: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const path = [
    { f: at(0, 0.3), p: LOW },
    { f: at(0, 3.5), p: LOW - 20 },
  ];
  const price = pathPrice(path, f);
  return (
    <>
      <TopicTitle n={5} title="It works both ways" tag="Bigger size = faster gains and faster losses." accent={E.red} />
      <Points
        accent={E.red}
        items={[
          { text: <>Gold falls another $20 → 3 lots lose <b style={{ color: E.red }}>$6,000 more</b></>, at: at(0) },
          { text: <>Total: <b style={{ color: E.red }}>−$10,000</b>, and more margin in use</>, at: at(0, 2.5) },
        ]}
      />
      <KeyPoint at={at(1)} accent={E.red}>
        Decide your maximum size and a stop loss for the whole position before you start.
      </KeyPoint>
      <Card dark>
        <Chart
          lo={3920}
          hi={4010}
          start={LOW}
          path={path}
          seed="gold4"
          trend={-25}
          digits={0}
          levels={[
            { price: AVG, label: "Average", color: ACCENT, at: 0, side: "left", dash: true },
            { price: LOW - 20, label: "Another −$20", color: E.red, at: at(0), side: "left" },
          ]}
        />
        <Panel at={0} rows={[{ k: "POSITION", v: "3 lots" }, { k: "PRICE", v: usd2(price) }]} big={{ k: "P&L", v: plAt(price, LOTS, AVG) }} />
        <Pop at={at(0, 3.5)} style={{ position: "absolute", right: 170, top: 40 }}>
          <div style={{ padding: "12px 22px", borderRadius: 14, background: E.red, color: "white", fontFamily: EF.display, fontWeight: 800, fontSize: 34 }}>−$10,000</div>
        </Pop>
      </Card>
      <In at={at(1, 2)} style={{ position: "absolute", left: 930, top: 860, width: 880, textAlign: "right" }}>
        <span style={{ fontFamily: EF.body, fontSize: 20, color: E.faint }}>Educational example. Figures before spread and swaps. Trading leveraged products carries a high risk of loss.</span>
      </In>
    </>
  );
};

export const averagingGold = {
  tl,
  element: () => (
    <EduFilm
      tl={tl}
      session={3}
      name="Averaging · gold example"
      accent={ACCENT}
      topics={{ setup: 1, double: 2, recover: 3, rule: 4, risk: 5 }}
      scenes={{ title: Title, setup: Setup, double: Double, recover: Recover, rule: Rule, risk: Risk }}
    />
  ),
};

export const AveragingGold: React.FC = () => <AbsoluteFill>{averagingGold.element()}</AbsoluteFill>;
