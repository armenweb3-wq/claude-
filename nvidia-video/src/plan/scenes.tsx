import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import vo from "../data/voiceover-plan.json";
import { Chart, pathPrice } from "../edu/kit";
import { makeTimeline } from "../edu/timeline";
import { Backdrop, Body, clamp, Column, Counter, Headline, Kicker, prog } from "./primitives";
import { colors, fonts, SAFE } from "./theme";

/*
 * "A realistic daily plan": every figure on screen is derived from these inputs.
 * Risk is fixed at 1% of the STARTING balance ($1,000) so the projection is linear.
 */
export const tl = makeTimeline(vo);
export const BALANCE = 100_000;
export const RISK_PCT = 1;
export const RISK = (BALANCE * RISK_PCT) / 100; // 1,000
export const TRADES_PER_DAY = 3;
export const DAYS_PER_WEEK = 3;
export const RR = 3; // reward : risk
export const DAYS_PER_MONTH = Math.round((DAYS_PER_WEEK * 52) / 12); // 13
export const MONTHS = 6;
export const WITHDRAW_PCT = 3;

/** The example day, in order. */
export const DAY = [
  { label: "Target hit", sub: `${RR}% target`, r: RR },
  { label: "Break-even", sub: "stop moved to entry", r: 0 },
  { label: "Stop loss", sub: `${RISK_PCT}% risk`, r: -1 },
];
export const DAY_PL = DAY.reduce((a, t) => a + t.r * RISK, 0); // 2,000
export const MONTH_PL = DAY_PL * DAYS_PER_MONTH; // 26,000
export const FINAL = BALANCE + MONTH_PL * MONTHS; // 256,000
export const WORST_DAY = -TRADES_PER_DAY * RISK; // −3,000
export const BREAKEVEN_WINRATE = 1 / (1 + RR); // 25%

/** Month by month: add the month's profit, then withdraw 3% of the balance. Runs until the initial balance is recovered. */
export const withdrawals = (() => {
  const rows: { m: number; balance: number; out: number; cum: number }[] = [];
  let bal = BALANCE;
  let cum = 0;
  for (let m = 1; m <= 60; m++) {
    bal += MONTH_PL;
    const out = (bal * WITHDRAW_PCT) / 100;
    bal -= out;
    cum += out;
    rows.push({ m, balance: bal, out, cum });
    if (cum >= BALANCE && m >= MONTHS) break;
  }
  return rows;
})();
export const RECOVER_MONTH = withdrawals.find((r) => r.cum >= BALANCE)!.m;

const usd = (n: number, d = 0) => (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (n: number) => (n > 0 ? "+" : "") + usd(n);
const at = (scene: string, n: number, off = 0) => tl.at(scene, n, off);
const atEnd = (scene: string, n: number, off = 0) => tl.atEnd(scene, n, off);

const Stat: React.FC<{ label: string; value: React.ReactNode; color?: string; delay: number; size?: number; sub?: string }> = ({ label, value, color = colors.text, delay, size = 72, sub }) => {
  const f = useCurrentFrame();
  const p = prog(f, delay, 22);
  return (
    <div style={{ flex: 1, padding: "22px 26px", borderRadius: 26, background: `linear-gradient(160deg, ${colors.charcoal2}, ${colors.charcoal})`, border: `1px solid ${colors.line}`, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
      <div style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 3, color: colors.muted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: size, color, letterSpacing: -1.5, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontFamily: fonts.body, fontSize: 22, color: colors.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
};

// 1 ─ Title
export const STitle: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={260} gap={26}>
        <Kicker delay={4}>Trading plan · realistic</Kicker>
        <Headline text="A realistic daily plan." accent={["realistic"]} delay={8} size={104} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 720, display: "flex", flexDirection: "column", gap: 22 }}>
        <Stat label="Account balance" value={<Counter to={BALANCE} start={at("title", 1)} dur={30} format={(n) => usd(n)} />} delay={at("title", 1)} size={92} />
        <div style={{ display: "flex", gap: 22 }}>
          <Stat label="Trades a day" value={String(TRADES_PER_DAY)} color={colors.greenBright} delay={at("title", 1, 1.8)} />
          <Stat label="Days a week" value={String(DAYS_PER_WEEK)} color={colors.teal} delay={at("title", 1, 2.8)} sub="Mon – Fri, pick 3" />
          <Stat label="Risk a trade" value={`${RISK_PCT}%`} color={colors.gold} delay={at("title", 1, 3.8)} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1300, textAlign: "center", opacity: prog(f, at("title", 1, 4.4), 20) }}>
        <Body size={32}>
          {RISK_PCT}% of {usd(BALANCE)} = <span style={{ color: colors.text, fontWeight: 600 }}>{usd(RISK)} risk per trade</span>
        </Body>
      </div>
    </AbsoluteFill>
  );
};

// 2 ─ Rules: the ladder (stop → target), then the stop slides to entry
export const SRules: React.FC = () => {
  const f = useCurrentFrame();
  const stop = at("rules", 0);
  const target = at("rules", 1);
  const be = at("rules", 2, 1.4);
  const beP = prog(f, be, 30);
  const yEntry = 900;
  const yStop = 1100;
  const yTP = 520;
  const stopY = interpolate(beP, [0, 1], [yStop, yEntry]);
  const Line: React.FC<{ y: number; color: string; label: string; value: string; p: number; dash?: boolean }> = ({ y, color, label, value, p, dash }) => (
    <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: y, opacity: p }}>
      <div style={{ height: 4, width: `${p * 100}%`, borderRadius: 2, boxShadow: `0 0 18px ${color}88`, ...(dash ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 18px, transparent 18px 30px)` } : { background: color }) }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 24, letterSpacing: 3, color, textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 44, color: colors.text }}>{value}</span>
      </div>
    </div>
  );
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>The rules</Kicker>
        <Headline text="Risk 1. Aim for 3." accent={["3."]} delay={8} size={100} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: yTP, height: yEntry - yTP, background: `linear-gradient(180deg, ${colors.green}2A, transparent)`, opacity: prog(f, target, 20), borderRadius: 12 }} />
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: yEntry, height: Math.max(0, stopY - yEntry), background: `linear-gradient(0deg, ${colors.red}2A, transparent)`, opacity: prog(f, stop, 20), borderRadius: 12 }} />
      <Line y={yTP} color={colors.greenBright} label={`Take profit · ${RR}%`} value={signed(RISK * RR)} p={prog(f, target, 26)} />
      <Line y={yEntry} color={beP > 0.5 ? colors.gold : colors.muted} label={beP > 0.5 ? "Entry = stop loss (break-even)" : "Entry"} value={beP > 0.5 ? "$0 risk" : `risk : reward 1 : ${RR}`} p={prog(f, stop - 10, 20)} dash={beP <= 0.5} />
      <div style={{ opacity: 1 - prog(f, be, 12) }}>
        <Line y={stopY} color={colors.red} label={`Stop loss · ${RISK_PCT}%`} value={usd(-RISK)} p={prog(f, stop, 26)} />
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1230, display: "flex", justifyContent: "center", opacity: prog(f, be, 20) }}>
        <div style={{ padding: "14px 30px", borderRadius: 100, background: `${colors.gold}22`, border: `1px solid ${colors.gold}88`, fontFamily: fonts.body, fontSize: 30, color: colors.text }}>
          In profit → stop moves to entry. The trade can no longer lose.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 3 ─ The chart: one trade, stop to break-even, both outcomes
export const SChart: React.FC = () => {
  const f = useCurrentFrame();
  const ENTRY = 1.1;
  const SL = 1.095;
  const TP = ENTRY + (ENTRY - SL) * RR; // 1.1150
  const t0 = at("chart", 0, 0.5);
  const moveAt = at("chart", 1, 2.4);
  const turn = at("chart", 2, 1.2);
  const go = at("chart", 3, 0.2);
  const hit = atEnd("chart", 3, -0.4);
  const path = [
    { f: t0, p: ENTRY },
    { f: at("chart", 1, 0.3), p: 1.0985 },
    { f: moveAt, p: 1.1065 },
    { f: turn, p: 1.106 },
    { f: go, p: 1.1085 },
    { f: hit, p: TP },
  ];
  const price = pathPrice(path, f);
  const inProfit = f >= moveAt;
  const LOTS = RISK / ((ENTRY - SL) * 100_000); // size so the 50-pip stop risks exactly $1,000 → 2 lots
  const pl = Math.round((price - ENTRY) * 100_000 * LOTS);
  const phase = f >= hit ? "Target hit" : f >= moveAt ? "Protected: stop at break-even" : f >= t0 ? "Open · risking $1,000" : "";
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={20}>
        <Kicker delay={4}>One trade, step by step</Kicker>
        <Headline text="Move the stop to break-even." accent={["break-even."]} delay={8} size={84} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, top: 520, width: 936, height: 720, borderRadius: 30, background: colors.charcoal, border: `1px solid ${colors.line}`, overflow: "hidden", opacity: prog(f, 10, 20) }}>
        <Chart
          lo={1.09}
          hi={1.12}
          start={ENTRY}
          path={path}
          seed="plan"
          trend={0.004}
          w={936}
          h={720}
          levels={[
            { price: TP, label: `Target · +$${(RISK * RR).toLocaleString()}`, color: colors.greenBright, at: t0 + 24, side: "left" },
            { price: ENTRY, label: "Entry", color: "#8FA3BF", at: t0, side: "left", dash: true, until: moveAt + 10 },
            { price: SL, label: "Stop loss · −$1,000", color: colors.red, at: t0 + 12, side: "left", moveTo: ENTRY, moveAt, moveDur: 36, moveLabel: "Stop loss → break-even · $0", moveColor: colors.gold },
          ]}
          zones={[{ from: SL, to: ENTRY, color: colors.red, at: t0 + 12, label: "", side: "center" }]}
          ghost={{ path: [{ f: turn, p: 1.106 }, { f: turn + 70, p: ENTRY }], at: turn, label: "turns back → closes at $0", color: colors.gold }}
          markers={[{ f: hit, label: "Target hit · +$3,000", color: colors.greenBright }]}
        />
        <div style={{ position: "absolute", left: 24, bottom: 18, padding: "12px 18px", borderRadius: 14, background: "rgba(5,14,28,0.92)", border: `1px solid ${colors.line}`, opacity: prog(f, t0, 10) }}>
          <div style={{ fontFamily: fonts.mono, fontSize: 18, letterSpacing: 2, color: inProfit ? colors.gold : colors.muted }}>{phase.toUpperCase()}</div>
          <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 40, color: pl >= 0 ? colors.greenBright : colors.red, fontVariantNumeric: "tabular-nums" }}>{(pl >= 0 ? "+" : "") + usd(pl)}</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1262, display: "flex", gap: 16 }}>
        {[
          { t: "Turns back", v: "$0", c: colors.gold, at: turn },
          { t: "Keeps going", v: signed(RISK * RR), c: colors.greenBright, at: go },
        ].map((o) => (
          <div key={o.t} style={{ flex: 1, padding: "14px 22px", borderRadius: 18, background: `${o.c}14`, border: `1px solid ${o.c}66`, display: "flex", justifyContent: "space-between", alignItems: "baseline", opacity: prog(f, o.at, 14) }}>
            <span style={{ fontFamily: fonts.body, fontSize: 26, color: colors.text }}>{o.t}</span>
            <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 40, color: o.c }}>{o.v}</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// 4 ─ The example day
export const SDay: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const starts = [at("day", 0, 1.8), at("day", 1, 0.8), at("day", 2, 0.8)];
  const totalAt = at("day", 3, 0.2);
  const shown = starts.filter((s) => f >= s + 10).length;
  const running = DAY.slice(0, shown).reduce((a, t) => a + t.r * RISK, 0);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>A realistic day · {TRADES_PER_DAY} trades</Kicker>
        <Headline text="One win, one scratch, one loss." delay={8} size={84} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 560, display: "flex", flexDirection: "column", gap: 18 }}>
        {DAY.map((t, i) => {
          const s = spring({ frame: f - starts[i], fps, config: { damping: 18, mass: 0.8 } });
          const c = t.r > 0 ? colors.greenBright : t.r < 0 ? colors.red : colors.gold;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 22, padding: "24px 28px", borderRadius: 24, background: `linear-gradient(160deg, ${colors.charcoal2}, ${colors.charcoal})`, border: `1px solid ${c}66`, opacity: Math.min(1, s * 1.4), transform: `translateX(${(1 - s) * -60}px)` }}>
              <div style={{ width: 60, height: 60, borderRadius: 30, background: c, color: colors.ink, fontFamily: fonts.display, fontWeight: 800, fontSize: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 38, color: colors.text }}>{t.label}</div>
                <div style={{ fontFamily: fonts.body, fontSize: 24, color: colors.muted }}>{t.sub}</div>
              </div>
              <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 52, color: c, fontVariantNumeric: "tabular-nums" }}>{signed(t.r * RISK)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1060, padding: "26px 32px", borderRadius: 28, background: colors.green, color: colors.ink, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: prog(f, totalAt, 16), transform: `scale(${0.96 + 0.04 * prog(f, totalAt, 16)})` }}>
        <div>
          <div style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 3 }}>DAY RESULT</div>
          <div style={{ fontFamily: fonts.body, fontSize: 24 }}>risked {usd(RISK * TRADES_PER_DAY)} in total</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 80, letterSpacing: -2, lineHeight: 1 }}>
            <Counter to={DAY_PL} start={totalAt} dur={34} format={(n) => signed(Math.round(n))} />
          </div>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 30 }}>+{((DAY_PL / BALANCE) * 100).toFixed(0)}% of the balance</div>
        </div>
      </div>
      <div style={{ position: "absolute", right: SAFE.x, top: 500, fontFamily: fonts.mono, fontSize: 24, color: colors.muted, opacity: prog(f, starts[0], 10) }}>
        running total <span style={{ color: running >= 0 ? colors.greenBright : colors.red, fontWeight: 700 }}>{signed(running)}</span>
      </div>
    </AbsoluteFill>
  );
};

// 5 ─ The edge: break-even win rate and the worst day
export const SEdge: React.FC = () => {
  const f = useCurrentFrame();
  const be = at("edge", 0, 0.4);
  const bad = at("edge", 1);
  const Pie: React.FC<{ p: number }> = ({ p }) => {
    const r = 120;
    const c = 2 * Math.PI * r;
    return (
      <svg width={300} height={300} viewBox="0 0 300 300">
        <circle cx={150} cy={150} r={r} fill="none" stroke={colors.charcoal2} strokeWidth={44} />
        <circle cx={150} cy={150} r={r} fill="none" stroke={colors.greenBright} strokeWidth={44} strokeDasharray={`${c * BREAKEVEN_WINRATE * p} ${c}`} transform="rotate(-90 150 150)" />
        <text x={150} y={142} textAnchor="middle" fontFamily={fonts.display} fontWeight={800} fontSize={56} fill={colors.text}>
          {Math.round(BREAKEVEN_WINRATE * 100 * p)}%
        </text>
        <text x={150} y={182} textAnchor="middle" fontFamily={fonts.mono} fontSize={20} fill={colors.muted}>
          WIN RATE
        </text>
      </svg>
    );
  };
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>Why it works</Kicker>
        <Headline text="The edge is the risk-to-reward." accent={["risk-to-reward."]} delay={8} size={88} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 560, display: "flex", alignItems: "center", gap: 30, opacity: prog(f, be, 14) }}>
        <Pie p={prog(f, be, 40)} />
        <div>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 40, color: colors.text, lineHeight: 1.15 }}>Break-even at 1 : {RR}</div>
          <div style={{ fontFamily: fonts.body, fontSize: 28, color: colors.muted, marginTop: 10, lineHeight: 1.4 }}>
            1 win pays for {RR} losses. Win just <span style={{ color: colors.greenBright, fontWeight: 600 }}>1 trade in 4</span> and you're flat.
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 930, padding: "26px 30px", borderRadius: 26, background: `${colors.red}14`, border: `1px solid ${colors.red}66`, opacity: prog(f, bad, 18) }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 3, color: colors.red }}>THE WORST DAY · 3 LOSSES</div>
        <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>
          {[-1, -1, -1].map((r, i) => (
            <div key={i} style={{ flex: 1, height: 60, borderRadius: 12, background: colors.red, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fonts.display, fontWeight: 800, fontSize: 30, color: colors.ink, opacity: prog(f, bad + 12 + i * 8, 10) }}>
              {signed(r * RISK)}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontFamily: fonts.body, fontSize: 28, color: colors.muted }}>Day result</span>
          <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 56, color: colors.red }}>
            {signed(WORST_DAY)} <span style={{ fontSize: 32, color: colors.muted }}>({((WORST_DAY / BALANCE) * 100).toFixed(0)}%)</span>
          </span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1300, textAlign: "center", opacity: prog(f, bad + 40, 16) }}>
        <Body size={28}>One target hit (+$3,000) pays for an entire worst day.</Body>
      </div>
    </AbsoluteFill>
  );
};

// 6 ─ Growth: month bars to 6 months
export const SGrowth: React.FC = () => {
  const f = useCurrentFrame();
  const m = at("growth", 1);
  const six = at("growth", 2);
  const barMax = 520;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>If the average day matched the example</Kicker>
        <Headline text="Over six months." accent={["six", "months."]} delay={8} size={92} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 480, display: "flex", gap: 16 }}>
        <Stat label="Per day" value={signed(DAY_PL)} color={colors.greenBright} delay={at("growth", 0, 0.5)} size={50} />
        <Stat label={`${DAYS_PER_MONTH} days / month`} value={<Counter to={MONTH_PL} start={m} dur={30} format={(n) => signed(Math.round(n))} />} color={colors.greenBright} delay={m} size={50} sub={`${DAYS_PER_WEEK} days × 52 weeks ÷ 12`} />
      </div>
      <svg width={1080} height={700} style={{ position: "absolute", top: 660 }}>
        {Array.from({ length: MONTHS + 1 }).map((_, i) => {
          const bal = BALANCE + MONTH_PL * i;
          const h = (bal / FINAL) * barMax * prog(f, six - 20 + i * 6, 24);
          const x = SAFE.x + i * 136;
          const last = i === MONTHS;
          return (
            <g key={i}>
              <rect x={x} y={600 - h} width={112} height={h} rx={10} fill={last ? colors.greenBright : i === 0 ? colors.dim : colors.green} opacity={last || i === 0 ? 1 : 0.75} />
              <text x={x + 56} y={640} textAnchor="middle" fontFamily={fonts.mono} fontSize={22} fill={colors.muted}>
                {i === 0 ? "start" : `M${i}`}
              </text>
              {(i === 0 || last) && (
                <text x={x + 56} y={600 - h - 18} textAnchor="middle" fontFamily={fonts.display} fontWeight={800} fontSize={last ? 36 : 26} fill={last ? colors.greenBright : colors.text}>
                  {usd(bal)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1345, textAlign: "center", fontFamily: fonts.body, fontSize: 24, color: colors.dim, opacity: prog(f, six, 20) }}>
        Risk fixed at {usd(RISK)} per trade · before spreads, commissions and swaps · a projection, not a result
      </div>
    </AbsoluteFill>
  );
};

// 7 ─ Withdrawals: cumulative withdrawals climb past the initial $100k
export const SWithdraw: React.FC = () => {
  const f = useCurrentFrame();
  const start = at("withdraw", 0, 1.4);
  const hit = at("withdraw", 1, 2.4);
  const W = 936;
  const H = 560;
  const padL = 20;
  const padB = 50;
  const n = withdrawals.length;
  const maxV = Math.max(withdrawals[n - 1].balance, withdrawals[n - 1].cum) * 1.08;
  const x = (m: number) => padL + ((m - 0.5) / n) * (W - padL);
  const y = (v: number) => H - padB - (v / maxV) * (H - padB - 40);
  const shownMonths = interpolate(f, [start, start + 90], [0, n], clamp);
  const cumPts = withdrawals.filter((r) => r.m <= shownMonths).map((r) => `${x(r.m)},${y(r.cum)}`);
  const balPts = withdrawals.filter((r) => r.m <= shownMonths).map((r) => `${x(r.m)},${y(r.balance)}`);
  const rec = withdrawals[RECOVER_MONTH - 1];
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>Withdraw {WITHDRAW_PCT}% of the balance each month</Kicker>
        <Headline text="When is your $100,000 back in your pocket?" accent={["$100,000"]} delay={8} size={78} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, top: 560, width: W, height: H, borderRadius: 30, background: colors.charcoal, border: `1px solid ${colors.line}`, opacity: prog(f, start - 10, 16) }}>
        <svg width={W} height={H}>
          <line x1={padL} x2={W} y1={y(BALANCE)} y2={y(BALANCE)} stroke={colors.gold} strokeWidth={2} strokeDasharray="10 8" />
          <text x={padL + 10} y={y(BALANCE) - 10} textAnchor="start" fontFamily={fonts.mono} fontSize={20} fill={colors.gold}>
            INITIAL $100,000
          </text>
          <polyline points={balPts.join(" ")} fill="none" stroke={colors.teal} strokeWidth={4} strokeLinejoin="round" />
          <polyline points={cumPts.join(" ")} fill="none" stroke={colors.greenBright} strokeWidth={6} strokeLinejoin="round" />
          {withdrawals.filter((r) => r.m <= shownMonths).map((r) => (
            <g key={r.m}>
              <circle cx={x(r.m)} cy={y(r.cum)} r={6} fill={colors.greenBright} />
              <text x={x(r.m)} y={H - 18} textAnchor="middle" fontFamily={fonts.mono} fontSize={18} fill={r.m === RECOVER_MONTH ? colors.greenBright : colors.dim}>
                {r.m}
              </text>
            </g>
          ))}
          {f >= hit && (
            <g>
              <circle cx={x(rec.m)} cy={y(rec.cum)} r={16} fill={colors.greenBright} stroke={colors.ink} strokeWidth={4} />
              <rect x={x(rec.m) - 300} y={y(rec.cum) - 76} width={280} height={48} rx={12} fill={colors.greenBright} />
              <text x={x(rec.m) - 160} y={y(rec.cum) - 44} textAnchor="middle" fontFamily={fonts.display} fontWeight={800} fontSize={24} fill={colors.ink}>
                Month {rec.m} · {usd(rec.cum)} out
              </text>
            </g>
          )}
        </svg>
        <div style={{ position: "absolute", left: 24, top: 18, display: "flex", gap: 20, fontFamily: fonts.mono, fontSize: 19, letterSpacing: 2 }}>
          <span style={{ color: colors.greenBright }}>● TAKEN OUT SO FAR</span>
          <span style={{ color: colors.teal }}>● ACCOUNT BALANCE</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1160, display: "flex", gap: 16 }}>
        <Stat label="Month 1 withdrawal" value={usd(withdrawals[0].out)} color={colors.greenBright} delay={start} size={46} />
        <Stat label={`Month ${RECOVER_MONTH} withdrawal`} value={usd(rec.out)} color={colors.greenBright} delay={hit} size={46} sub={`balance still ${usd(rec.balance)}`} />
      </div>
    </AbsoluteFill>
  );
};

// 8 ─ Close + risk disclaimer
export const SClose: React.FC = () => {
  const f = useCurrentFrame();
  const a = prog(f, at("close", 0), 24);
  const b = prog(f, at("close", 1), 24);
  return (
    <AbsoluteFill>
      <Backdrop glow={0.7} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 300, opacity: a }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 26, letterSpacing: 8, color: colors.green }}>THE PLAN</div>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 92, color: colors.text, textAlign: "center", lineHeight: 1.05, letterSpacing: -2, marginTop: 20, padding: `0 ${SAFE.x}px` }}>
          Risk 1%.
          <br />
          Aim for 3%.
          <br />
          <span style={{ color: colors.greenBright }}>Protect at break-even.</span>
        </div>
        <div style={{ width: 140 * a, height: 4, background: colors.green, margin: "40px 0" }} />
        <div style={{ fontFamily: fonts.body, fontSize: 28, color: colors.muted, textAlign: "center", padding: `0 ${SAFE.x + 20}px` }}>
          Projections above come from one example day repeated. Real results vary with every trade.
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: SAFE.x + 10, right: SAFE.x + 10, top: 1100, padding: "24px 28px", borderRadius: 22, background: "rgba(0,0,0,0.45)", border: `1px solid ${colors.line}`, opacity: b }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 20, letterSpacing: 3, color: colors.muted, marginBottom: 10 }}>RISK DISCLAIMER</div>
        <div style={{ fontFamily: fonts.body, fontSize: 21, lineHeight: 1.45, color: colors.muted }}>
          Trading CFDs and FX Contracts is highly speculative and involves significant risk of your capital. You should not risk more than you can afford. Before taking any market action, you need to be properly aware of the risk. Past performance is not a guarantee of future performance. The information above is intended to be general and is not to be considered investment advice. This information should not be understood as an offer. Should you proceed using the information above for opening market positions, it is considered you did so at your own risk.
        </div>
      </div>
    </AbsoluteFill>
  );
};
