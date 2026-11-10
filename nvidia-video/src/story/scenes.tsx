import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { makeTimeline } from "../edu/timeline";
import vo from "../data/voiceover-story.json";
import { Arrow, Card, Circled, Counter, Fig, Hand, In, Note, Paper, prog, Ring, signed, Stamp, Stroke, Title, usd } from "./primitives";
import { colors, fonts, H, M, W } from "./theme";

/*
 * "Your account, in ten weeks": every figure is transcribed from the client's Trade History Report
 * (account •••175, 04.09.2026 – 10.11.2026, exported 10.11.2026 07:38). See D; nothing on screen is assumed.
 */
export const tl = makeTimeline(vo);
const at = (scene: string, n: number, off = 0) => tl.at(scene, n, off);
export const PERIOD = "04.09.2026 – 10.11.2026";

export const D = {
  period: "4 Sep – 10 Nov 2026",
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
  /** The first 14 closed positions (to 03.11), net of swap. */
  closed14: [9.24 - 0.21, 65, 50, 76, 5_226 - 230.49, 3_712.29 - 264.32, 4_359, 2_354.1, 3_211, 8_540, 6_622, 7_488, 4_515, 3_680],
  closed14Labels: ["07.09", "11.09", "14.09", "15.09", "24.09", "25.09", "30.09", "06.10", "09.10", "14.10", "19.10", "28.10", "02.11", "03.11"],
  profitTo3Nov: 49_412.61,
  largestOct: { sym: "WTIUSD", side: "sell", lots: 14, open: 96.161, close: 95.551, pl: 8_540, mins: 24, d: "14.10" },
  withdrawals: [
    { d: "15.09.2026", amt: 100 },
    { d: "02.10.2026", amt: 2_000 },
  ],
  /** The gold position that lagged, and how it was averaged out. */
  gold: {
    first: { lots: 1.15, open: 4_293.99, tp: 4_327, d: "23.09.2026 18:26", lowFloating: -20_299.8 },
    add: { lots: 5.75, open: 4_087.24, close: 4_133.0, pl: 26_312, dOpen: "09.11 07:05", dClose: "09.11 16:05" },
    extra: { lots: 1.0, open: 4_108.1, close: 4_127.01, pl: 1_891, d: "10.11" },
    firstClose: { price: 4_117.47, pl: -20_299.8, swap: -4_455.19, d: "10.11.2026 00:05" },
  },
  /** 9–10 November, in narration order. */
  lastDay: [
    { sym: "NDXUSD", name: "Nasdaq 100", side: "buy", lots: 1.45, open: 27_331.0, close: 27_838.0, pl: 7_351.5, t: "09.11 13:25 → 14:05" },
    { sym: "WTIUSD", name: "Crude oil", side: "buy", lots: 4.6, open: 85.575, close: 87.583, pl: 9_236.8, t: "09.11 14:05 → 15:20" },
    { sym: "DJIUSD", name: "Dow Jones", side: "buy", lots: 8, open: 52_240.35, close: 52_660.12, pl: 3_358.16, t: "09.11 14:05 → 10.11 05:02" },
    { sym: "XAUUSD", name: "Gold", side: "buy", lots: 1.0, open: 4_108.1, close: 4_127.01, pl: 1_891, t: "10.11 → 10.11 00:05" },
    { sym: "XAUUSD", name: "Gold · averaging", side: "buy", lots: 5.75, open: 4_087.24, close: 4_133.0, pl: 26_312, t: "09.11 07:05 → 16:05" },
  ],
  balanceBeforeLastDay: 433_587.05,
  results: { trades: 20, wins: 19, losses: 1, net: 72_807.08, gross: 97_562.07, grossLoss: -24_754.99, pf: 3.94, ddPct: 7.4, avgWin: 5_134.85, largest: 26_312, sharpe: 0.66 },
  bySymbol: [
    { s: "Crude oil (WTI)", n: 13 },
    { s: "Gold", n: 4 },
    { s: "Nasdaq 100", n: 2 },
    { s: "Dow Jones", n: 1 },
  ],
  deposits: 149_198.49,
  depositCount: 9,
  withdrawn: 2_100,
  // The 125,000 "signed deal, removable" bonus has since been removed from the account, so it is excluded here.
  credits: 237_075.95 - 125_000,
  creditFacility: 185_000 - 125_000,
  balance: 456_981.52 - 125_000,
  equity: 456_981.52 - 125_000,
};
const cum14 = D.closed14.reduce<number[]>((a, v) => [...a, (a[a.length - 1] ?? 0) + v], []);
const g = D.gold;
const goldAvgEntry = (g.first.lots * g.first.open + g.add.lots * g.add.open) / (g.first.lots + g.add.lots); // 4,121.70
const goldFirstTotal = g.firstClose.pl + g.firstClose.swap; // −24,754.99
const goldNet = g.add.pl + g.extra.pl + goldFirstTotal; // +3,448.01
const lastDayTotal = D.lastDay.reduce((a, t) => a + t.pl, 0); // 48,149.46
const pct = (v: number, base = D.balanceBeforeLastDay) => `${((v / base) * 100).toFixed(2)}%`;
const num = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// 1 ─ Cover
const SCover: React.FC = () => {
  const l1 = at("cover", 1);
  const facts = [
    { t: "10 weeks", x: 1180, y: 300, c: colors.blue },
    { t: "20 trades", x: 1370, y: 470, c: colors.green },
    { t: "19 winners", x: 1130, y: 640, c: colors.red },
  ];
  return (
    <AbsoluteFill>
      <Paper />
      <Title text="Your account, in ten weeks." size={92} top={280} width={1000} accent="ten weeks" />
      <Hand x={M + 4} y={520} at={20} size={44} color={colors.ink2} rotate={-1.5}>
        {D.period} · a short story in numbers
      </Hand>
      <Stamp text="Trade history · reviewed 10.11.2026" x={M} y={640} at={at("cover", 0, 2.2)} rotate={-4} size={26} />
      {facts.map((k, i) => (
        <Card key={k.t} x={k.x} y={k.y} w={340} at={l1 + i * 22} rotate={i % 2 ? 2.5 : -2}>
          <div style={{ fontFamily: fonts.serif, fontWeight: 700, fontSize: 54, color: k.c, textAlign: "center", whiteSpace: "nowrap" }}>{k.t}</div>
        </Card>
      ))}
      <Arrow from={[1330, 400]} to={[1420, 465]} at={l1 + 30} bend={-40} color={colors.pencil} width={2.5} />
      <Arrow from={[1420, 580]} to={[1330, 640]} at={l1 + 52} bend={-40} color={colors.pencil} width={2.5} />
      <Ring x={1130} y={640} w={340} h={110} at={l1 + 70} />
      <Hand x={1500} y={690} at={l1 + 82} size={36} color={colors.red} rotate={4}>
        one loss, on purpose
      </Hand>
    </AbsoluteFill>
  );
};

// 2 ─ The first step
const SStart: React.FC = () => {
  const a = at("start", 0, 0.4);
  const b = at("start", 1, 0.8);
  const c = at("start", 1, 3.6);
  const t = D.firstTrade;
  return (
    <AbsoluteFill>
      <Paper />
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
          <Fig label="Profit" value={<Circled at={c} color={colors.green} padX={16} padY={6}>{signed(t.pl, 2)}</Circled>} size={44} color={colors.green} />
        </div>
      </Card>
      <Note x={1180} y={620} w={330} at={c + 10} rotate={3} size={30}>
        Small on purpose. <br /> First, prove the process works.
      </Note>
      <Hand x={M} y={620} at={c + 24} size={40} color={colors.ink2} rotate={-2} width={700}>
        One trade. One day. The account had grown by 9%.
      </Hand>
    </AbsoluteFill>
  );
};

// 3 ─ Building trust
const STrust: React.FC = () => {
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
  return (
    <AbsoluteFill>
      <Paper />
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
    </AbsoluteFill>
  );
};

// 4 ─ Scaling up
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
      <Title text="Then the account was funded properly." size={60} width={1100} accent="funded properly" />
      <Card x={M} y={300} w={640} at={a} rotate={-1}>
        <div style={{ fontFamily: fonts.mono, fontSize: 17, letterSpacing: 3, color: colors.pencil }}>LEDGER · 21 – 23 SEPTEMBER</div>
        {rows.map((r, i) => (
          <In key={i} at={a + 10 + i * 9} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "7px 0", borderBottom: `1px dashed ${colors.faint}` }}>
            <span style={{ fontFamily: fonts.body, fontSize: 21, color: colors.ink2 }}>
              <span style={{ fontFamily: fonts.mono, fontSize: 16, color: colors.pencil, marginRight: 12, display: "inline-block", width: 56 }}>{r.d}</span>
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
              <Fig label="Open → TP" value={`${num(t.open, t.open > 1000 ? 2 : 3)} → ${num(t.tp, t.tp > 1000 ? 2 : 3)}`} size={26} />
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
          <div style={{ marginLeft: "auto", fontFamily: fonts.hand, fontSize: 32, color: colors.pencil }}>kept open → p. 7</div>
        </div>
      </Card>
    </AbsoluteFill>
  );
};

// 5 ─ The run through October
const SRun: React.FC = () => {
  const f = useCurrentFrame();
  const a = at("run", 0, 0.5);
  const big = at("run", 1, 0.6);
  const tot = at("run", 2, 0.8);
  const x0 = M + 70;
  const x1 = W - 560;
  const yTop = 300;
  const yBot = 820;
  const n = D.closed14.length;
  const maxV = cum14[n - 1] * 1.06;
  const X = (i: number) => x0 + (i / (n - 1)) * (x1 - x0);
  const Y = (v: number) => yBot - (v / maxV) * (yBot - yTop);
  const shown = interpolate(f, [a, a + 150], [0, n - 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pts: string[] = [];
  for (let i = 0; i <= Math.floor(shown); i++) pts.push(`${X(i)},${Y(cum14[i])}`);
  if (shown < n - 1) {
    const i = Math.floor(shown);
    const t = shown - i;
    pts.push(`${X(i) + (X(i + 1) - X(i)) * t},${Y(cum14[i]) + (Y(cum14[i + 1]) - Y(cum14[i])) * t}`);
  }
  const iBig = 9;
  return (
    <AbsoluteFill>
      <Paper grid="graph" />
      <Title text="Through October: fourteen for fourteen." size={60} width={1200} accent="fourteen for fourteen" />
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        <line x1={x0 - 30} x2={x1 + 30} y1={yBot} y2={yBot} stroke={colors.ink} strokeWidth={2} opacity={0.5} />
        <line x1={x0 - 30} x2={x0 - 30} y1={yTop - 30} y2={yBot} stroke={colors.ink} strokeWidth={2} opacity={0.5} />
        <text x={x0 - 40} y={yTop - 36} fontFamily={fonts.hand} fontSize={30} fill={colors.ink2}>
          closed profit, cumulative · 07.09 – 03.11
        </text>
        <polyline points={pts.join(" ")} fill="none" stroke={colors.blue} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
        {D.closed14.map((v, i) => {
          const on = shown >= i - 0.01;
          return (
            <g key={i} opacity={on ? 1 : 0}>
              <circle cx={X(i)} cy={Y(cum14[i])} r={i === iBig ? 11 : 8} fill={i === iBig ? colors.red : colors.paper} stroke={colors.blue} strokeWidth={3.5} />
              <text x={X(i)} y={yBot + 34} textAnchor="middle" fontFamily={fonts.mono} fontSize={17} fill={colors.pencil}>
                {D.closed14Labels[i]}
              </text>
              <text x={X(i)} y={Y(cum14[i]) - 20 - (i % 2 ? 0 : 22)} textAnchor="middle" fontFamily={fonts.hand} fontWeight={700} fontSize={25} fill={colors.green}>
                {signed(Math.round(v))}
              </text>
            </g>
          );
        })}
      </svg>
      <Ring x={X(iBig) - 24} y={Y(cum14[iBig]) - 24} w={48} h={48} at={big} />
      <Arrow from={[X(iBig) + 150, Y(cum14[iBig]) - 170]} to={[X(iBig) + 30, Y(cum14[iBig]) - 30]} at={big + 10} bend={40} />
      <Note x={X(iBig) + 120} y={Y(cum14[iBig]) - 330} w={330} at={big + 16} rotate={-3} tint={colors.pink} size={27}>
        Largest in October: {D.largestOct.sym} sell {D.largestOct.lots} lots, {D.largestOct.d}. Closed {D.largestOct.mins} minutes later: <b>{signed(D.largestOct.pl)}</b>
      </Note>
      <Card x={W - 500} y={330} w={390} at={tot} rotate={1.5}>
        <Fig label="Closed profit · 03.11" value={<Circled at={tot + 40} color={colors.green} padX={18} padY={8}><Counter to={D.profitTo3Nov} start={tot + 6} dur={40} format={(n) => usd(n, 2)} /></Circled>} size={54} color={colors.green} sub="after swaps · 14 positions" />
      </Card>
    </AbsoluteFill>
  );
};

// 6 ─ Money out
const SOut: React.FC = () => {
  const a = at("out", 0, 0.8);
  return (
    <AbsoluteFill>
      <Paper />
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

/** Shared price ladder for the two gold pages. Maps a gold price to a y inside the ladder box. */
const LADDER = { x: 1040, y: 300, w: 760, h: 520, lo: 4_060, hi: 4_320 };
const ladderY = (p: number) => LADDER.y + LADDER.h - ((p - LADDER.lo) / (LADDER.hi - LADDER.lo)) * LADDER.h;
const Level: React.FC<{ price: number; label: string; color: string; at: number; side?: "left" | "right"; bold?: boolean; dash?: boolean; below?: boolean; yOf?: (p: number) => number }> = ({ price, label, color, at, side = "left", bold, dash, below, yOf = ladderY }) => {
  const f = useCurrentFrame();
  const p = prog(f, at, 26);
  const y = yOf(price);
  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        <line x1={LADDER.x} x2={LADDER.x + LADDER.w * p} y1={y} y2={y} stroke={color} strokeWidth={bold ? 4 : 2.5} strokeDasharray={dash ? "10 8" : undefined} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", top: below ? y + 4 : y - 34, left: side === "left" ? LADDER.x + 10 : undefined, right: side === "right" ? W - (LADDER.x + LADDER.w) + 10 : undefined, fontFamily: fonts.hand, fontWeight: 700, fontSize: 27, color, opacity: p, whiteSpace: "nowrap" }}>
        {label}
      </div>
    </>
  );
};

// 7 ─ Gold: the first position stayed open; averaging brought the entry down; both closed in profit overall.
const GX = { x: 1000, y: 290, w: 800, h: 520, lo: 4_060, hi: 4_320 };
const gy = (p: number) => GX.y + GX.h - ((p - GX.lo) / (GX.hi - GX.lo)) * GX.h;
const gx = (t: number) => GX.x + t * GX.w;
const SAverage: React.FC = () => {
  const f = useCurrentFrame();
  const a = at("average", 0, 0.3);
  const b = at("average", 1, 0.3);
  const c = at("average", 2, 0.3);
  const net = at("average", 2, 6.0);
  // One continuous sketch: 23.09 entry → lower → 09.11 averaging buy → recovery → both closed.
  const path: [number, number][] = [
    [0, g.first.open],
    [0.1, 4_250],
    [0.2, 4_300],
    [0.32, 4_180],
    [0.42, 4_220],
    [0.52, 4_110],
    [0.6, g.add.open],
    [0.72, 4_105],
    [0.84, g.add.close],
    [0.92, 4_125],
    [1, g.firstClose.price],
  ];
  const seg1 = interpolate(f, [a, a + 80], [0, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const seg2 = interpolate(f, [c, c + 60], [0.6, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const t = f >= c ? seg2 : seg1;
  const pts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const [tx, p] = path[i];
    if (tx <= t) pts.push(`${gx(tx)},${gy(p)}`);
    else {
      const [px, pp] = path[i - 1];
      const k = (t - px) / (tx - px);
      if (k > 0) pts.push(`${gx(px + (tx - px) * k)},${gy(pp + (p - pp) * k)}`);
      break;
    }
  }
  const Lbl: React.FC<{ price: number; text: string; color: string; at: number; side: "left" | "right"; below?: boolean; dash?: boolean; w?: number }> = ({ price, text, color, at: when, side, below, dash, w = 3 }) => {
    const p = prog(f, when, 24);
    const y = gy(price);
    return (
      <>
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
          <line x1={GX.x} x2={GX.x + GX.w * p} y1={y} y2={y} stroke={color} strokeWidth={w} strokeDasharray={dash ? "10 8" : undefined} strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", top: below ? y + 6 : y - 36, left: side === "left" ? GX.x + 8 : undefined, right: side === "right" ? W - (GX.x + GX.w) + 8 : undefined, fontFamily: fonts.hand, fontWeight: 700, fontSize: 28, color, opacity: p, whiteSpace: "nowrap" }}>
          {text}
        </div>
      </>
    );
  };
  const Row: React.FC<{ l: string; v: number; at: number }> = ({ l, v, at: when }) => (
    <In at={when} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0 5px", borderBottom: `1px dashed ${colors.faint}` }}>
      <span style={{ fontFamily: fonts.body, fontSize: 23, color: colors.ink2 }}>{l}</span>
      <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 32, color: v >= 0 ? colors.green : colors.red, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", marginLeft: 16 }}>{signed(v)}</span>
    </In>
  );
  return (
    <AbsoluteFill>
      <Paper grid="graph" />
      <Title text="Gold: patience, then averaging." size={62} width={1000} accent="averaging" />
      {/* graph */}
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        <line x1={GX.x} x2={GX.x + GX.w} y1={GX.y + GX.h} y2={GX.y + GX.h} stroke={colors.ink} strokeWidth={2} opacity={0.4} />
        <text x={GX.x} y={GX.y + GX.h + 36} fontFamily={fonts.mono} fontSize={17} fill={colors.pencil}>23.09</text>
        <text x={gx(0.6)} y={GX.y + GX.h + 36} textAnchor="middle" fontFamily={fonts.mono} fontSize={17} fill={colors.pencil}>09.11</text>
        <text x={GX.x + GX.w} y={GX.y + GX.h + 36} textAnchor="end" fontFamily={fonts.mono} fontSize={17} fill={colors.pencil}>10.11</text>
        <polyline points={pts.join(" ")} fill="none" stroke={colors.ink} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
        {f >= a && <circle cx={gx(0)} cy={gy(g.first.open)} r={9} fill={colors.blue} />}
        {f >= b && <circle cx={gx(0.6)} cy={gy(g.add.open)} r={9} fill={colors.blue} />}
        {f >= c + 50 && <circle cx={gx(0.84)} cy={gy(g.add.close)} r={9} fill={colors.green} />}
        {f >= c + 60 && <circle cx={gx(1)} cy={gy(g.firstClose.price)} r={9} fill={colors.green} />}
      </svg>
      <Lbl price={g.first.open} text={`① bought ${g.first.lots} lots · ${num(g.first.open)}`} color={colors.blue} at={a} side="left" />
      <Lbl price={g.add.open} text={`② bought ${g.add.lots} lots · ${num(g.add.open)}`} color={colors.blue} at={b} side="left" below />
      <Lbl price={goldAvgEntry} text={`average entry · ${num(goldAvgEntry)}`} color={colors.gold} at={b + 30} side="right" below dash />
      <Lbl price={g.add.close} text={`③ both positions closed · ${num(g.add.close)} / ${num(g.firstClose.price)}`} color={colors.green} at={c + 50} side="right" />
      <Hand x={gx(0.67)} y={gy(4_300)} at={a + 40} size={30} color={colors.pencil} rotate={0} width={260}>
        gold moved lower · position kept open, waiting for the market to come back
      </Hand>
      <Arrow from={[gx(0.6) - 10, gy(g.first.open) + 30]} to={[gx(0.6) - 10, gy(g.add.open) - 16]} at={b + 6} bend={-50} color={colors.red} />
      {/* card */}
      <Card x={M} y={300} w={820} at={a - 6} rotate={-0.6} style={{ padding: "18px 26px" }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 17, letterSpacing: 3, color: colors.pencil }}>GOLD · XAUUSD · 23.09 → 10.11.2026</div>
        <In at={a + 10} style={{ marginTop: 12, fontFamily: fonts.body, fontSize: 23, color: colors.ink2, lineHeight: 1.45 }}>
          ① <b>{g.first.lots} lots</b> bought at <b>{num(g.first.open)}</b> · kept open while gold moved lower
        </In>
        <In at={b + 6} style={{ marginTop: 4, fontFamily: fonts.body, fontSize: 23, color: colors.ink2, lineHeight: 1.45 }}>
          ② 09.11: <b>{g.add.lots} lots</b> bought at <b>{num(g.add.open)}</b> · {(g.add.lots / g.first.lots).toFixed(0)}× the size, {num(g.first.open - g.add.open)} lower
        </In>
        <In at={b + 30} style={{ marginTop: 10, padding: "8px 14px", borderRadius: 6, background: `${colors.gold}22`, border: `1px solid ${colors.gold}66`, fontFamily: fonts.body, fontSize: 22, color: colors.ink2, whiteSpace: "nowrap" }}>
          {num(g.first.lots + g.add.lots, 2)} lots · average entry <b style={{ color: colors.ink }}>{num(goldAvgEntry)}</b> instead of {num(g.first.open)}
        </In>
        <In at={c + 50} style={{ marginTop: 12, fontFamily: fonts.mono, fontSize: 16, letterSpacing: 3, color: colors.pencil }}>③ BOTH POSITIONS CLOSED</In>
        <Row l={`${g.add.lots} lots · ${num(g.add.open)} → ${num(g.add.close)}`} v={g.add.pl} at={c + 58} />
        <Row l={`${g.first.lots} lots · ${num(g.first.open)} → ${num(g.firstClose.price)}, incl. swap`} v={goldFirstTotal} at={c + 90} />
        <Row l={`1-lot add · ${num(g.extra.open)} → ${num(g.extra.close)}`} v={g.extra.pl} at={c + 120} />
        <In at={net} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 12 }}>
          <span style={{ fontFamily: fonts.serif, fontWeight: 700, fontSize: 28, color: colors.ink }}>Net on gold · still a profit</span>
          <Circled at={net + 36} color={colors.green} padX={18} padY={8}>
            <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 42, color: colors.green, fontVariantNumeric: "tabular-nums" }}>
              <Counter to={goldNet} start={net} dur={36} format={(n) => signed(n, 2)} />
            </span>
          </Circled>
        </In>
      </Card>
    </AbsoluteFill>
  );
};

// 9 ─ The 1% day
const SOnePct: React.FC = () => {
  const a = at("onepct", 0, 0.5);
  const b = at("onepct", 1, 0.3);
  const c = at("onepct", 2, 0.6);
  const rowAt = [b, b + 36, b + 70, b + 100, b + 128];
  return (
    <AbsoluteFill>
      <Paper />
      <Title text="Then the 1% rule, across the board." size={62} width={1200} accent="1% rule" />
      <Card x={M} y={300} w={1700} at={b - 12} rotate={0} style={{ padding: "18px 26px 10px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "250px 170px 300px 180px 1fr 150px", gap: 16, fontFamily: fonts.mono, fontSize: 16, letterSpacing: 3, color: colors.pencil, textTransform: "uppercase", padding: "0 0 10px", borderBottom: `1.5px solid ${colors.ink}55` }}>
          <span>Market</span>
          <span>Type · lots</span>
          <span>Open → close</span>
          <span>Time</span>
          <span style={{ textAlign: "right" }}>Profit</span>
          <span style={{ textAlign: "right" }}>% of balance</span>
        </div>
        {D.lastDay.map((t, i) => (
          <In key={t.sym + t.lots} at={rowAt[i]} style={{ display: "grid", gridTemplateColumns: "250px 170px 300px 180px 1fr 150px", gap: 16, alignItems: "baseline", padding: "8px 0", borderBottom: `1px dashed ${colors.faint}` }}>
            <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 26, color: colors.ink, whiteSpace: "nowrap" }}>
              {t.name}
              <span style={{ fontFamily: fonts.mono, fontSize: 15, color: colors.pencil, marginLeft: 10 }}>{t.sym}</span>
            </span>
            <span style={{ fontFamily: fonts.body, fontSize: 22, color: colors.blue }}>
              {t.side.toUpperCase()} {t.lots}
            </span>
            <span style={{ fontFamily: fonts.body, fontSize: 21, color: colors.ink2, fontVariantNumeric: "tabular-nums" }}>
              {num(t.open, t.open < 1000 ? 3 : 2)} → {num(t.close, t.close < 1000 ? 3 : 2)}
            </span>
            <span style={{ fontFamily: fonts.mono, fontSize: 15, color: colors.pencil }}>{t.t}</span>
            <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 30, color: colors.green, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{signed(t.pl, 2)}</span>
            <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 24, color: colors.ink, textAlign: "right" }}>+{pct(t.pl)}</span>
          </In>
        ))}
        <In at={c} style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 16, alignItems: "baseline", padding: "14px 0 8px" }}>
          <span style={{ fontFamily: fonts.serif, fontWeight: 700, fontSize: 30, color: colors.ink }}>
            Five trades · five winners · about 24 hours
            <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 40, color: colors.green, marginLeft: 30 }}>
              <Counter to={lastDayTotal} start={c} dur={40} format={(n) => signed(n, 2)} />
            </span>
          </span>
          <span style={{ textAlign: "right" }}><Circled at={c + 40} padX={16} padY={10}><span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 34, color: colors.ink }}>+{pct(lastDayTotal)}</span></Circled></span>
        </In>
      </Card>
      <Note x={1290} y={128} w={500} at={a + 20} rotate={-1.5} tint={colors.sky} size={24}>
        The rule: size every trade so that about <b>1% of the account</b> is at risk. Balance at the start of the day: {usd(D.balanceBeforeLastDay, 2)}.
      </Note>
      <Hand x={1000} y={800} at={c + 50} size={36} color={colors.red} rotate={-2} width={700} align="right">
        eleven percent in a day, one percent at risk per trade
      </Hand>
    </AbsoluteFill>
  );
};

// 10 ─ The record
const SRecord: React.FC = () => {
  const a = at("record", 0, 0.3);
  const b = at("record", 1, 0.3);
  const R = D.results;
  const cells = [
    { l: "Closed trades", v: String(R.trades), at: a },
    { l: "Winning trades", v: `${R.wins} · ${((R.wins / R.trades) * 100).toFixed(0)}%`, c: colors.green, at: a + 8 },
    { l: "Losing trades", v: `${R.losses} · gold, averaged`, c: colors.red, at: a + 16 },
    { l: "Profit factor", v: R.pf.toFixed(2), at: b },
    { l: "Max. drawdown", v: `${R.ddPct.toFixed(1)}%`, at: b + 8 },
    { l: "Average winning trade", v: usd(R.avgWin, 2), at: b + 16 },
  ];
  const maxN = Math.max(...D.bySymbol.map((s) => s.n));
  return (
    <AbsoluteFill>
      <Paper />
      <Title text="The record, as the platform reports it." size={60} width={1200} />
      <Card x={M} y={300} w={1000} at={a - 6} rotate={-0.6}>
        <div style={{ fontFamily: fonts.mono, fontSize: 17, letterSpacing: 3, color: colors.pencil }}>RESULTS · TRADE HISTORY REPORT · 10.11.2026 07:38</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "22px 30px", marginTop: 16 }}>
          {cells.map((c) => (
            <In key={c.l} at={c.at}>
              <Fig label={c.l} value={c.v} size={c.v.length > 8 ? 30 : 44} color={c.c ?? colors.ink} />
            </In>
          ))}
        </div>
        <In at={b + 30} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 22, paddingTop: 14, borderTop: `2px solid ${colors.ink}` }}>
          <span style={{ fontFamily: fonts.serif, fontWeight: 700, fontSize: 28, color: colors.ink }}>Net closed profit</span>
          <Circled at={b + 70} color={colors.green}>
            <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 48, color: colors.green, fontVariantNumeric: "tabular-nums" }}>
              <Counter to={R.net} start={b + 30} dur={40} format={(n) => usd(n, 2)} />
            </span>
          </Circled>
        </In>
        <In at={b + 44} style={{ fontFamily: fonts.body, fontSize: 18, color: colors.pencil, marginTop: 6 }}>
          gross profit {usd(R.gross, 2)} · gross loss {usd(R.grossLoss, 2)} · largest win {usd(R.largest)}
        </In>
      </Card>
      <Stamp text="19 / 20" x={880} y={290} at={a + 50} rotate={12} size={40} />
      <Card x={1190} y={300} w={600} at={b + 20} rotate={1.2}>
        <div style={{ fontFamily: fonts.mono, fontSize: 17, letterSpacing: 3, color: colors.pencil }}>CLOSED TRADES BY MARKET</div>
        {D.bySymbol.map((s, i) => (
          <In key={s.s} at={b + 28 + i * 12} style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fonts.body, fontSize: 22, color: colors.ink2 }}>
              <span>{s.s}</span>
              <span style={{ fontFamily: fonts.display, fontWeight: 800, color: colors.ink }}>{s.n}</span>
            </div>
            <div style={{ height: 16, background: colors.paper2, borderRadius: 4, marginTop: 6, overflow: "hidden" }}>
              <div style={{ width: `${(s.n / maxN) * 100}%`, height: "100%", background: [colors.blue, colors.gold, colors.green, colors.red][i] }} />
            </div>
          </In>
        ))}
      </Card>
    </AbsoluteFill>
  );
};

// 11 ─ Where we stand
const SStanding: React.FC = () => {
  const a = at("standing", 0, 0.8);
  const b = at("standing", 1, 0.3);
  const rows = [
    { l: `Deposits (${D.depositCount})`, v: D.deposits, c: colors.ink, at: a },
    { l: "Withdrawals (2)", v: -D.withdrawn, c: colors.red, at: a + 26 },
    { l: "Bonuses, cashback & credit", v: D.credits, c: colors.blue, at: a + 52, sub: `incl. credit ${usd(D.creditFacility)}` },
    { l: "Closed trading profit (20 trades)", v: D.results.net, c: colors.green, at: b },
  ];
  return (
    <AbsoluteFill>
      <Paper />
      <Title text="Where the account stands today." size={62} width={1100} />
      <Card x={M} y={300} w={1000} at={a - 10} rotate={-0.5}>
        <div style={{ fontFamily: fonts.mono, fontSize: 17, letterSpacing: 3, color: colors.pencil }}>ACCOUNT LEDGER · 04.09 – 10.11.2026</div>
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
        <In at={b + 30} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "14px 0 6px" }}>
          <span style={{ fontFamily: fonts.serif, fontWeight: 700, fontSize: 28, color: colors.ink }}>Balance</span>
          <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 38, color: colors.ink }}>{usd(D.balance, 2)}</span>
        </In>
        <In at={b + 44} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: `2px solid ${colors.ink}` }}>
          <span style={{ fontFamily: fonts.body, fontSize: 25, color: colors.ink2 }}>Open positions (floating)</span>
          <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 34, color: colors.ink2 }}>none · $0.00</span>
        </In>
        <In at={b + 60} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "14px 0 0" }}>
          <span style={{ fontFamily: fonts.serif, fontWeight: 700, fontSize: 32, color: colors.ink }}>Equity today</span>
          <Circled at={b + 100}>
            <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 52, color: colors.ink }}>
              <Counter to={D.equity} start={b + 60} dur={40} format={(n) => usd(n, 2)} />
            </span>
          </Circled>
        </In>
      </Card>
      <Note x={1200} y={330} w={320} at={a + 60} rotate={2.5} size={27}>
        Deposits add up to {usd(D.deposits, 2)}. Bonuses and cashback brought the balance to {usd(D.balance)}.
      </Note>
      <Note x={1230} y={600} w={320} at={b + 50} rotate={-2} tint={colors.sky} size={27}>
        Trading alone added <b>{usd(D.results.net, 2)}</b> in ten weeks.
      </Note>
      <Stamp text="No open risk" x={1250} y={790} at={b + 70} rotate={-8} size={30} color={colors.green} />
      <Arrow from={[1230, 560]} to={[1120, 520]} at={a + 80} bend={30} color={colors.pencil} width={2.5} />
    </AbsoluteFill>
  );
};

// 12 ─ Close
const SClose: React.FC = () => {
  const a = at("close", 0, 0.3);
  const b = tl.atEnd("close", 0, 0.6); // the disclaimer appears once the last line is spoken; it is not read aloud
  return (
    <AbsoluteFill>
      <Paper />
      <Title text="Chapter one: complete." size={92} top={250} width={1100} accent="complete" />
      <Hand x={M + 4} y={420} at={a + 10} size={42} color={colors.ink2} rotate={-1.5} width={1150}>
        $100 → a funded account · 20 trades, 19 in profit · {usd(D.results.net, 2)} realised · no open risk
      </Hand>
      <Stamp text="To be continued" x={1320} y={300} at={a + 40} rotate={-10} size={34} />
      <Arrow from={[1200, 470]} to={[1380, 440]} at={a + 30} bend={30} />
      <Card x={M} y={560} w={1700} at={b} rotate={0} tint="#FBF7EE" style={{ padding: "18px 26px" }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 16, letterSpacing: 3, color: colors.pencil, marginBottom: 8 }}>RISK DISCLAIMER</div>
        <div style={{ fontFamily: fonts.body, fontSize: 19, lineHeight: 1.45, color: colors.ink2 }}>
          Trading CFDs and FX Contracts is highly speculative and involves significant risk of your capital. You should not risk more than you can afford. Before taking any market action, you need to be properly aware of the risk. Past performance is not a guarantee of future performance. The information above is intended to be general and is not to be considered investment advice. This information should not be understood as an offer. Should you proceed using the information above for opening market positions, it is considered you did so at your own risk.
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: 17, color: colors.pencil, marginTop: 8 }}>Figures are taken from the platform's Trade History Report dated 10.11.2026 07:38. Bonuses and credit are subject to the account's terms. Averaging increases position size and risk; it is not suitable in every situation.</div>
      </Card>
    </AbsoluteFill>
  );
};

export const scenes: Record<string, React.FC> = { cover: SCover, start: SStart, trust: STrust, scale: SScale, run: SRun, out: SOut, average: SAverage, onepct: SOnePct, record: SRecord, standing: SStanding, close: SClose };
const abs = (scene: string, n: number, off = 0) => tl.at(scene, n, off) + tl.scenes.find((x) => x.id === scene)!.from;
export const impacts = [abs("scale", 1, 2.6), abs("run", 2, 0.8), abs("average", 2, 0.3), abs("average", 2, 6.0), abs("onepct", 2, 0.6), abs("record", 1, 1.3), abs("standing", 1, 2.0)];
