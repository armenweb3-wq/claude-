import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import vo from "../data/voiceover-edu1.json";
import { EduFilm, useScene } from "./EduFilm";
import { Card, Chart, E, EF, Formula, In, KeyPoint, Num, p, pathPrice, Points, Pop, Tile, TopicTitle, usd } from "./kit";
import { makeTimeline } from "./timeline";
import { CourseTitle, Recap } from "./shared";

const ACCENT = E.blue;
const tl = makeTimeline(vo);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* Worked-example numbers, kept in one place so every scene agrees. */
const DEPOSIT = 10_000;
const CLOSED_PROFIT = 500;
const BALANCE = DEPOSIT + CLOSED_PROFIT; // 10,500
const OPEN_PL = -300;
const EQUITY = BALANCE + OPEN_PL; // 10,200
const LOT = 100_000; // units per standard lot
const PRICE = 1.1;
const LEV = 100;
const TRADE_VALUE = LOT * PRICE; // 110,000
const MARGIN = TRADE_VALUE / LEV; // 1,100
const FREE = EQUITY - MARGIN; // 9,100

const Title: React.FC = () => {
  const { at } = useScene();
  return (
    <CourseTitle
      session={1}
      title="Account Basics & Costs"
      objective="Understand your account numbers, how capital is used, and what trading costs."
      topics={["Balance", "Profit & Loss", "Margin", "Free Margin", "Leverage", "Swaps"]}
      topicsAt={at(2)}
      accent={ACCENT}
    />
  );
};

const Balance: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const Row: React.FC<{ label: string; sub: string; amount: number; t: number; muted?: boolean }> = ({ label, sub, amount, t, muted }) => (
    <In at={t}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 26px",
          borderRadius: 18,
          background: muted ? "transparent" : "#F7F9FC",
          border: muted ? `2px dashed ${E.line}` : `1px solid ${E.line}`,
          opacity: muted ? 0.75 : 1,
        }}
      >
        <div>
          <div style={{ fontFamily: EF.display, fontWeight: 700, fontSize: 32, color: E.ink }}>{label}</div>
          <div style={{ fontFamily: EF.body, fontSize: 22, color: E.sub }}>{sub}</div>
        </div>
        <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 40, color: amount >= 0 ? E.green : E.red }}>{(amount >= 0 ? "+" : "") + usd(amount)}</div>
      </div>
    </In>
  );
  const bal = f < at(3) ? interpolate(f, [at(2), at(2) + 36], [0, DEPOSIT], clamp) : interpolate(f, [at(3), at(3) + 36], [DEPOSIT, BALANCE], clamp);
  return (
    <>
      <TopicTitle n={1} title="Balance" tag="The money in your account from closed trades." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Deposits ± closed trades − withdrawals", at: at(1) },
          { text: <>Example: deposit {usd(DEPOSIT)}, close a trade at +{usd(CLOSED_PROFIT)}</>, at: at(2) },
          { text: "Open trades don't change the balance until they close", at: at(4) },
        ]}
      />
      <Card>
        <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 18, height: "100%", boxSizing: "border-box" }}>
          <div style={{ fontFamily: EF.mono, fontSize: 22, letterSpacing: 3, color: E.sub }}>ACCOUNT HISTORY</div>
          <Row label="Deposit" sub="Funds added" amount={DEPOSIT} t={at(2)} />
          <Row label="Closed trade · EUR/USD" sub="Realized profit" amount={CLOSED_PROFIT} t={at(3)} />
          <Row label="Open trade · still running" sub="Not counted in the balance yet" amount={OPEN_PL} t={at(4)} muted />
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: `2px solid ${E.ink}`, paddingTop: 20 }}>
            <div style={{ fontFamily: EF.mono, fontSize: 26, letterSpacing: 3, color: E.ink }}>BALANCE</div>
            <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 72, color: ACCENT, fontVariantNumeric: "tabular-nums" }}>{usd(bal)}</div>
          </div>
        </div>
      </Card>
    </>
  );
};

const Equity: React.FC = () => {
  const { at } = useScene();
  return (
    <>
      <TopicTitle n={1} title="Balance vs. equity" tag="Equity is what your account is worth right now." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Equity = balance ± profit/loss of open trades", at: at(1) },
          { text: <>Open trade at {usd(OPEN_PL)} → equity {usd(EQUITY)}</>, at: at(2) },
          { text: "Deposited ≠ balance ≠ equity", at: at(3) },
        ]}
      />
      <Card>
        <div style={{ padding: 44, display: "flex", flexDirection: "column", justifyContent: "center", gap: 64, height: "100%", boxSizing: "border-box" }}>
          <Formula at={at(1)} parts={[{ t: "Equity" , c: ACCENT }, { t: "=" }, { t: "Balance", c: E.ink }, { t: "±" }, { t: "Open P&L", c: E.amber }]} />
          <In at={at(2)}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, fontFamily: EF.display, fontWeight: 800, fontSize: 58, whiteSpace: "nowrap" }}>
              <span style={{ color: E.ink }}>{usd(BALANCE)}</span>
              <span style={{ color: E.red }}>− {usd(-OPEN_PL)}</span>
              <span style={{ color: E.sub }}>=</span>
              <span style={{ color: ACCENT }}>{usd(EQUITY)}</span>
            </div>
          </In>
          <div style={{ display: "flex", gap: 18 }}>
            {[
              { l: "Deposited", v: DEPOSIT, c: E.sub },
              { l: "Balance", v: BALANCE, c: E.ink },
              { l: "Equity", v: EQUITY, c: ACCENT },
            ].map((t, i) => (
              <Pop key={t.l} at={at(3) + i * 14} style={{ flex: 1, display: "flex" }}>
                <Tile label={t.l} value={usd(t.v)} color={t.c} size={50} sub={["what you put in", "from closed trades", "worth right now"][i]} />
              </Pop>
            ))}
          </div>
        </div>
      </Card>
    </>
  );
};

const PnL: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const path = [
    { f: at(3), p: 1.1 },
    { f: at(4), p: 1.1012 },
    { f: at(4, 2.4), p: 1.105 },
  ];
  const price = pathPrice(path, f);
  const pl = Math.round((price - 1.1) * LOT);
  const closed = f >= at(5);
  return (
    <>
      <TopicTitle n={2} title="Profit & loss (P&L)" tag="Floating while open. Realized once closed." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: <><b style={{ color: E.amber }}>Floating</b> (unrealized): moves with every tick</>, at: at(1) },
          { text: <><b style={{ color: E.green }}>Realized</b> (closed): added to your balance</>, at: at(2) },
          { text: "EUR/USD: 1 pip ≈ $10 per standard lot", at: at(3) },
          { text: "Performance = realized + floating", at: at(6) },
        ]}
      />
      <Card dark>
        <Chart lo={1.0965} hi={1.1075} start={1.1} path={path} seed="pnl" trend={0.002} levels={[{ price: 1.1, label: "Buy 1 lot", color: E.blue, at: at(3), side: "left" }]} />
        <div
          style={{
            position: "absolute",
            left: 34,
            top: 30,
            padding: "16px 24px",
            borderRadius: 18,
            background: closed ? E.green : "#1F3150",
            border: `2px solid ${closed ? E.green : E.amber}`,
            opacity: p(f, at(3), 14),
          }}
        >
          <div style={{ fontFamily: EF.mono, fontSize: 20, letterSpacing: 2.5, color: closed ? "white" : E.amber }}>{closed ? "REALIZED · ADDED TO BALANCE" : "FLOATING P&L"}</div>
          <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 56, color: "white", fontVariantNumeric: "tabular-nums" }}>
            {(pl >= 0 ? "+" : "") + usd(pl)}
          </div>
          <div style={{ fontFamily: EF.body, fontSize: 22, color: closed ? "white" : "#8FA3BF" }}>{Math.round((price - 1.1) * 10000)} pips × $10</div>
        </div>
      </Card>
    </>
  );
};

const Margin: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const sizes = [0.5, 1, 2];
  return (
    <>
      <TopicTitle n={3} title="Margin" tag="A deposit set aside to keep a trade open." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Not a fee: released when the trade closes", at: at(2) },
          { text: "Needed because leverage controls more value than you put in", at: at(3) },
          { text: "Margin = trade value ÷ leverage", at: at(4) },
          { text: "Bigger trade → bigger margin", at: at(6) },
        ]}
      />
      <Card>
        <div style={{ padding: 44, display: "flex", flexDirection: "column", gap: 30, height: "100%", boxSizing: "border-box" }}>
          <Formula at={at(4)} size={38} parts={[{ t: "Trade value" , c: E.ink }, { t: "÷" }, { t: "Leverage", c: E.violet }, { t: "=" }, { t: "Margin", c: E.amber }]} />
          <In at={at(5)}>
            <div style={{ textAlign: "center", fontFamily: EF.body, fontSize: 26, color: E.sub, marginBottom: 8 }}>1 lot EUR/USD at {PRICE.toFixed(4)} · leverage 1:{LEV}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 20, fontFamily: EF.display, fontWeight: 800, fontSize: 54 }}>
              <span>{usd(TRADE_VALUE)}</span>
              <span style={{ color: E.sub }}>÷</span>
              <span style={{ color: E.violet }}>{LEV}</span>
              <span style={{ color: E.sub }}>=</span>
              <span style={{ color: E.amber }}>
                <Num to={MARGIN} at={at(5, 1.5)} fmt={(n) => usd(n)} />
              </span>
            </div>
          </In>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16, opacity: p(f, at(6), 14) }}>
            {sizes.map((s, i) => {
              const w = interpolate(f, [at(6) + i * 8, at(6) + i * 8 + 30], [0, (s / 2) * 520], clamp);
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 120, fontFamily: EF.mono, fontSize: 26, color: E.ink }}>{s} lot</div>
                  <div style={{ width: w, height: 40, borderRadius: 10, background: E.amber }} />
                  <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 32, color: E.ink }}>{usd(MARGIN * s)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </>
  );
};

const FreeMargin: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const LOSS = 2_000;
  const eq = interpolate(f, [at(3), at(3) + 60], [EQUITY, EQUITY - LOSS], clamp);
  const free = eq - MARGIN;
  const level = (eq / MARGIN) * 100;
  const meterMax = 1000;
  const mx = (v: number) => (Math.min(v, meterMax) / meterMax) * 760;
  return (
    <>
      <TopicTitle n={4} title="Free margin" tag="Your room to open trades and absorb losses." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Free margin = equity − used margin", at: at(1) },
          { text: "Losses on open trades reduce free margin", at: at(3) },
          { text: "Margin level = equity ÷ margin × 100%", at: at(4) },
          { text: "Margin call: warning. Stop out: auto-close", at: at(5) },
        ]}
      />
      <KeyPoint at={at(6)} accent={ACCENT}>
        Keep plenty of free margin: it gives your trades room to breathe.
      </KeyPoint>
      <Card dark>
        <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 22, height: "100%", boxSizing: "border-box" }}>
          <div style={{ fontFamily: EF.mono, fontSize: 22, letterSpacing: 3, color: "#8FA3BF" }}>TRADING PLATFORM · ACCOUNT</div>
          <div style={{ display: "flex", gap: 14 }}>
            <Tile dark label="Balance" value={usd(BALANCE)} color="white" size={38} />
            <Tile dark label="Equity" value={usd(eq)} color={E.teal} size={38} />
            <Tile dark label="Margin" value={usd(MARGIN)} color={E.amber} size={38} />
          </div>
          <In at={at(1)}>
            <div style={{ borderRadius: 22, padding: "22px 28px", background: "#132A1F", border: `2px solid ${E.green}` }}>
              <div style={{ fontFamily: EF.mono, fontSize: 22, letterSpacing: 3, color: E.green }}>FREE MARGIN = EQUITY − MARGIN</div>
              <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 70, color: "white", fontVariantNumeric: "tabular-nums" }}>{usd(free)}</div>
            </div>
          </In>
          <In at={at(4)}>
            <div style={{ fontFamily: EF.mono, fontSize: 22, letterSpacing: 3, color: "#8FA3BF", marginBottom: 10 }}>
              MARGIN LEVEL <span style={{ color: "white", fontWeight: 700 }}>{Math.round(level)}%</span>
            </div>
            <div style={{ position: "relative", height: 34, width: 760, borderRadius: 17, background: `linear-gradient(90deg, ${E.red}, ${E.amber} 15%, ${E.green} 35%)` }}>
              <div style={{ position: "absolute", left: mx(level) - 6, top: -10, width: 12, height: 54, borderRadius: 6, background: "white", boxShadow: "0 0 12px rgba(0,0,0,0.5)" }} />
            </div>
            <div style={{ position: "relative", height: 64, width: 760, opacity: p(f, at(5), 14) }}>
              {[
                { v: 50, l: "Stop out", c: E.red, row: 0 },
                { v: 100, l: "Margin call", c: E.amber, row: 1 },
              ].map((m) => (
                <div key={m.l} style={{ position: "absolute", left: mx(m.v) - 2, top: 2, borderLeft: `3px solid ${m.c}`, paddingLeft: 8, paddingTop: m.row * 28, fontFamily: EF.body, fontSize: 20, color: m.c, whiteSpace: "nowrap", height: 52, boxSizing: "border-box" }}>
                  {m.l} e.g. {m.v}%
                </div>
              ))}
            </div>
            <div style={{ fontFamily: EF.body, fontSize: 20, color: "#8FA3BF", opacity: p(f, at(5), 14) }}>Levels are examples. Each broker sets its own.</div>
          </In>
        </div>
      </Card>
    </>
  );
};

const Leverage: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const big = 470;
  const small = big / 10; // 1/100 of the area
  return (
    <>
      <TopicTitle n={5} title="Leverage" tag="Control a large position with less of your own money." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "1:100 → $1,000 controls $100,000", at: at(2) },
          { text: <><b style={{ color: E.green }}>Benefit:</b> less capital per trade</>, at: at(3) },
          { text: <><b style={{ color: E.red }}>Risk:</b> P&L is on the full position</>, at: at(4) },
          { text: "Leverage changes your exposure, not the market", at: at(6) },
        ]}
      />
      <KeyPoint at={at(7)} accent={E.violet}>
        Size each trade by the risk you accept, not by the maximum leverage.
      </KeyPoint>
      <Card>
        <svg width={880} height={690}>
          <g opacity={p(f, at(2), 14)}>
            <rect x={70} y={560 - small} width={small} height={small} fill={E.violet} rx={4} />
            <text x={70 + small / 2} y={600} textAnchor="middle" fontFamily={EF.display} fontWeight={800} fontSize={26} fill={E.violet}>
              $1,000
            </text>
            <text x={70 + small / 2} y={630} textAnchor="middle" fontFamily={EF.body} fontSize={20} fill={E.sub}>
              your margin
            </text>
            <path d={`M${80 + small} ${560 - small / 2} H 300`} stroke={E.faint} strokeWidth={3} strokeDasharray="6 8" />
            <text x={190} y={540 - small / 2} textAnchor="middle" fontFamily={EF.mono} fontSize={22} fill={E.sub}>
              × 100
            </text>
          </g>
          <g opacity={p(f, at(2, 1), 18)}>
            <rect x={340} y={560 - big} width={big} height={big} fill={`${E.violet}22`} stroke={E.violet} strokeWidth={4} rx={8} />
            <text x={340 + big / 2} y={560 - big / 2} textAnchor="middle" fontFamily={EF.display} fontWeight={800} fontSize={54} fill={E.violet}>
              $100,000
            </text>
            <text x={340 + big / 2} y={560 - big / 2 + 44} textAnchor="middle" fontFamily={EF.body} fontSize={26} fill={E.sub}>
              position you control
            </text>
            <text x={340 + big / 2} y={600} textAnchor="middle" fontFamily={EF.body} fontSize={20} fill={E.sub}>
              drawn to scale
            </text>
          </g>
          {/* 1% of the position = the whole margin */}
          <g opacity={p(f, at(5), 14)}>
            <rect x={340 + big - small - 6} y={560 - small - 6} width={small} height={small} fill={E.red} rx={4} />
            <path d={`M${340 + big - small / 2 - 6} ${560 - small - 10} C ${340 + big - 40} 40, 200 40, ${70 + small / 2} ${560 - small - 8}`} fill="none" stroke={E.red} strokeWidth={4} strokeDasharray="8 8" />
            <rect x={130} y={18} width={620} height={64} rx={14} fill={E.red} />
            <text x={440} y={60} textAnchor="middle" fontFamily={EF.display} fontWeight={800} fontSize={30} fill="white">
              1% move = $1,000 = all your margin
            </text>
          </g>
        </svg>
      </Card>
    </>
  );
};

const Swaps: React.FC = () => {
  const { at } = useScene();
  const f = useCurrentFrame();
  const nightly = -7;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <>
      <TopicTitle n={6} title="Swaps" tag="An overnight charge (or credit) for holding a position." accent={ACCENT} />
      <Points
        accent={ACCENT}
        items={[
          { text: "Charged at the daily rollover", at: at(1) },
          { text: "Interest-rate difference + fee", at: at(2) },
          { text: "Separate long and short rates", at: at(3) },
          { text: "Triple swap weekly (often Wed.)", at: at(6) },
        ]}
      />
      <KeyPoint at={at(7)} accent={ACCENT}>
        Long-held trades build up swap costs. Count them, with spread and commission.
      </KeyPoint>
      <Card>
        <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 26, height: "100%", boxSizing: "border-box" }}>
          <In at={at(3)}>
            <div style={{ display: "flex", gap: 14 }}>
              <Tile label="Swap long (example)" value="−7.0 pts" color={E.red} size={40} />
              <Tile label="Swap short (example)" value="+1.5 pts" color={E.green} size={40} />
            </div>
          </In>
          <Formula at={at(4)} size={32} parts={[{ t: "Lots", c: E.ink }, { t: "×" }, { t: "Swap points", c: E.violet }, { t: "×" }, { t: "Point value", c: E.teal }]} />
          <In at={at(5)}>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, fontFamily: EF.display, fontWeight: 800, fontSize: 46 }}>
              <span>1</span>
              <span style={{ color: E.sub }}>×</span>
              <span style={{ color: E.violet }}>(−7)</span>
              <span style={{ color: E.sub }}>×</span>
              <span style={{ color: E.teal }}>$1</span>
              <span style={{ color: E.sub }}>=</span>
              <span style={{ color: E.red }}>−$7 / night</span>
            </div>
          </In>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 12, opacity: p(f, at(6), 14) }}>
            {days.map((d, i) => {
              const triple = d === "Wed";
              return (
                <Pop key={d} at={at(6) + i * 8} style={{ flex: 1 }}>
                  <div style={{ borderRadius: 18, padding: "16px 0", textAlign: "center", background: triple ? `${E.red}14` : "#F7F9FC", border: `2px solid ${triple ? E.red : E.line}` }}>
                    <div style={{ fontFamily: EF.mono, fontSize: 22, color: E.sub }}>{d}</div>
                    <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 34, color: E.red }}>{usd(nightly * (triple ? 3 : 1))}</div>
                    {triple && <div style={{ fontFamily: EF.body, fontSize: 18, color: E.red }}>× 3 (weekend)</div>}
                  </div>
                </Pop>
              );
            })}
          </div>
          <div style={{ textAlign: "right", fontFamily: EF.display, fontWeight: 700, fontSize: 30, color: E.ink, opacity: p(f, at(6, 3), 14) }}>
            1 week ≈ <span style={{ color: E.red }}>{usd(nightly * 7)}</span>
          </div>
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
      title="Session 1 recap"
      items={[
        { t: "Balance = closed trades. Equity = value right now.", at: at(1) },
        { t: "Floating P&L becomes realized when you close.", at: at(2) },
        { t: "Margin is a deposit. Free margin is your room to trade.", at: at(3) },
        { t: "Leverage magnifies both gains and losses.", at: at(3, 2.5) },
        { t: "Swaps, spread and commission are your trading costs.", at: at(4) },
      ]}
      next={{ label: "Next · Session 2", text: "Orders & market types", at: at(5) }}
    />
  );
};

export const session1 = {
  tl,
  element: () => (
    <EduFilm
      tl={tl}
      session={1}
      name="Account basics & costs"
      accent={ACCENT}
      topics={{ balance: 1, equity: 1, pnl: 2, margin: 3, free: 4, leverage: 5, swaps: 6 }}
      scenes={{ title: Title, balance: Balance, equity: Equity, pnl: PnL, margin: Margin, free: FreeMargin, leverage: Leverage, swaps: Swaps, recap: RecapScene }}
    />
  ),
};

export const Session1: React.FC = () => <AbsoluteFill>{session1.element()}</AbsoluteFill>;
