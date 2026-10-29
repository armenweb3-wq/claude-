import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import vo from "../data/voiceover-edu3.json";
import { EduFilm, useScene } from "./EduFilm";
import { Card, Chart, E, EF, In, KeyPoint, p, pathPrice, Points, Pop, TopicTitle, usd } from "./kit";
import { CourseTitle } from "./shared";
import { makeTimeline } from "./timeline";

const ACCENT = E.violet;
const tl = makeTimeline(vo);
const LOT = 100_000;
const pl = (from: number, to: number, lots: number) => Math.round((to - from) * LOT * lots);

/** Live P&L read-out panel used over the charts. */
const PLPanel: React.FC<{ rows: { k: string; v: number; show?: number; strong?: boolean; note?: string }[]; at: number; bottom?: boolean }> = ({ rows, at, bottom }) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 30,
        ...(bottom ? { bottom: 30 } : { top: 30 }),
        width: 450,
        padding: "16px 20px",
        borderRadius: 18,
        background: "rgba(23,38,61,0.96)",
        border: "1px solid #2C4166",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: p(f, at, 14),
      }}
    >
      {rows.map((r) => (
        <div
          key={r.k}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            opacity: r.show === undefined ? 1 : p(f, r.show, 12),
            borderTop: r.strong ? "1px solid #2C4166" : undefined,
            paddingTop: r.strong ? 8 : 0,
          }}
        >
          <span style={{ fontFamily: EF.mono, fontSize: 20, letterSpacing: 2, color: "#8FA3BF", whiteSpace: "nowrap" }}>{r.k}</span>
          <span style={{ fontFamily: EF.display, fontWeight: 800, fontSize: r.strong ? 40 : 30, color: r.v >= 0 ? E.green : E.red, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {(r.v > 0 ? "+" : "") + usd(r.v)}
          </span>
        </div>
      ))}
      {rows.some((r) => r.note) && <div style={{ fontFamily: EF.body, fontSize: 20, color: "#C9D6E8" }}>{rows.find((r) => r.note)?.note}</div>}
    </div>
  );
};

const Title: React.FC = () => {
  const { at } = useScene();
  return (
    <CourseTitle
      session={3}
      title="Advanced Strategies"
      objective="Position-management techniques used by experienced traders, with their benefits and risks."
      topics={["Hedging", "Averaging"]}
      topicsAt={at(1)}
      accent={ACCENT}
    />
  );
};

const Hedge: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const tilt = 14 * (1 - p(f, at(1), 26));
  return (
    <>
      <TopicTitle n={1} title="Hedging" tag="A position that offsets the risk of another." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Open an opposite (or related) position", at: at(0, 1.5) },
          { text: "Goal: reduce exposure, not add profit", at: at(1) },
        ]}
      />
      <Card>
        <svg width={880} height={690}>
          <g transform={`rotate(${tilt} 440 420)`}>
            <rect x={120} y={410} width={640} height={20} rx={10} fill={E.ink} />
            <g opacity={p(f, at(0, 1), 14)}>
              <rect x={150} y={250} width={210} height={150} rx={22} fill={E.blue} />
              <text x={255} y={318} textAnchor="middle" fontFamily={EF.display} fontWeight={800} fontSize={40} fill="white">
                ▲ LONG
              </text>
              <text x={255} y={360} textAnchor="middle" fontFamily={EF.body} fontSize={26} fill="white">
                1 lot
              </text>
            </g>
            <g opacity={p(f, at(0, 2.5), 14)}>
              <rect x={520} y={250} width={210} height={150} rx={22} fill={E.red} />
              <text x={625} y={318} textAnchor="middle" fontFamily={EF.display} fontWeight={800} fontSize={40} fill="white">
                ▼ SHORT
              </text>
              <text x={625} y={360} textAnchor="middle" fontFamily={EF.body} fontSize={26} fill="white">
                1 lot
              </text>
            </g>
          </g>
          <path d="M440 430 L390 520 H490 Z" fill={ACCENT} />
          <g opacity={p(f, at(1), 16)}>
            <rect x={240} y={560} width={400} height={70} rx={35} fill={`${ACCENT}1A`} stroke={ACCENT} strokeWidth={3} />
            <text x={440} y={606} textAnchor="middle" fontFamily={EF.display} fontWeight={800} fontSize={34} fill={ACCENT}>
              Net exposure ≈ 0
            </text>
          </g>
        </svg>
      </Card>
    </>
  );
};

const HedgeExample: React.FC = () => {
  const { at, end } = useScene();
  const f = useCurrentFrame();
  const hedgeAt = at(3, 1);
  const path = [
    { f: at(0), p: 1.1 },
    { f: at(1, 2.5), p: 1.095 },
    { f: hedgeAt, p: 1.095 },
    { f: hedgeAt + 80, p: 1.0972 },
    { f: hedgeAt + 170, p: 1.0928 },
    { f: end(4, 1.2), p: 1.0958 },
  ];
  const price = pathPrice(path, f);
  const longPL = pl(1.1, price, 1);
  const hedged = f >= hedgeAt;
  const shortPL = hedged ? pl(price, 1.095, 1) : 0;
  return (
    <>
      <TopicTitle n={1} title="A hedging example" tag="Locking a floating loss through a news event." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Long 1 lot EUR/USD from 1.1000", at: at(0) },
          { text: <>Price falls to 1.0950 → <b style={{ color: E.red }}>−$500</b></>, at: at(1) },
          { text: "News ahead: open a 1-lot short at 1.0950", at: at(3) },
          { text: "Loss locked at ≈ −$500 until one side is closed", at: at(4) },
        ]}
      />
      <Card dark>
        <Chart
          lo={1.088}
          hi={1.104}
          start={1.1}
          path={path}
          seed="hedge"
          trend={-0.001}
          levels={[
            { price: 1.1, label: "Long entry", color: E.blue, at: at(0), side: "left" },
            { price: 1.095, label: "Short (hedge)", color: E.red, at: hedgeAt, side: "left" },
          ]}
        />
        <PLPanel
          bottom
          at={at(0, 1)}
          rows={[
            { k: "LONG 1 LOT", v: longPL },
            { k: "SHORT 1 LOT", v: shortPL, show: hedgeAt },
            { k: "NET", v: longPL + shortPL, strong: true, show: hedgeAt, note: hedged ? "Net stays the same while both are open." : undefined },
          ]}
        />
      </Card>
    </>
  );
};

const HedgeTypes: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const bar = (w: number, c: string, label: string, t: number) => (
    <div style={{ display: "flex", alignItems: "center", gap: 16, opacity: p(f, t, 12) }}>
      <div style={{ width: 150, fontFamily: EF.mono, fontSize: 22, color: E.sub }}>{label}</div>
      <div style={{ width: w * p(f, t, 20), height: 46, borderRadius: 10, background: c }} />
    </div>
  );
  return (
    <>
      <TopicTitle n={1} title="Other ways to hedge" tag="Partial hedges and related markets." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Partial: a smaller opposite position", at: at(0) },
          { text: "Related market: e.g. shares hedged with a short stock index", at: at(1) },
        ]}
      />
      <Card>
        <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 22, height: "100%", boxSizing: "border-box" }}>
          <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 36, color: E.ink, opacity: p(f, at(0), 12) }}>Partial hedge</div>
          {bar(440, E.blue, "LONG 1.0", at(0, 0.5))}
          {bar(220, E.red, "SHORT 0.5", at(0, 1.5))}
          <In at={at(0, 3)}>
            <div style={{ fontFamily: EF.body, fontSize: 28, color: E.ink }}>
              Net exposure: <b style={{ color: ACCENT }}>0.5 lot</b> · risk reduced by half
            </div>
          </In>
          <div style={{ height: 2, background: E.line, margin: "10px 0" }} />
          <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 36, color: E.ink, opacity: p(f, at(1), 12) }}>Related-market hedge</div>
          <In at={at(1, 1)}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ flex: 1, padding: "20px 22px", borderRadius: 18, background: `${E.blue}14`, border: `2px solid ${E.blue}`, fontFamily: EF.body, fontSize: 26, color: E.ink }}>
                <b>Share portfolio</b>
                <br />
                long many stocks
              </div>
              <div style={{ fontFamily: EF.display, fontSize: 40, color: E.sub }}>⇄</div>
              <div style={{ flex: 1, padding: "20px 22px", borderRadius: 18, background: `${E.red}14`, border: `2px solid ${E.red}`, fontFamily: EF.body, fontSize: 26, color: E.ink }}>
                <b>Stock index</b>
                <br />
                short, as protection
              </div>
            </div>
          </In>
        </div>
      </Card>
    </>
  );
};

const HedgePros: React.FC = () => {
  const { at } = useScene();
  const Col: React.FC<{ title: string; c: string; mark: string; items: string[]; t: number }> = ({ title, c, mark, items, t }) => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
      <In at={t}>
        <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 34, color: c }}>{title}</div>
      </In>
      {items.map((it, i) => (
        <In key={it} at={t + 18 + i * 14}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", borderRadius: 14, background: `${c}10`, border: `1px solid ${c}55` }}>
            <span style={{ color: c, fontWeight: 800, fontSize: 26 }}>{mark}</span>
            <span style={{ fontFamily: EF.body, fontSize: 25, color: E.ink, lineHeight: 1.3 }}>{it}</span>
          </div>
        </In>
      ))}
    </div>
  );
  return (
    <>
      <TopicTitle n={1} title="Hedging: benefits & limits" tag="Useful protection, with real costs." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Benefits: fast, flexible protection", at: at(0) },
          { text: "Limits: no profit while hedged, double costs", at: at(1) },
          { text: "The exit is the hardest part", at: at(2) },
        ]}
      />
      <KeyPoint at={at(3)} accent={ACCENT}>
        Some brokers and regions don't allow hedging in one account. Check your rules.
      </KeyPoint>
      <Card>
        <div style={{ padding: 36, display: "flex", gap: 22, height: "100%", boxSizing: "border-box" }}>
          <Col title="Benefits" c={E.green} mark="✓" t={at(0)} items={["Cut exposure quickly", "Protect open profits", "Hold a long-term trade through short-term risk"]} />
          <Col title="Limitations" c={E.red} mark="✕" t={at(1)} items={["No profit while fully hedged", "Spread paid on both positions", "Swaps charged on both", "Exit timing can re-open the loss"]} />
        </div>
      </Card>
    </>
  );
};

const Avg: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const steps = (dir: 1 | -1, c: string, x0: number, t: number) =>
    [0, 1, 2].map((i) => {
      const x = x0 + i * 110;
      const y = 380 - dir * i * 90;
      return (
        <g key={i} opacity={p(f, t + i * 12, 12)}>
          <circle cx={x} cy={y} r={30} fill={c} />
          <text x={x} y={y + 9} textAnchor="middle" fontFamily={EF.display} fontWeight={800} fontSize={26} fill="white">
            +1
          </text>
        </g>
      );
    });
  return (
    <>
      <TopicTitle n={2} title="Averaging" tag="Building a position in several steps." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Each addition changes your average entry price", at: at(1) },
          { text: <><b style={{ color: E.amber }}>Down</b>: add as price falls · <b style={{ color: E.green }}>Up</b>: add as it rises</>, at: at(2) },
        ]}
      />
      <Card>
        <svg width={880} height={690}>
          <g opacity={p(f, at(2), 14)}>
            <text x={210} y={120} textAnchor="middle" fontFamily={EF.display} fontWeight={800} fontSize={36} fill={E.amber}>
              Averaging down
            </text>
            <path d="M100 320 L 360 520" stroke={E.amber} strokeWidth={6} strokeDasharray="10 10" />
            {steps(-1, E.amber, 100, at(2, 0.2)).map((s, i) => (
              <g key={i} transform={`translate(0 ${-60})`}>
                {s}
              </g>
            ))}
            <text x={210} y={600} textAnchor="middle" fontFamily={EF.body} fontSize={26} fill={E.sub}>
              price falling
            </text>
          </g>
          <line x1={440} x2={440} y1={90} y2={620} stroke={E.line} strokeWidth={3} />
          <g opacity={p(f, at(2, 1), 14)}>
            <text x={660} y={120} textAnchor="middle" fontFamily={EF.display} fontWeight={800} fontSize={36} fill={E.green}>
              Averaging up
            </text>
            <path d="M540 520 L 800 320" stroke={E.green} strokeWidth={6} strokeDasharray="10 10" />
            {steps(1, E.green, 550, at(2, 1.2)).map((s, i) => (
              <g key={i} transform="translate(0 100)">
                {s}
              </g>
            ))}
            <text x={660} y={600} textAnchor="middle" fontFamily={EF.body} fontSize={26} fill={E.sub}>
              price rising
            </text>
          </g>
        </svg>
      </Card>
    </>
  );
};

const AvgDown: React.FC = () => {
  const { at, end } = useScene();
  const f = useCurrentFrame();
  const add = at(1, 3.5);
  const path = [
    { f: at(1), p: 1.1 },
    { f: add, p: 1.095 },
    { f: at(2, 0.5), p: 1.0952 },
    { f: end(2), p: 1.0975 },
    { f: end(3, 1), p: 1.092 },
  ];
  const price = pathPrice(path, f);
  const two = f >= add;
  const lots = two ? 2 : 1;
  const avg = two ? 1.0975 : 1.1;
  return (
    <>
      <TopicTitle n={2} title="Averaging down" tag="Buying more as the price falls." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Buy 1 lot at 1.1000, 1 more at 1.0950", at: at(1) },
          { text: <>Average price <b style={{ color: E.amber }}>1.0975</b>: a closer break-even</>, at: at(1, 5) },
          { text: <>But 2 lots = <b style={{ color: E.red }}>$20 per pip</b>: losses grow twice as fast</>, at: at(3) },
        ]}
      />
      <Card dark>
        <Chart
          lo={1.089}
          hi={1.103}
          start={1.1}
          path={path}
          seed="avgd"
          trend={0.0015}
          levels={[
            { price: 1.1, label: "Buy 1", color: E.blue, at: at(1), side: "left" },
            { price: 1.095, label: "Buy 1 more", color: E.blue, at: add, side: "left" },
            { price: 1.0975, label: "Average / break-even", color: E.amber, at: at(1, 5), side: "left", dash: true },
          ]}
        />
        <PLPanel
          at={at(1, 0.5)}
          rows={[
            { k: `POSITION ${lots} LOT${lots > 1 ? "S" : ""}`, v: pl(avg, price, lots), strong: true, note: `Average ${avg.toFixed(4)} · $${10 * lots} per pip` },
          ]}
        />
      </Card>
    </>
  );
};

const AvgUp: React.FC = () => {
  const { at, end } = useScene();
  const f = useCurrentFrame();
  const add = at(1, 3.5);
  const path = [
    { f: at(1), p: 1.1 },
    { f: add, p: 1.105 },
    { f: at(2, 1.5), p: 1.1085 },
    { f: end(2, 0.5), p: 1.101 },
  ];
  const price = pathPrice(path, f);
  const two = f >= add;
  const lots = two ? 2 : 1;
  const avg = two ? 1.1025 : 1.1;
  return (
    <>
      <TopicTitle n={2} title="Averaging up" tag="Adding to a position that is already in profit." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Buy 1 lot at 1.1000, add 1 at 1.1050", at: at(1) },
          { text: <>Average price <b style={{ color: E.amber }}>1.1025</b></>, at: at(1, 5) },
          { text: "Adds size only while the market proves you right", at: at(2) },
          { text: "A sharp reversal can erase the gains quickly", at: at(2, 4) },
        ]}
      />
      <Card dark>
        <Chart
          lo={1.096}
          hi={1.11}
          start={1.1}
          path={path}
          seed="avgu"
          trend={-0.001}
          levels={[
            { price: 1.105, label: "Add 1 lot", color: E.blue, at: add, side: "left" },
            { price: 1.1025, label: "Average", color: E.amber, at: at(1, 5), side: "left", dash: true },
            { price: 1.1, label: "Buy 1", color: E.blue, at: at(1), side: "left" },
          ]}
        />
        <PLPanel
          at={at(1, 0.5)}
          rows={[
            { k: `POSITION ${lots} LOT${lots > 1 ? "S" : ""}`, v: pl(avg, price, lots), strong: true },
            { k: "IF ONLY 1 LOT", v: pl(1.1, price, 1), show: at(2, 4) },
          ]}
        />
      </Card>
    </>
  );
};

const AvgRisk: React.FC = () => {
  const { at } = useScene();
  const rules = [
    { t: "Set a maximum total size in advance", c: ACCENT, at: at(1) },
    { t: "One stop loss for the whole position", c: ACCENT, at: at(1, 2.5) },
    { t: "Check free margin before every addition", c: ACCENT, at: at(2) },
    { t: "Never add to a losing trade without a limit", c: E.red, at: at(3) },
  ];
  return (
    <>
      <TopicTitle n={2} title="Averaging: managing the risk" tag="Firm rules, decided before you trade." accent={ACCENT} />
      <KeyPoint at={at(3, 2)} accent={E.red}>
        Unlimited averaging down is how small losses become margin calls.
      </KeyPoint>
      <Card>
        <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 20, height: "100%", boxSizing: "border-box", justifyContent: "center" }}>
          {rules.map((r, i) => (
            <Pop key={r.t} at={r.at}>
              <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "22px 26px", borderRadius: 20, background: `${r.c}10`, border: `2px solid ${r.c}55` }}>
                <div style={{ width: 56, height: 56, borderRadius: 28, background: r.c, color: "white", fontFamily: EF.display, fontWeight: 800, fontSize: 30, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{i + 1}</div>
                <div style={{ fontFamily: EF.body, fontSize: 31, color: E.ink, fontWeight: 600 }}>{r.t}</div>
              </div>
            </Pop>
          ))}
        </div>
      </Card>
    </>
  );
};

const Finish: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const cards = [
    { n: 1, t: "Account basics & costs", d: "Balance, equity, margin, free margin, leverage, swaps", c: E.blue, at: at(1) },
    { n: 2, t: "Orders & market types", d: "Market orders, stop loss, take profit, pending orders", c: E.teal, at: at(2) },
    { n: 3, t: "Advanced strategies", d: "Hedging and averaging, with their risks", c: E.violet, at: at(3) },
  ];
  return (
    <div style={{ position: "absolute", left: 160, right: 160, top: 150 }}>
      <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 84, color: E.ink, letterSpacing: -2, opacity: p(f, 4, 20) }}>Course complete</div>
      <div style={{ display: "flex", gap: 24, marginTop: 40 }}>
        {cards.map((c) => (
          <Pop key={c.n} at={c.at} style={{ flex: 1 }}>
            <div style={{ height: 300, borderRadius: 28, background: "white", border: `1px solid ${E.line}`, boxShadow: "0 16px 40px rgba(14,26,43,0.08)", padding: 30, boxSizing: "border-box", borderTop: `10px solid ${c.c}` }}>
              <div style={{ fontFamily: EF.mono, fontSize: 22, letterSpacing: 3, color: c.c, fontWeight: 700 }}>SESSION {c.n} ✓</div>
              <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 42, color: E.ink, marginTop: 12, lineHeight: 1.1 }}>{c.t}</div>
              <div style={{ fontFamily: EF.body, fontSize: 26, color: E.sub, marginTop: 14, lineHeight: 1.35 }}>{c.d}</div>
            </div>
          </Pop>
        ))}
      </div>
      <In at={at(4)}>
        <div style={{ marginTop: 44, fontFamily: EF.display, fontWeight: 800, fontSize: 56, color: E.ink }}>
          Trade with a plan. <span style={{ color: ACCENT }}>Always manage your risk.</span>
        </div>
        <div style={{ marginTop: 14, fontFamily: EF.body, fontSize: 24, color: E.faint }}>
          Educational content only. Trading leveraged products carries a high risk of losing money.
        </div>
      </In>
    </div>
  );
};

export const session3 = {
  tl,
  element: () => (
    <EduFilm
      tl={tl}
      session={3}
      name="Advanced strategies"
      accent={ACCENT}
      topics={{ hedge: 1, hedgeex: 1, hedgetypes: 1, hedgepros: 1, avg: 2, avgdown: 2, avgup: 2, avgrisk: 2 }}
      scenes={{ title: Title, hedge: Hedge, hedgeex: HedgeExample, hedgetypes: HedgeTypes, hedgepros: HedgePros, avg: Avg, avgdown: AvgDown, avgup: AvgUp, avgrisk: AvgRisk, finish: Finish }}
    />
  ),
};

export const Session3: React.FC = () => <AbsoluteFill>{session3.element()}</AbsoluteFill>;
