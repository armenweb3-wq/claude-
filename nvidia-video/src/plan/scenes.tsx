import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import vo from "../data/voiceover-plan.json";
import { makeTimeline } from "../edu/timeline";
import { Backdrop, Body, clamp, Column, Counter, Headline, Kicker, prog } from "../v1/components/primitives";
import { colors, fonts, SAFE } from "../v1/theme";

/*
 * "A disciplined daily plan": every figure on screen is derived from these inputs.
 * Risk is kept fixed at 1% of the STARTING balance ($1,000) so the projection is linear,
 * which is the more conservative reading of "1% allocation".
 */
export const tl = makeTimeline(vo);
export const BALANCE = 100_000;
export const RISK_PCT = 1;
export const RISK = (BALANCE * RISK_PCT) / 100; // 1,000
export const TRADES_PER_DAY = 5;
export const RR = [3, 5]; // reward-to-risk range
export const DAYS_PER_MONTH = 21;
export const MONTHS = 6;
export const WITHDRAW_PCT = 3;

/** The client's example day, in order. */
export const DAY = [
  { label: "Take profit", sub: "3% target", r: 3 },
  { label: "Take profit", sub: "3% target", r: 3 },
  { label: "Break-even", sub: "stop moved to entry", r: 0 },
  { label: "Stop loss", sub: "1% risk", r: -1 },
  { label: "Take profit", sub: "5% target", r: 5 },
];
export const DAY_PL = DAY.reduce((a, t) => a + t.r * RISK, 0); // 10,000
export const MONTH_PL = DAY_PL * DAYS_PER_MONTH; // 210,000
export const FINAL = BALANCE + MONTH_PL * MONTHS; // 1,360,000
export const BAD_DAY = (RR[0] - (TRADES_PER_DAY - 1)) * RISK; // 1 win at 3R, 4 losses → −1,000
export const BREAKEVEN_WINRATE = 1 / (1 + RR[0]); // 25%

/** Month-by-month: add the month's profit, then withdraw 3% of the balance. */
export const withdrawals = (() => {
  const rows: { m: number; balance: number; out: number; cum: number }[] = [];
  let bal = BALANCE;
  let cum = 0;
  for (let m = 1; m <= MONTHS; m++) {
    bal += MONTH_PL;
    const out = (bal * WITHDRAW_PCT) / 100;
    bal -= out;
    cum += out;
    rows.push({ m, balance: bal, out, cum });
  }
  return rows;
})();
export const RECOVER_MONTH = withdrawals.find((r) => r.cum >= BALANCE)!.m;

const usd = (n: number, d = 0) => (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (n: number) => (n > 0 ? "+" : "") + usd(n);
const at = (scene: string, n: number, off = 0) => tl.at(scene, n, off);

const Stat: React.FC<{ label: string; value: React.ReactNode; color?: string; delay: number; size?: number }> = ({ label, value, color = colors.text, delay, size = 72 }) => {
  const f = useCurrentFrame();
  const p = prog(f, delay, 22);
  return (
    <div style={{ flex: 1, padding: "22px 26px", borderRadius: 26, background: `linear-gradient(160deg, ${colors.charcoal2}, ${colors.charcoal})`, border: `1px solid ${colors.line}`, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
      <div style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 3, color: colors.muted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: size, color, letterSpacing: -1.5, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
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
        <Kicker delay={4}>Trading plan · daily</Kicker>
        <Headline text="A disciplined daily plan." accent={["disciplined"]} delay={8} size={104} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 760, display: "flex", flexDirection: "column", gap: 22 }}>
        <Stat label="Account balance" value={<Counter to={BALANCE} start={at("title", 1)} dur={30} format={(n) => usd(n)} />} delay={at("title", 1)} size={92} />
        <div style={{ display: "flex", gap: 22 }}>
          <Stat label="Trades per day" value={String(TRADES_PER_DAY)} color={colors.greenBright} delay={at("title", 1, 1.6)} />
          <Stat label="Risk per trade" value={`${RISK_PCT}%`} color={colors.greenBright} delay={at("title", 1, 2.6)} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1300, textAlign: "center", opacity: prog(f, at("title", 1, 3.2), 20) }}>
        <Body size={32}>
          {RISK_PCT}% of {usd(BALANCE)} = <span style={{ color: colors.text, fontWeight: 600 }}>{usd(RISK)} risk per trade</span>
        </Body>
      </div>
    </AbsoluteFill>
  );
};

// 2 ─ Rules: entry, stop, target, break-even on a price ladder
export const SRules: React.FC = () => {
  const f = useCurrentFrame();
  const stop = at("rules", 0);
  const target = at("rules", 1);
  const be = at("rules", 2, 1.2);
  const beP = prog(f, be, 30);
  const yEntry = 900;
  const yStop = 1120;
  const yTP = 560;
  const stopY = interpolate(beP, [0, 1], [yStop, yEntry]);
  const Line: React.FC<{ y: number; color: string; label: string; value: string; p: number; dash?: boolean }> = ({ y, color, label, value, p, dash }) => (
    <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: y, opacity: p }}>
      <div style={{ height: 4, width: `${p * 100}%`, background: color, borderRadius: 2, boxShadow: `0 0 18px ${color}88`, ...(dash ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 18px, transparent 18px 30px)`, background: "none" } : {}) }} />
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
        <Headline text="Small risk, bigger reward." accent={["bigger", "reward."]} delay={8} size={92} />
      </Column>
      {/* reward zone */}
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: yTP, height: yEntry - yTP, background: `linear-gradient(180deg, ${colors.green}2A, transparent)`, opacity: prog(f, target, 20), borderRadius: 12 }} />
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: yEntry, height: stopY - yEntry, background: `linear-gradient(0deg, ${colors.red}2A, transparent)`, opacity: prog(f, stop, 20), borderRadius: 12 }} />
      <Line y={yTP} color={colors.greenBright} label="Take profit · 3–5%" value={`${usd(RISK * RR[0])} – ${usd(RISK * RR[1])}`} p={prog(f, target, 26)} />
      <Line y={yEntry} color={beP > 0.5 ? colors.gold : colors.muted} label={beP > 0.5 ? "Entry = stop loss (break-even)" : "Entry"} value={beP > 0.5 ? "$0 risk" : "risk : reward 1 : 3–5"} p={prog(f, stop - 10, 20)} dash={beP <= 0.5} />
      <div style={{ opacity: 1 - prog(f, be, 12) }}>
        <Line y={stopY} color={colors.red} label="Stop loss · 1%" value={usd(-RISK)} p={prog(f, stop, 26)} />
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1230, display: "flex", justifyContent: "center", opacity: prog(f, be, 20) }}>
        <div style={{ padding: "14px 30px", borderRadius: 100, background: `${colors.gold}22`, border: `1px solid ${colors.gold}88`, fontFamily: fonts.body, fontSize: 30, color: colors.text }}>
          In profit → stop moves to entry. The trade can no longer lose.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 3 ─ The example day: five trade cards, running total
export const SDay: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const starts = [at("day", 0, 1.6), at("day", 0, 2.6), at("day", 1, 1.6), at("day", 2, 0.8), at("day", 3, 1.0)];
  const totalAt = at("day", 4, 0.2);
  const shown = starts.filter((s) => f >= s + 10).length;
  const running = DAY.slice(0, shown).reduce((a, t) => a + t.r * RISK, 0);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>An example day · 5 trades</Kicker>
        <Headline text="Three wins, one scratch, one loss." delay={8} size={84} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 540, display: "flex", flexDirection: "column", gap: 14 }}>
        {DAY.map((t, i) => {
          const s = spring({ frame: f - starts[i], fps, config: { damping: 18, mass: 0.8 } });
          const c = t.r > 0 ? colors.greenBright : t.r < 0 ? colors.red : colors.gold;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px 24px", borderRadius: 20, background: `linear-gradient(160deg, ${colors.charcoal2}, ${colors.charcoal})`, border: `1px solid ${c}66`, opacity: Math.min(1, s * 1.4), transform: `translateX(${(1 - s) * -60}px)` }}>
              <div style={{ width: 54, height: 54, borderRadius: 27, background: c, color: colors.ink, fontFamily: fonts.display, fontWeight: 800, fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 34, color: colors.text }}>{t.label}</div>
                <div style={{ fontFamily: fonts.body, fontSize: 22, color: colors.muted }}>{t.sub}</div>
              </div>
              <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 44, color: c, fontVariantNumeric: "tabular-nums" }}>{signed(t.r * RISK)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1130, padding: "22px 30px", borderRadius: 26, background: colors.green, color: colors.ink, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: prog(f, totalAt, 16), transform: `scale(${0.96 + 0.04 * prog(f, totalAt, 16)})` }}>
        <div>
          <div style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 3 }}>DAY RESULT</div>
          <div style={{ fontFamily: fonts.body, fontSize: 24 }}>risked {usd(RISK * TRADES_PER_DAY)} in total</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 72, letterSpacing: -2, lineHeight: 1 }}>
            <Counter to={DAY_PL} start={totalAt} dur={34} format={(n) => signed(Math.round(n))} />
          </div>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 30 }}>+{((DAY_PL / BALANCE) * 100).toFixed(0)}% of the balance</div>
        </div>
      </div>
      <div style={{ position: "absolute", right: SAFE.x, top: 486, fontFamily: fonts.mono, fontSize: 24, color: colors.muted, opacity: prog(f, starts[0], 10) }}>
        running total <span style={{ color: running >= 0 ? colors.greenBright : colors.red, fontWeight: 700 }}>{signed(running)}</span>
      </div>
    </AbsoluteFill>
  );
};

// 4 ─ The edge: break-even win rate and a bad day
export const SEdge: React.FC = () => {
  const f = useCurrentFrame();
  const be = at("edge", 1);
  const bad = at("edge", 2);
  const Pie: React.FC<{ p: number }> = ({ p }) => {
    const r = 120;
    const c = 2 * Math.PI * r;
    return (
      <svg width={300} height={300} viewBox="0 0 300 300">
        <circle cx={150} cy={150} r={r} fill="none" stroke={colors.charcoal2} strokeWidth={44} />
        <circle cx={150} cy={150} r={r} fill="none" stroke={colors.greenBright} strokeWidth={44} strokeDasharray={`${c * BREAKEVEN_WINRATE * p} ${c}`} transform="rotate(-90 150 150)" strokeLinecap="butt" />
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
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 40, color: colors.text, lineHeight: 1.15 }}>Break-even at 1 : {RR[0]}</div>
          <div style={{ fontFamily: fonts.body, fontSize: 28, color: colors.muted, marginTop: 10, lineHeight: 1.4 }}>
            1 win pays for {RR[0]} losses. Win just <span style={{ color: colors.greenBright, fontWeight: 600 }}>1 trade in 4</span> and you're flat.
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 930, padding: "26px 30px", borderRadius: 26, background: `${colors.red}14`, border: `1px solid ${colors.red}66`, opacity: prog(f, bad, 18) }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 3, color: colors.red }}>A BAD DAY · 1 WIN, 4 LOSSES</div>
        <div style={{ display: "flex", gap: 10, margin: "16px 0" }}>
          {[3, -1, -1, -1, -1].map((r, i) => (
            <div key={i} style={{ flex: r > 0 ? 3 : 1, height: 54, borderRadius: 12, background: r > 0 ? colors.greenBright : colors.red, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fonts.display, fontWeight: 800, fontSize: 26, color: colors.ink, opacity: prog(f, bad + 10 + i * 6, 10) }}>
              {signed(r * RISK)}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontFamily: fonts.body, fontSize: 28, color: colors.muted }}>Day result</span>
          <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 56, color: colors.red }}>{signed(BAD_DAY)}</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1290, textAlign: "center", opacity: prog(f, bad + 40, 16) }}>
        <Body size={28}>Only 1% of the account, even on a bad day.</Body>
      </div>
    </AbsoluteFill>
  );
};

// 5 ─ Growth: month bars to 6 months
export const SGrowth: React.FC = () => {
  const f = useCurrentFrame();
  const m = at("growth", 1);
  const six = at("growth", 2);
  const barMax = 560;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>If every day matched the example</Kicker>
        <Headline text="Over six months." accent={["six", "months."]} delay={8} size={92} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 480, display: "flex", gap: 20 }}>
        <Stat label="Per day" value={signed(DAY_PL)} color={colors.greenBright} delay={at("growth", 0, 0.5)} size={56} />
        <Stat label="Per month · 21 days" value={<Counter to={MONTH_PL} start={m} dur={30} format={(n) => signed(Math.round(n))} />} color={colors.greenBright} delay={m} size={56} />
      </div>
      <svg width={1080} height={700} style={{ position: "absolute", top: 650 }}>
        {Array.from({ length: MONTHS + 1 }).map((_, i) => {
          const bal = BALANCE + MONTH_PL * i;
          const h = (bal / FINAL) * barMax * prog(f, six - 20 + i * 6, 24);
          const x = SAFE.x + i * 136;
          const last = i === MONTHS;
          return (
            <g key={i}>
              <rect x={x} y={600 - h} width={112} height={h} rx={10} fill={last ? colors.greenBright : i === 0 ? colors.dim : colors.green} opacity={last || i === 0 ? 1 : 0.7} />
              <text x={x + 56} y={640} textAnchor="middle" fontFamily={fonts.mono} fontSize={22} fill={colors.muted}>
                {i === 0 ? "start" : `M${i}`}
              </text>
              {(i === 0 || last) && (
                <text x={x + 56} y={600 - h - 18} textAnchor="middle" fontFamily={fonts.display} fontWeight={800} fontSize={last ? 36 : 26} fill={last ? colors.greenBright : colors.text}>
                  {last ? `$${(bal / 1e6).toFixed(2)}M` : usd(bal)}
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

// 6 ─ Withdrawals: 3% a month, cumulative vs the initial $100k
export const SWithdraw: React.FC = () => {
  const f = useCurrentFrame();
  const start = at("withdraw", 0, 1.2);
  const hit = at("withdraw", 1, 1.0);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>Withdraw {WITHDRAW_PCT}% of the balance each month</Kicker>
        <Headline text="When is the initial $100,000 back in your pocket?" accent={["$100,000"]} delay={8} size={76} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 600 }}>
        <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: 21, letterSpacing: 2, color: colors.muted, padding: "0 20px 10px", textTransform: "uppercase" }}>
          <span style={{ width: 120 }}>Month</span>
          <span style={{ flex: 1 }}>Withdrawn</span>
          <span style={{ flex: 1, textAlign: "right" }}>Taken out so far</span>
        </div>
        {withdrawals.map((r) => {
          const t = start + (r.m - 1) * 14;
          const p = prog(f, t, 16);
          const reached = r.m === RECOVER_MONTH;
          const glow = reached ? prog(f, hit, 16) : 0;
          return (
            <div key={r.m} style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderRadius: 16, marginBottom: 8, background: reached ? `${colors.green}${glow > 0.5 ? "33" : "14"}` : "rgba(255,255,255,0.03)", border: `1px solid ${reached && glow > 0.5 ? colors.green : colors.line}`, opacity: p, transform: `translateX(${(1 - p) * -30}px)` }}>
              <span style={{ width: 120, fontFamily: fonts.display, fontWeight: 700, fontSize: 32, color: colors.text }}>{r.m}</span>
              <span style={{ flex: 1, fontFamily: fonts.display, fontWeight: 600, fontSize: 32, color: colors.greenBright, fontVariantNumeric: "tabular-nums" }}>{usd(r.out)}</span>
              <span style={{ flex: 1, textAlign: "right", fontFamily: fonts.display, fontWeight: 800, fontSize: 34, color: r.cum >= BALANCE ? colors.greenBright : colors.text, fontVariantNumeric: "tabular-nums" }}>{usd(r.cum)}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1210, padding: "20px 30px", borderRadius: 100, background: colors.green, color: colors.ink, textAlign: "center", fontFamily: fonts.display, fontWeight: 800, fontSize: 36, opacity: prog(f, hit, 16), transform: `scale(${0.94 + 0.06 * prog(f, hit, 16)})` }}>
        Initial {usd(BALANCE)} recovered in month {RECOVER_MONTH}
      </div>
    </AbsoluteFill>
  );
};

// 7 ─ Close + risk disclaimer
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
          Aim for 3–5%.
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
