import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { makeTimeline } from "../edu/timeline";
import vo from "../data/voiceover-story.json";
import { Arrow, Card, Counter, Fig, Hand, Header, In, Note, Paper, prog, Ring, signed, Stamp, Stroke, Title, usd } from "./primitives";
import { colors, fonts, H, M, W } from "./theme";

/*
 * "Your account, in ten weeks": every figure is taken from the client's Trade History Report
 * (account •••175, 04.09.2026 – 09.11.2026). See D below; nothing on screen is computed from assumptions.
 */
export const tl = makeTimeline(vo);
const at = (scene: string, n: number, off = 0) => tl.at(scene, n, off);
const PAGES = vo.scenes.length;

export const D = {
  period: "4 Sep – 9 Nov 2026",
  firstDeposit: 100,
  firstTrade: { sym: "WTIUSD", side: "buy", lots: 0.01, open: 93.051, close: 93.975, pl: 9.24, when: "07.09 → 08.09" },
  earlyTrades: [
    { d: "11.09", pl: 65 },
    { d: "14.09", pl: 50 },
    { d: "15.09", pl: 76 },
  ],
  secondDeposit: 950,
  testWithdrawal: 100,
  bigDeposits: [
    { d: "21.09", amt: 14_800, cashback: 5_200 },
    { d: "23.09", amt: 14_800, cashback: 5_200 },
  ],
  depositBonus: 10_000,
  premiumCashback: 15_000,
  balanceAfterFunding: 66_150.03,
  tpTrades: [
    { sym: "WTIUSD", side: "buy", lots: 5.2, open: 96.298, tp: 97.3, pl: 5_226, when: "23.09 → 24.09" },
    { sym: "NDXUSD", side: "buy", lots: 1.7, open: 30_481.72, tp: 30_700, pl: 3_712.29, when: "23.09 → 25.09" },
  ],
  // all 14 closed positions in order, net of swap on the two swapped ones
  closed: [9.24 - 0.21, 65, 50, 76, 5_226 - 230.49, 3_712.29 - 264.32, 4_359, 2_354.1, 3_211, 8_540, 6_622, 7_488, 4_515, 3_680],
  closedLabels: ["07.09", "11.09", "14.09", "15.09", "24.09", "25.09", "30.09", "06.10", "09.10", "14.10", "19.10", "28.10", "02.11", "03.11"],
  largest: { sym: "WTIUSD", side: "sell", lots: 14, open: 96.161, close: 95.551, pl: 8_540, mins: 24, d: "14.10" },
  netProfit: 49_412.61,
  trades: 14,
  avg: 3_529.47,
  sharpe: 0.83,
  bySymbol: [
    { s: "Crude oil (WTI)", n: 12 },
    { s: "Nasdaq 100", n: 1 },
    { s: "Gold", n: 1 },
  ],
  withdrawals: [
    { d: "15.09.2026", amt: 100 },
    { d: "02.10.2026", amt: 2_000 },
  ],
  openPos: { sym: "XAUUSD", side: "buy", lots: 1.15, open: 4_293.99, tp: 4_327, mkt: 4_126.65, floating: -19_244.1, swap: -4_350.61, d: "23.09.2026" },
  marginLevel: 7_993.84,
  marginUsed: 4_938.09,
  deposits: 133_949.05,
  withdrawn: 2_100,
  credits: 237_075.95,
  creditFacility: 185_000,
  balance: 418_337.61,
  equity: 394_742.9,
};
const cum = D.closed.reduce<number[]>((a, v) => [...a, (a[a.length - 1] ?? 0) + v], []);

// 1 ─ Cover
const SCover: React.FC = () => {
  const f = useCurrentFrame();
  const l1 = at("cover", 1);
  const facts = [
    { t: "10 weeks", x: 1180, y: 300, c: colors.blue },
    { t: "14 trades", x: 1370, y: 470, c: colors.green },
    { t: "14 winners", x: 1150, y: 640, c: colors.red },
  ];
  return (
    <AbsoluteFill>
      <Paper />
      <Header page={1} pages={PAGES} title="Cover" />
      <Title text="Your account, in ten weeks." size={92} top={280} width={1000} accent="ten weeks" />
      <Hand x={M + 4} y={520} at={20} size={44} color={colors.ink2} rotate={-1.5}>
        {D.period} · a short story in numbers
      </Hand>
      <Stamp text="Trade history · reviewed 09.11.2026" x={M} y={640} at={at("cover", 0, 2.2)} rotate={-4} size={26} />
      {facts.map((k, i) => (
        <React.Fragment key={k.t}>
          <Card x={k.x} y={k.y} w={300} at={l1 + i * 22} rotate={i % 2 ? 2.5 : -2}>
            <div style={{ fontFamily: fonts.serif, fontWeight: 700, fontSize: 60, color: k.c, textAlign: "center" }}>{k.t}</div>
          </Card>
        </React.Fragment>
      ))}
      <Arrow from={[1330, 400]} to={[1420, 465]} at={l1 + 30} bend={-40} color={colors.pencil} width={2.5} />
      <Arrow from={[1420, 580]} to={[1330, 640]} at={l1 + 52} bend={-40} color={colors.pencil} width={2.5} />
      <Ring x={1150} y={640} w={300} h={110} at={l1 + 70} />
      <Hand x={1480} y={690} at={l1 + 80} size={36} color={colors.red} rotate={4}>
        no losing trade
      </Hand>
    </AbsoluteFill>
  );
};

// 2 ─ The first step: $100 and a 0.01-lot trade
const SStart: React.FC = () => {
  const f = useCurrentFrame();
  const a = at("start", 0, 0.4);
  const b = at("start", 1, 0.8);
  const c = at("start", 1, 3.4);
  const t = D.firstTrade;
  return (
    <AbsoluteFill>
      <Paper />
      <Header page={2} pages={PAGES} title="The first step" />
      <Title text="It started with one hundred dollars." size={60} width={1500} accent="one hundred dollars" />
      <Card x={M} y={330} w={520} at={a} rotate={-1.5}>
        <div style={{ fontFamily: fonts.mono, fontSize: 17, letterSpacing: 3, color: colors.pencil }}>DEPOSIT SLIP · 04.09.2026 15:40</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14 }}>
          <span style={{ fontFamily: fonts.body, fontSize: 26, color: colors.ink2 }}>Deposit</span>
          <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 64, color: colors.ink }}>
            <Counter to={D.firstDeposit} start={a + 6} dur={24} format={(n) => usd(n)} />
          </span>
        </div>
        <div style={{ height: 1, background: colors.faint, margin: "10px 0" }} />
        <div style={{ fontFamily: fonts.body, fontSize: 20, color: colors.ink2 }}>Balance after: {usd(100, 2)}</div>
      </Card>
      <Stamp text="Deposit" x={250} y={388} at={a + 22} rotate={-12} size={19} />
      <Arrow from={[650, 420]} to={[860, 410]} at={b - 6} bend={-50} />
      <Hand x={660} y={330} at={b} size={34} color={colors.red} rotate={-4}>
        three days later…
      </Hand>
      <Card x={880} y={320} w={620} at={b} rotate={1.2}>
        <div style={{ fontFamily: fonts.mono, fontSize: 17, letterSpacing: 3, color: colors.pencil }}>POSITION #225971 · {t.when}</div>
        <div style={{ display: "flex", gap: 30, marginTop: 14 }}>
          <Fig label="Symbol" value={t.sym} size={40} />
          <Fig label="Type" value={t.side.toUpperCase()} size={40} color={colors.blue} />
          <Fig label="Volume" value={`${t.lots} lots`} size={40} />
        </div>
        <div style={{ display: "flex", gap: 30, marginTop: 18 }}>
          <Fig label="Open" value={t.open.toFixed(3)} size={34} />
          <Fig label="Close" value={t.close.toFixed(3)} size={34} />
          <Fig label="Profit" value={signed(t.pl, 2)} size={44} color={colors.green} />
        </div>
      </Card>
      <Ring x={1310} y={455} w={160} h={70} at={c} color={colors.green} />
      <Note x={1180} y={620} w={330} at={c + 10} rotate={3} size={30}>
        Small on purpose. <br /> First, prove the process works.
      </Note>
      <Hand x={M} y={620} at={c + 24} size={40} color={colors.ink2} rotate={-2} width={700}>
        One trade. One day. The account had grown by 9%.
      </Hand>
    </AbsoluteFill>
  );
};

// 3 ─ Building trust: $950 added, three small wins, first withdrawal tested
const STrust: React.FC = () => {
  const f = useCurrentFrame();
  const a = at("trust", 0, 0.6);
  const w = at("trust", 1, 0.6);
  const paid = at("trust", 1, 3.2);
  const y = 560;
  const xs = [M + 60, 560, 860, 1160, 1560];
  const steps = [
    { d: "08.09", label: "Deposit", v: `+${usd(D.secondDeposit)}`, c: colors.blue, at: a },
    { d: D.earlyTrades[0].d, label: "WTI · 0.2 lots", v: signed(D.earlyTrades[0].pl), c: colors.green, at: a + 40 },
    { d: D.earlyTrades[1].d, label: "WTI · 0.2 lots", v: signed(D.earlyTrades[1].pl), c: colors.green, at: a + 58 },
    { d: D.earlyTrades[2].d, label: "WTI · 0.2 lots", v: signed(D.earlyTrades[2].pl), c: colors.green, at: a + 76 },
    { d: "15.09", label: "Withdrawal", v: usd(-D.testWithdrawal), c: colors.red, at: w },
  ];
  const lineP = prog(f, a, 110);
  return (
    <AbsoluteFill>
      <Paper />
      <Header page={3} pages={PAGES} title="Building trust" />
      <Title text="Small steps, in the right direction." size={64} width={1100} />
      <Stroke d={`M${xs[0]} ${y} L${xs[4]} ${y}`} at={a - 4} dur={110} color={colors.pencil} width={2.5} />
      {steps.map((s, i) => (
        <React.Fragment key={s.d}>
          <In at={s.at} style={{ position: "absolute", left: xs[i] - 12, top: y - 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: 12, background: s.c, border: `3px solid ${colors.paper}`, boxShadow: `0 0 0 2px ${s.c}` }} />
          </In>
          <Card x={xs[i] - 110} y={i % 2 ? y + 50 : y - 190} w={240} at={s.at} rotate={i % 2 ? 1.5 : -1.5}>
            <div style={{ fontFamily: fonts.mono, fontSize: 16, letterSpacing: 3, color: colors.pencil }}>{s.d}</div>
            <div style={{ fontFamily: fonts.body, fontSize: 20, color: colors.ink2, marginTop: 4 }}>{s.label}</div>
            <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 40, color: s.c, marginTop: 2 }}>{s.v}</div>
          </Card>
        </React.Fragment>
      ))}
      <Hand x={M} y={790} at={a + 90} size={36} color={colors.ink2} rotate={-1}>
        Balance: $100 → $1,250 after three wins
      </Hand>
      <Stamp text="Paid same day" x={1430} y={720} at={paid} rotate={-10} size={24} />
      <Note x={1180} y={260} w={290} at={paid + 14} rotate={-3} tint={colors.sky} size={28}>
        Withdrawal tested ✓ <br /> Requested 17:39, paid 17:39.
      </Note>
      <Arrow from={[1470, 330]} to={[1540, 420]} at={paid + 22} bend={-30} color={colors.blue} width={2.5} />
      <div style={{ position: "absolute", left: 0, top: 0, opacity: lineP > 0.99 ? 1 : 0 }} />
    </AbsoluteFill>
  );
};

// 4 ─ Scaling up: proper funding, three positions, two take-profits
const SScale: React.FC = () => {
  const a = at("scale", 0, 0.4);
  const b = at("scale", 1, 0.3);
  const tp1 = at("scale", 1, 2.6);
  const tp2 = at("scale", 1, 5.6);
  const rows = [
    { d: D.bigDeposits[0].d, l: "Deposit", v: D.bigDeposits[0].amt, c: colors.ink },
    { d: "", l: "Cashback on deposit fees", v: D.bigDeposits[0].cashback, c: colors.blue },
    { d: D.bigDeposits[1].d, l: "Deposit", v: D.bigDeposits[1].amt, c: colors.ink },
    { d: "", l: "Cashback on deposit fees", v: D.bigDeposits[1].cashback, c: colors.blue },
    { d: "", l: "Bonus on deposit", v: D.depositBonus, c: colors.blue },
    { d: "", l: "Premium contract cashback", v: D.premiumCashback, c: colors.blue },
  ];
  return (
    <AbsoluteFill>
      <Paper />
      <Header page={4} pages={PAGES} title="Scaling up" />
      <Title text="Then the account was funded properly." size={60} width={1100} accent="funded properly" />
      <Card x={M} y={300} w={640} at={a} rotate={-1}>
        <div style={{ fontFamily: fonts.mono, fontSize: 17, letterSpacing: 3, color: colors.pencil }}>LEDGER · 21 – 23 SEPTEMBER</div>
        {rows.map((r, i) => (
          <In key={i} at={a + 10 + i * 9} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "7px 0", borderBottom: `1px dashed ${colors.faint}` }}>
            <span style={{ fontFamily: fonts.body, fontSize: 21, color: colors.ink2 }}>
              <span style={{ fontFamily: fonts.mono, fontSize: 16, color: colors.pencil, marginRight: 12 }}>{r.d || "     "}</span>
              {r.l}
            </span>
            <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 26, color: r.c, fontVariantNumeric: "tabular-nums" }}>+{usd(r.v)}</span>
          </In>
        ))}
        <In at={a + 70} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 12 }}>
          <span style={{ fontFamily: fonts.serif, fontWeight: 700, fontSize: 26, color: colors.ink }}>Balance, 23.09 evening</span>
          <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 38, color: colors.ink }}>{usd(D.balanceAfterFunding, 2)}</span>
        </In>
      </Card>
      <Hand x={M + 10} y={760} at={a + 80} size={34} color={colors.blue} rotate={-2}>
        $29,600 deposited · $35,400 added on top
      </Hand>
      <Hand x={820} y={300} at={b} size={36} color={colors.red} rotate={-3}>
        same evening, three positions:
      </Hand>
      {D.tpTrades.map((t, i) => (
        <React.Fragment key={t.sym}>
          <Card x={820} y={360 + i * 190} w={720} at={b + 10 + i * 20} rotate={i ? 1 : -0.8}>
            <div style={{ display: "flex", gap: 26, alignItems: "flex-end" }}>
              <Fig label={t.when} value={t.sym} size={36} />
              <Fig label="Type" value={`${t.side.toUpperCase()} ${t.lots}`} size={30} color={colors.blue} />
              <Fig label="Open → TP" value={`${t.open.toLocaleString("en-US", { minimumFractionDigits: t.open > 1000 ? 2 : 3 })} → ${t.tp.toLocaleString("en-US", { minimumFractionDigits: t.tp > 1000 ? 2 : 3 })}`} size={26} />
              <div style={{ marginLeft: "auto" }}>
                <Fig label="Profit" value={signed(t.pl)} size={46} color={colors.green} />
              </div>
            </div>
          </Card>
          <Stamp text="TP hit" x={1420} y={340 + i * 190} at={i ? tp2 : tp1} rotate={-14} size={26} color={colors.green} />
        </React.Fragment>
      ))}
      <Card x={820} y={740} w={720} at={b + 50} rotate={0.6} tint="#FBF7EE">
        <div style={{ display: "flex", gap: 26, alignItems: "flex-end" }}>
          <Fig label="23.09 → open" value="XAUUSD" size={36} />
          <Fig label="Type" value="BUY 1.15" size={30} color={colors.blue} />
          <Fig label="Open → TP" value="4,293.99 → 4,327.00" size={26} />
          <div style={{ marginLeft: "auto", fontFamily: fonts.hand, fontSize: 32, color: colors.pencil }}>still open → p. 8</div>
        </div>
      </Card>
    </AbsoluteFill>
  );
};

// 5 ─ The run: cumulative closed profit, trade by trade, on graph paper
const SRun: React.FC = () => {
  const f = useCurrentFrame();
  const a = at("run", 0, 0.5);
  const big = at("run", 1, 0.6);
  const tot = at("run", 2, 0.8);
  const x0 = M + 70;
  const x1 = W - 560;
  const yTop = 300;
  const yBot = 820;
  const n = D.closed.length;
  const maxV = cum[n - 1] * 1.06;
  const X = (i: number) => x0 + (i / (n - 1)) * (x1 - x0);
  const Y = (v: number) => yBot - (v / maxV) * (yBot - yTop);
  const shown = interpolate(f, [a, a + 150], [0, n - 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pts: string[] = [];
  for (let i = 0; i <= Math.floor(shown); i++) pts.push(`${X(i)},${Y(cum[i])}`);
  if (shown < n - 1) {
    const i = Math.floor(shown);
    const t = shown - i;
    pts.push(`${X(i) + (X(i + 1) - X(i)) * t},${Y(cum[i]) + (Y(cum[i + 1]) - Y(cum[i])) * t}`);
  }
  const iBig = 9;
  return (
    <AbsoluteFill>
      <Paper grid="graph" />
      <Header page={5} pages={PAGES} title="The run" />
      <Title text="Fourteen trades. Fourteen in profit." size={60} width={1100} accent="Fourteen in profit" />
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        <line x1={x0 - 30} x2={x1 + 30} y1={yBot} y2={yBot} stroke={colors.ink} strokeWidth={2} opacity={0.5} />
        <line x1={x0 - 30} x2={x0 - 30} y1={yTop - 30} y2={yBot} stroke={colors.ink} strokeWidth={2} opacity={0.5} />
        <text x={x0 - 40} y={yTop - 36} fontFamily={fonts.hand} fontSize={30} fill={colors.ink2}>
          closed profit, cumulative
        </text>
        <polyline points={pts.join(" ")} fill="none" stroke={colors.blue} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
        {D.closed.map((v, i) => {
          const on = shown >= i - 0.01;
          return (
            <g key={i} opacity={on ? 1 : 0}>
              <circle cx={X(i)} cy={Y(cum[i])} r={i === iBig ? 11 : 8} fill={i === iBig ? colors.red : colors.paper} stroke={colors.blue} strokeWidth={3.5} />
              <text x={X(i)} y={yBot + 34} textAnchor="middle" fontFamily={fonts.mono} fontSize={17} fill={colors.pencil}>
                {D.closedLabels[i]}
              </text>
              <text x={X(i)} y={Y(cum[i]) - 20 - (i % 2 ? 0 : 22)} textAnchor="middle" fontFamily={fonts.hand} fontWeight={700} fontSize={25} fill={colors.green}>
                {signed(Math.round(v))}
              </text>
            </g>
          );
        })}
      </svg>
      <Ring x={X(iBig) - 24} y={Y(cum[iBig]) - 24} w={48} h={48} at={big} />
      <Arrow from={[X(iBig) + 150, Y(cum[iBig]) - 170]} to={[X(iBig) + 30, Y(cum[iBig]) - 30]} at={big + 10} bend={40} />
      <Note x={X(iBig) + 120} y={Y(cum[iBig]) - 330} w={330} at={big + 16} rotate={-3} tint={colors.pink} size={27}>
        Largest trade: {D.largest.sym} sell {D.largest.lots} lots, {D.largest.d}. Closed {D.largest.mins} minutes later: <b>{signed(D.largest.pl)}</b>
      </Note>
      <Card x={W - 500} y={330} w={390} at={tot} rotate={1.5}>
        <Fig label="Closed trading profit" value={<Counter to={D.netProfit} start={tot + 6} dur={40} format={(n) => usd(n, 2)} />} size={54} color={colors.green} sub="after swaps · 14 positions" />
      </Card>
      <Ring x={W - 500} y={330} w={390} h={150} at={tot + 40} color={colors.green} />
    </AbsoluteFill>
  );
};

// 6 ─ The record card
const SStats: React.FC = () => {
  const a = at("stats", 0, 0.3);
  const b = at("stats", 1, 0.4);
  const cells = [
    { l: "Closed trades", v: String(D.trades) },
    { l: "Winning trades", v: `${D.trades} · 100%`, c: colors.green },
    { l: "Losing trades", v: "0", c: colors.ink },
    { l: "Average profit", v: usd(D.avg) },
    { l: "Largest profit", v: usd(D.largest.pl) },
    { l: "Sharpe ratio", v: D.sharpe.toFixed(2) },
  ];
  const maxN = Math.max(...D.bySymbol.map((s) => s.n));
  return (
    <AbsoluteFill>
      <Paper />
      <Header page={6} pages={PAGES} title="The record" />
      <Title text="The record, as the platform reports it." size={60} width={1200} />
      <Card x={M} y={310} w={980} at={a} rotate={-0.6}>
        <div style={{ fontFamily: fonts.mono, fontSize: 17, letterSpacing: 3, color: colors.pencil }}>RESULTS · TRADE HISTORY REPORT · 09.11.2026</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "22px 30px", marginTop: 16 }}>
          {cells.map((c, i) => (
            <In key={c.l} at={a + 10 + i * 8}>
              <Fig label={c.l} value={c.v} size={44} color={c.c ?? colors.ink} />
            </In>
          ))}
        </div>
      </Card>
      <Stamp text="14 / 14" x={860} y={290} at={a + 60} rotate={12} size={40} />
      <Card x={1170} y={310} w={620} at={b} rotate={1.2}>
        <div style={{ fontFamily: fonts.mono, fontSize: 17, letterSpacing: 3, color: colors.pencil }}>BY MARKET</div>
        {D.bySymbol.map((s, i) => (
          <In key={s.s} at={b + 8 + i * 14} style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fonts.body, fontSize: 22, color: colors.ink2 }}>
              <span>{s.s}</span>
              <span style={{ fontFamily: fonts.display, fontWeight: 800, color: colors.ink }}>{s.n}</span>
            </div>
            <div style={{ height: 18, background: colors.paper2, borderRadius: 4, marginTop: 6, overflow: "hidden" }}>
              <div style={{ width: `${(s.n / maxN) * 100}%`, height: "100%", background: i === 0 ? colors.blue : i === 1 ? colors.green : colors.gold }} />
            </div>
          </In>
        ))}
      </Card>
      <Hand x={M + 10} y={700} at={a + 70} size={36} color={colors.ink2} rotate={-1.5} width={1000}>
        Every closed position in the period finished in profit. Average hold: hours, not weeks.
      </Hand>
    </AbsoluteFill>
  );
};

// 7 ─ Money out
const SOut: React.FC = () => {
  const a = at("out", 0, 0.8);
  return (
    <AbsoluteFill>
      <Paper />
      <Header page={7} pages={PAGES} title="Money out" />
      <Title text="Money moved out as easily as in." size={62} width={1100} accent="out" />
      {D.withdrawals.map((wd, i) => (
        <React.Fragment key={wd.d}>
          <Card x={M + i * 620} y={330} w={540} at={a + i * 50} rotate={i ? 1.5 : -1.5}>
            <div style={{ fontFamily: fonts.mono, fontSize: 17, letterSpacing: 3, color: colors.pencil }}>WITHDRAWAL · {wd.d}</div>
            <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 72, color: colors.ink, marginTop: 10 }}>{usd(wd.amt)}</div>
            <div style={{ fontFamily: fonts.body, fontSize: 20, color: colors.ink2, marginTop: 6 }}>Status: withdraw performed</div>
          </Card>
          <Stamp text="Paid" x={M + 380 + i * 620} y={350} at={a + 28 + i * 50} rotate={-14} size={30} color={colors.green} />
        </React.Fragment>
      ))}
      <Arrow from={[1380, 420]} to={[1530, 420]} at={a + 110} bend={-40} />
      <Note x={1540} y={340} w={300} at={a + 120} rotate={3} size={28}>
        Total withdrawn so far: <b>{usd(D.withdrawn)}</b>. <br /> Both arrived.
      </Note>
      <Hand x={M + 10} y={640} at={a + 130} size={36} color={colors.ink2} rotate={-1.5} width={1100}>
        Withdrawals are part of the plan, not an exception to it.
      </Hand>
    </AbsoluteFill>
  );
};

// 8 ─ The open position, honestly
const SOpen: React.FC = () => {
  const f = useCurrentFrame();
  const a = at("open", 0, 0.4);
  const b = at("open", 1, 0.3);
  const c = at("open", 1, 3.6);
  const o = D.openPos;
  const lo = 4_050;
  const hi = 4_380;
  const bx = 1060;
  const bw = 740;
  const by = 330;
  const bh = 380;
  const Y = (p: number) => bh - ((p - lo) / (hi - lo)) * bh; // relative to the chart box
  const pathP = prog(f, a + 20, 60);
  const pts = [
    [0, o.open],
    [0.15, 4_240],
    [0.3, 4_300],
    [0.5, 4_180],
    [0.7, 4_220],
    [0.85, 4_110],
    [1, o.mkt],
  ].filter((p) => p[0] <= pathP + 0.001);
  return (
    <AbsoluteFill>
      <Paper />
      <Header page={8} pages={PAGES} title="The open position" />
      <Title text="One position is still open." size={62} width={1000} />
      <Card x={M} y={330} w={860} at={a} rotate={-0.8}>
        <div style={{ fontFamily: fonts.mono, fontSize: 17, letterSpacing: 3, color: colors.pencil }}>OPEN POSITION #593754 · SINCE {o.d}</div>
        <div style={{ display: "flex", gap: 36, marginTop: 14 }}>
          <Fig label="Symbol" value={o.sym} size={40} />
          <Fig label="Type" value={`${o.side.toUpperCase()} ${o.lots}`} size={40} color={colors.blue} />
          <Fig label="Open price" value={o.open.toLocaleString("en-US", { minimumFractionDigits: 2 })} size={40} />
          <Fig label="Take profit" value={o.tp.toLocaleString("en-US", { minimumFractionDigits: 2 })} size={40} color={colors.green} />
        </div>
        <div style={{ display: "flex", gap: 36, marginTop: 22 }}>
          <In at={b}>
            <Fig label="Market price" value={o.mkt.toLocaleString("en-US", { minimumFractionDigits: 2 })} size={40} />
          </In>
          <In at={b + 10}>
            <Fig label="Floating P/L" value={usd(o.floating, 2)} size={40} color={colors.red} />
          </In>
          <In at={b + 20}>
            <Fig label="Swap" value={usd(o.swap, 2)} size={40} color={colors.red} />
          </In>
        </div>
      </Card>
      <div style={{ position: "absolute", left: bx, top: by, width: bw, height: bh }}>
        <svg width={bw} height={bh} style={{ overflow: "visible" }}>
          <line x1={0} x2={bw} y1={Y(o.open)} y2={Y(o.open)} stroke={colors.blue} strokeWidth={2} strokeDasharray="8 8" opacity={prog(f, a, 20)} />
          <text x={4} y={Y(o.open) - 8} fontFamily={fonts.hand} fontSize={26} fill={colors.blue} opacity={prog(f, a, 20)}>
            bought 4,293.99
          </text>
          <line x1={0} x2={bw} y1={Y(o.tp)} y2={Y(o.tp)} stroke={colors.green} strokeWidth={2} strokeDasharray="8 8" opacity={prog(f, a, 20)} />
          <text x={4} y={Y(o.tp) - 8} fontFamily={fonts.hand} fontSize={26} fill={colors.green} opacity={prog(f, a, 20)}>
            take profit 4,327
          </text>
          <polyline points={pts.map((p) => `${p[0] * bw},${Y(p[1])}`).join(" ")} fill="none" stroke={colors.ink} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
          {pathP >= 1 && <circle cx={bw} cy={Y(o.mkt)} r={9} fill={colors.red} />}
          <text x={bw - 6} y={Y(o.mkt) + 36} textAnchor="end" fontFamily={fonts.hand} fontSize={28} fill={colors.red} opacity={prog(f, b, 16)}>
            today 4,126.65
          </text>
        </svg>
      </div>
      <Card x={M} y={640} w={860} at={c} rotate={0.6} tint="#FBF7EE">
        <div style={{ display: "flex", gap: 40 }}>
          <Fig label="Margin used" value={usd(D.marginUsed, 2)} size={36} />
          <Fig label="Equity" value={usd(D.equity, 2)} size={36} />
          <Fig label="Margin level" value={`${D.marginLevel.toLocaleString("en-US", { maximumFractionDigits: 0 })}%`} size={36} color={colors.green} />
        </div>
      </Card>
      <Ring x={M + 560} y={660} w={270} h={80} at={c + 20} color={colors.green} />
      <Hand x={1060} y={760} at={c + 30} size={36} color={colors.ink2} rotate={-2} width={760}>
        The position uses about 1% of the equity. There is no margin pressure; it can be managed on its own terms.
      </Hand>
    </AbsoluteFill>
  );
};

// 9 ─ Where we stand: the ledger
const SStanding: React.FC = () => {
  const a = at("standing", 0, 0.8);
  const b = at("standing", 1, 0.3);
  const rows = [
    { l: "Deposits (8)", v: D.deposits, c: colors.ink, at: a },
    { l: "Withdrawals (2)", v: -D.withdrawn, c: colors.red, at: a + 16 },
    { l: "Bonuses, cashback & credit", v: D.credits, c: colors.blue, at: a + 40, sub: `incl. credit facility ${usd(D.creditFacility)}` },
    { l: "Closed trading profit", v: D.netProfit, c: colors.green, at: b },
  ];
  return (
    <AbsoluteFill>
      <Paper />
      <Header page={9} pages={PAGES} title="Where we stand" />
      <Title text="Where the account stands today." size={62} width={1100} />
      <Card x={M} y={300} w={1000} at={a - 10} rotate={-0.5}>
        <div style={{ fontFamily: fonts.mono, fontSize: 17, letterSpacing: 3, color: colors.pencil }}>ACCOUNT LEDGER · 04.09 – 09.11.2026</div>
        {rows.map((r) => (
          <In key={r.l} at={r.at} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "12px 0", borderBottom: `1px dashed ${colors.faint}` }}>
            <span style={{ fontFamily: fonts.body, fontSize: 25, color: colors.ink2 }}>
              {r.l}
              {r.sub && <span style={{ fontFamily: fonts.hand, fontSize: 24, color: colors.pencil, marginLeft: 14 }}>{r.sub}</span>}
            </span>
            <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 34, color: r.c, fontVariantNumeric: "tabular-nums" }}>
              <Counter to={r.v} start={r.at} dur={30} format={(n) => signed(n, 2)} />
            </span>
          </In>
        ))}
        <In at={b + 20} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "14px 0 6px" }}>
          <span style={{ fontFamily: fonts.serif, fontWeight: 700, fontSize: 28, color: colors.ink }}>Balance</span>
          <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 38, color: colors.ink }}>{usd(D.balance, 2)}</span>
        </In>
        <In at={b + 32} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: `2px solid ${colors.ink}` }}>
          <span style={{ fontFamily: fonts.body, fontSize: 25, color: colors.ink2 }}>Open position & swap (floating)</span>
          <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 34, color: colors.red }}>{usd(D.equity - D.balance, 2)}</span>
        </In>
        <In at={b + 50} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "14px 0 0" }}>
          <span style={{ fontFamily: fonts.serif, fontWeight: 700, fontSize: 32, color: colors.ink }}>Equity today</span>
          <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 52, color: colors.ink }}>
            <Counter to={D.equity} start={b + 50} dur={40} format={(n) => usd(n, 2)} />
          </span>
        </In>
      </Card>
      <Ring x={M + 640} y={760} w={350} h={90} at={b + 90} />
      <Note x={1200} y={330} w={320} at={a + 50} rotate={2.5} size={27}>
        Deposits add up to {usd(D.deposits)}. Bonuses and cashback brought the balance to {usd(D.balance)}.
      </Note>
      <Note x={1230} y={600} w={320} at={b + 60} rotate={-2} tint={colors.sky} size={27}>
        Trading alone added <b>{usd(D.netProfit)}</b> in ten weeks, with no losing trade.
      </Note>
      <Arrow from={[1230, 560]} to={[1120, 520]} at={a + 70} bend={30} color={colors.pencil} width={2.5} />
    </AbsoluteFill>
  );
};

// 10 ─ Close
const SClose: React.FC = () => {
  const a = at("close", 0, 0.3);
  const b = at("close", 1, 0.2);
  return (
    <AbsoluteFill>
      <Paper />
      <Header page={10} pages={PAGES} title="Next chapter" />
      <Title text="Chapter one: complete." size={92} top={250} width={1100} accent="complete" />
      <Hand x={M + 4} y={420} at={a + 10} size={44} color={colors.ink2} rotate={-1.5} width={1100}>
        $100 → a funded account · 14 closed trades, 14 in profit · {usd(D.netProfit)} realised
      </Hand>
      <Stamp text="To be continued" x={1320} y={300} at={a + 40} rotate={-10} size={34} />
      <Arrow from={[1200, 470]} to={[1380, 440]} at={a + 30} bend={30} />
      <Card x={M} y={560} w={1700} at={b} rotate={0} tint="#FBF7EE" style={{ padding: "18px 26px" }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 16, letterSpacing: 3, color: colors.pencil, marginBottom: 8 }}>RISK DISCLAIMER</div>
        <div style={{ fontFamily: fonts.body, fontSize: 19, lineHeight: 1.45, color: colors.ink2 }}>
          Trading CFDs and FX Contracts is highly speculative and involves significant risk of your capital. You should not risk more than you can afford. Before taking any market action, you need to be properly aware of the risk. Past performance is not a guarantee of future performance. The information above is intended to be general and is not to be considered investment advice. This information should not be understood as an offer. Should you proceed using the information above for opening market positions, it is considered you did so at your own risk.
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: 17, color: colors.pencil, marginTop: 8 }}>Figures are taken from the platform's Trade History Report dated 09.11.2026 13:24. Bonuses and credit are subject to the account's terms.</div>
      </Card>
    </AbsoluteFill>
  );
};

export const scenes: Record<string, React.FC> = { cover: SCover, start: SStart, trust: STrust, scale: SScale, run: SRun, stats: SStats, out: SOut, open: SOpen, standing: SStanding, close: SClose };
const abs = (scene: string, n: number, off = 0) => tl.at(scene, n, off) + tl.scenes.find((x) => x.id === scene)!.from;
export const impacts = [abs("scale", 1, 2.6), abs("run", 2, 0.8), abs("stats", 0, 2.3), abs("standing", 1, 2.0)];
