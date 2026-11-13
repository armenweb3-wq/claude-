import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import vo from "../data/voiceover-ipo.json";
import { makeTimeline } from "../edu/timeline";
import { Backdrop, Body, clamp, Column, Counter, Headline, Kicker, prog } from "./primitives";
import { colors, fonts, SAFE } from "./theme";

/*
 * Anthropic IPO explainer. Every figure comes from the S-1 as reported by the press, or from
 * Bloomberg/Reuters-sourced reporting; see IPO-SOURCES in the README section. No price range has
 * been published, and the film says so rather than inventing one.
 */
export const tl = makeTimeline(vo);
const at = (scene: string, n: number, off = 0) => tl.at(scene, n, off);

const FACTS = {
  ticker: "ANT",
  exchange: "Nasdaq Global Select Market",
  filed: "26 Oct 2026",
  revH1: 16.3, // $B, first half 2026 (S-1)
  revQ3: 16.8, // $B, reported to investors (FT / Bloomberg)
  runRate: 65, // $B, end of July 2026 (Reuters)
  customers: 11_900, // $100K+ customers, 30 Sep 2026 (S-1)
  raise: 100, // $B, reported target
  valuation: 2, // $T, the "what if" scenario
  valLow: 1.3, // $T, expected valuation range (supplied 13 Nov 2026)
  valHigh: 1.45,
  priceLow: 70, // $ per share, expected IPO price range
  priceHigh: 78,
  pricingDate: "Wed 18 Nov 2026",
  firstDay: "Thu 19 Nov 2026",
  spacex: 75, // $B raised, June 2026 record IPO (most reports; ~$86B incl. over-allotment)
  spacexPrice: 135,
  spacexClose: 160.95,
  spacexDay1: 19,
  aramco: 29.4, // $B, 2019, the previous record
  amended: "2 Nov 2026",
  trading: "Thu 19 Nov",
  tradingNote: "first trading day",
  compute: 895, // $B of computing/data-center commitments per the amended filing (as reported)
  nvidiaStake: 10, // $B, reported possible anchor investment
  nvidiaShare: 42, // % of Anthropic's ~11 GW compute footprint (analyst estimate)
  chipsDay: 2.4, // % NVDA move on filing day (reported)
};

const usdB = (n: number) => `$${n.toFixed(1)}B`;

const Card: React.FC<{ children: React.ReactNode; delay: number; style?: React.CSSProperties; glow?: boolean }> = ({ children, delay, style, glow }) => {
  const f = useCurrentFrame();
  const p = prog(f, delay, 22);
  return (
    <div
      style={{
        padding: "24px 28px",
        borderRadius: 26,
        background: `linear-gradient(160deg, ${colors.charcoal2}, ${colors.charcoal})`,
        border: `1px solid ${glow ? colors.orange + "AA" : colors.line}`,
        boxShadow: glow ? `0 0 70px ${colors.orange}33` : "none",
        opacity: p,
        transform: `translateY(${(1 - p) * 24}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
const Label: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = colors.muted }) => (
  <div style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 3, color, textTransform: "uppercase" }}>{children}</div>
);
const Big: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({ children, color = colors.text, size = 72 }) => (
  <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: size, color, letterSpacing: -1.5, lineHeight: 1.1, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{children}</div>
);

/** Claude-style asterisk mark, drawn in orange. */
const Mark: React.FC<{ size: number; f: number }> = ({ size, f }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: `rotate(${f * 0.4}deg)` }}>
    {Array.from({ length: 8 }).map((_, i) => (
      <rect key={i} x={46} y={8} width={8} height={38} rx={4} fill={colors.orange} transform={`rotate(${i * 45} 50 50)`} />
    ))}
    <circle cx={50} cy={50} r={9} fill={colors.ink} stroke={colors.orange} strokeWidth={4} />
  </svg>
);

// 1 ─ Title
export const STitle: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tick = spring({ frame: f - at("title", 1), fps, config: { damping: 16, mass: 0.9 } });
  return (
    <AbsoluteFill>
      <Backdrop />
      <div style={{ position: "absolute", left: 0, right: 0, top: 440, display: "flex", justifyContent: "center", opacity: prog(f, 0, 20) }}>
        <Mark size={260} f={f} />
      </div>
      <Column top={760} gap={26}>
        <Kicker delay={4}>IPO explainer</Kicker>
        <Headline text="Anthropic goes public." accent={["public."]} delay={8} size={104} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1070, display: "flex", gap: 20, opacity: Math.min(1, tick * 1.4), transform: `scale(${0.9 + 0.1 * tick})` }}>
        <div style={{ flex: 1, padding: "22px 28px", borderRadius: 24, background: colors.orange, color: colors.ink }}>
          <div style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 3 }}>TICKER</div>
          <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 84, letterSpacing: -2, lineHeight: 1 }}>{FACTS.ticker}</div>
        </div>
        <div style={{ flex: 1.2, padding: "22px 28px", borderRadius: 24, background: colors.charcoal2, border: `1px solid ${colors.line}` }}>
          <div style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 3, color: colors.muted }}>EXCHANGE</div>
          <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 56, color: colors.text, lineHeight: 1.15 }}>Nasdaq</div>
          <div style={{ fontFamily: fonts.body, fontSize: 24, color: colors.muted }}>Global Select Market · first trading day {FACTS.firstDay}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 2 ─ What an IPO is: private → public
export const SIpo: React.FC = () => {
  const f = useCurrentFrame();
  const open = prog(f, at("ipo", 0, 1.2), 40);
  const trade = at("ipo", 1);
  const people = 24;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>What an IPO is</Kicker>
        <Headline text="Private company, public shares." accent={["public", "shares."]} delay={8} size={88} />
      </Column>
      <svg width={1080} height={900} style={{ position: "absolute", top: 520 }}>
        {/* the company */}
        <rect x={390} y={60} width={300} height={200} rx={28} fill={colors.charcoal2} stroke={colors.orange} strokeWidth={4} />
        <text x={540} y={150} textAnchor="middle" fontFamily={fonts.display} fontWeight={800} fontSize={40} fill={colors.text}>
          Anthropic
        </text>
        <text x={540} y={200} textAnchor="middle" fontFamily={fonts.mono} fontSize={22} fill={colors.muted}>
          {open < 0.5 ? "PRIVATE" : "PUBLIC"}
        </text>
        {/* shares fanning out to the public */}
        {Array.from({ length: people }).map((_, i) => {
          const a = (i / (people - 1)) * Math.PI; // left → right, in a half-circle below the company
          const tx = 540 + Math.cos(a) * -420;
          const ty = 300 + Math.sin(a) * 300;
          const p = interpolate(open, [i / people / 2, i / people / 2 + 0.5], [0, 1], clamp);
          const x = 540 + (tx - 540) * p;
          const y = 260 + (ty - 260) * p;
          return (
            <g key={i} opacity={p}>
              <line x1={540} y1={260} x2={x} y2={y} stroke={colors.orange} strokeOpacity={0.25} strokeWidth={2} />
              <rect x={x - 16} y={y - 22} width={32} height={44} rx={6} fill={colors.orange} transform={`rotate(${(i - people / 2) * 3} ${x} ${y})`} />
            </g>
          );
        })}
        <text x={540} y={700} textAnchor="middle" fontFamily={fonts.display} fontWeight={700} fontSize={36} fill={colors.text} opacity={prog(f, at("ipo", 0, 2.5), 16)}>
          shares sold to the public
        </text>
      </svg>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1300, display: "flex", justifyContent: "center", gap: 14, opacity: prog(f, trade, 16) }}>
        {["BUY", "SELL", "BUY"].map((t, i) => (
          <div key={i} style={{ padding: "12px 26px", borderRadius: 100, background: t === "BUY" ? colors.orange : colors.charcoal2, color: t === "BUY" ? colors.ink : colors.text, border: `1px solid ${colors.line}`, fontFamily: fonts.mono, fontWeight: 700, fontSize: 24, letterSpacing: 3 }}>
            {t}
          </div>
        ))}
        <div style={{ padding: "12px 26px", borderRadius: 100, fontFamily: fonts.body, fontSize: 26, color: colors.muted }}>on the Nasdaq, any trading day</div>
      </div>
    </AbsoluteFill>
  );
};

// 3 ─ The business
export const SNumbers: React.FC = () => {
  const h1 = at("numbers", 0, 1.0);
  const q3 = at("numbers", 1, 1.0);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>The business · from the filing</Kicker>
        <Headline text="Revenue is growing fast." accent={["fast."]} delay={8} size={92} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 520, display: "flex", flexDirection: "column", gap: 20 }}>
        <Card delay={h1} glow style={{ padding: "32px 34px" }}>
          <Label color={colors.orangeBright}>Revenue · first half 2026</Label>
          <Big color={colors.orangeBright} size={120}>
            <Counter to={FACTS.revH1} start={h1} dur={34} format={usdB} />
          </Big>
          <div style={{ fontFamily: fonts.body, fontSize: 26, color: colors.muted, marginTop: 6 }}>run-rate reported at ${FACTS.runRate}B by the end of July</div>
        </Card>
        <Card delay={q3} style={{ padding: "32px 34px" }}>
          <Label>Q3 2026 · reported to investors</Label>
          <Big color={colors.text} size={100}>
            <Counter to={FACTS.revQ3} start={q3} dur={30} format={usdB} />
          </Big>
          <div style={{ fontFamily: fonts.body, fontSize: 26, color: colors.muted, marginTop: 6 }}>in a single quarter</div>
        </Card>
        <Card delay={q3 + 12} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Label>Customers paying $100K+ a year</Label>
            <div style={{ fontFamily: fonts.body, fontSize: 24, color: colors.muted, marginTop: 4 }}>as of 30 September 2026</div>
          </div>
          <Big color={colors.text} size={72}>
            <Counter to={FACTS.customers} start={q3 + 12} dur={30} format={(n) => Math.round(n).toLocaleString("en-US") + "+"} />
          </Big>
        </Card>
      </div>
    </AbsoluteFill>
  );
};

// 4 ─ The deal: the biggest IPO ever, versus SpaceX
export const SDeal: React.FC = () => {
  const f = useCurrentFrame();
  const raise = at("deal", 0, 1.0);
  const val = at("deal", 0, 3.2);
  const record = at("deal", 1, 0.2);
  const spx = at("deal", 2, 0.3);
  const spxDay = at("deal", 2, 2.6);
  const time = at("deal", 3, 0.8);
  const barW = 936;
  const bars = [
    { n: "Anthropic · expected", v: FACTS.raise, c: colors.orange, t: record, label: "~$100B" },
    { n: "SpaceX · June 2026", v: FACTS.spacex, c: "#5a3b2e", t: spx, label: "~$75B" },
    { n: "Saudi Aramco · 2019", v: FACTS.aramco, c: colors.charcoal2, t: spx + 8, label: "$29B" },
  ];
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>The deal · as reported</Kicker>
        <Headline text="The largest IPO ever." accent={["largest"]} delay={8} size={100} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 480, display: "flex", gap: 18 }}>
        <Card delay={raise} glow style={{ flex: 1 }}>
          <Label color={colors.orangeBright}>Raise · about</Label>
          <Big color={colors.orangeBright} size={84}>
            $<Counter to={FACTS.raise} start={raise} dur={30} format={(n) => Math.round(n).toString()} />B
          </Big>
        </Card>
        <Card delay={val} style={{ flex: 1 }}>
          <Label>Valuation · expected</Label>
          <Big color={colors.text} size={66}>
            $<Counter to={FACTS.valLow} start={val} dur={30} format={(n) => n.toFixed(1)} />–{FACTS.valHigh}T
          </Big>
        </Card>
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 730, opacity: prog(f, record, 16) }}>
        <Label>Biggest IPOs in history · amount raised</Label>
        {bars.map((b) => (
          <div key={b.n} style={{ marginTop: 14, opacity: prog(f, b.t, 12) }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fonts.body, fontSize: 25, color: colors.text, marginBottom: 6 }}>
              <span>{b.n}</span>
              <span style={{ fontFamily: fonts.display, fontWeight: 800, color: b.c === colors.orange ? colors.orangeBright : colors.text }}>{b.label}</span>
            </div>
            <div style={{ height: 34, borderRadius: 9, width: (b.v / FACTS.raise) * barW * prog(f, b.t, 36), background: b.c, border: `1px solid ${colors.line}` }} />
          </div>
        ))}
      </div>
      <Card delay={spxDay} style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1065, display: "flex", alignItems: "center", gap: 22, padding: "18px 26px" }}>
        <div style={{ flex: 1 }}>
          <Label>SpaceX · SPCX · day one, 12 June 2026</Label>
          <div style={{ fontFamily: fonts.body, fontSize: 26, color: colors.text, marginTop: 6 }}>
            priced <b>${FACTS.spacexPrice}</b> → closed <b>${FACTS.spacexClose}</b>
          </div>
        </div>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 64, color: colors.orangeBright, whiteSpace: "nowrap" }}>▲ {FACTS.spacexDay1}%</div>
      </Card>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1230, display: "flex", gap: 18 }}>
        <Card delay={time} style={{ flex: 1, padding: "16px 24px" }}>
          <Label>IPO pricing date</Label>
          <Big size={40}>{FACTS.pricingDate}</Big>
        </Card>
        <Card delay={time + 10} style={{ flex: 1.1, padding: "16px 24px" }} glow>
          <Label color={colors.orangeBright}>First trading day</Label>
          <Big size={40} color={colors.orangeBright}>{FACTS.firstDay}</Big>
          <div style={{ fontFamily: fonts.mono, fontSize: 18, letterSpacing: 2, color: colors.muted, marginTop: 4 }}>{FACTS.exchange.toUpperCase()}</div>
        </Card>
      </div>
    </AbsoluteFill>
  );
};

// 4b ─ What it means for NVIDIA
const NV = "#76B900";
export const SNvidia: React.FC = () => {
  const f = useCurrentFrame();
  const commit = at("nvidia", 0, 1.6);
  const supplier = at("nvidia", 0, 4.6);
  const rally = at("nvidia", 1, 0.3);
  const stake = at("nvidia", 1, 2.8);
  const others = at("nvidia", 2, 0.4);
  const signal = at("nvidia", 2, 3.2);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4} color={NV}>What it means for NVIDIA</Kicker>
        <Headline text="A $900B order book for chips." accent={["$900B"]} delay={8} size={84} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 500, display: "flex", flexDirection: "column", gap: 16 }}>
        <Card delay={commit} glow style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Label color={colors.orangeBright}>Computing commitments</Label>
            <div style={{ fontFamily: fonts.body, fontSize: 24, color: colors.muted, marginTop: 4 }}>amended filing · mostly chips and data centers</div>
          </div>
          <Big color={colors.orangeBright} size={84}>
            ~$<Counter to={FACTS.compute} start={commit} dur={34} format={(n) => Math.round(n).toString()} />B
          </Big>
        </Card>
        <Card delay={supplier} style={{ border: `1px solid ${NV}88`, boxShadow: `0 0 50px ${NV}22` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <Label color={NV}>NVIDIA · largest chip supplier</Label>
              <div style={{ fontFamily: fonts.body, fontSize: 24, color: colors.muted, marginTop: 4 }}>share of Anthropic's ~11 GW compute footprint · analyst estimate</div>
            </div>
            <Big color={NV} size={84}>
              ~<Counter to={FACTS.nvidiaShare} start={supplier} dur={30} format={(n) => Math.round(n).toString()} />%
            </Big>
          </div>
          <div style={{ height: 22, borderRadius: 11, background: colors.charcoal2, marginTop: 14, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${FACTS.nvidiaShare * prog(f, supplier, 30)}%`, background: NV }} />
          </div>
        </Card>
        <div style={{ display: "flex", gap: 16 }}>
          <Card delay={rally} style={{ flex: 1 }}>
            <Label>NVDA on filing day</Label>
            <Big color={NV} size={60}>▲ {FACTS.chipsDay}%</Big>
            <div style={{ fontFamily: fonts.body, fontSize: 22, color: colors.muted }}>chip stocks rallied · reported</div>
          </Card>
          <Card delay={stake} style={{ flex: 1 }}>
            <Label>Possible NVIDIA stake</Label>
            <Big color={colors.text} size={60}>~${FACTS.nvidiaStake}B</Big>
            <div style={{ fontFamily: fonts.body, fontSize: 22, color: colors.muted }}>anchor investor · reported</div>
          </Card>
        </div>
        <Card delay={others} style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ flex: 1 }}>
            <Label>But not the only supplier</Label>
            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              {["Google TPUs", "Amazon Trainium", "AMD"].map((n) => (
                <span key={n} style={{ padding: "8px 16px", borderRadius: 100, border: `1px solid ${colors.line}`, fontFamily: fonts.mono, fontSize: 20, color: colors.text }}>{n}</span>
              ))}
            </div>
          </div>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 30, color: colors.orangeBright, textAlign: "right", opacity: prog(f, signal, 14), maxWidth: 300 }}>A demand signal, not a guarantee.</div>
        </Card>
      </div>
    </AbsoluteFill>
  );
};

// 5 ─ The share price: not set yet
export const SHARES = (FACTS.valHigh * 1e12) / FACTS.priceHigh / 1e9; // ≈ 18.6 billion shares implied by the range
const priceFor = (valT: number) => (valT * 1e12) / (SHARES * 1e9);

export const SPrice: React.FC = () => {
  const f = useCurrentFrame();
  const a = at("price", 0, 0.5);
  const b = at("price", 1, 0.3);
  const c = at("price", 1, 3.2);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>The share price · expected range</Kicker>
        <Headline text={`$${FACTS.priceLow} to $${FACTS.priceHigh} a share.`} accent={[`$${FACTS.priceLow}`, `$${FACTS.priceHigh}`]} delay={8} size={100} />
      </Column>
      <Card delay={a} glow style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 500, textAlign: "center", padding: "34px 28px" }}>
        <Label color={colors.orangeBright}>ANT · expected IPO price</Label>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 22, marginTop: 6 }}>
          <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 140, color: colors.orange, letterSpacing: -4, lineHeight: 1 }}>
            $<Counter to={FACTS.priceLow} start={a} dur={26} format={(n) => Math.round(n).toString()} />
          </span>
          <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 70, color: colors.dim, lineHeight: 1 }}>–</span>
          <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 140, color: colors.orangeBright, letterSpacing: -4, lineHeight: 1 }}>
            $<Counter to={FACTS.priceHigh} start={a + 8} dur={26} format={(n) => Math.round(n).toString()} />
          </span>
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: 26, color: colors.muted, marginTop: 10 }}>priced {FACTS.pricingDate} · trades from {FACTS.firstDay}</div>
      </Card>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 900, display: "flex", gap: 18 }}>
        <Card delay={b} style={{ flex: 1 }}>
          <Label>Valuation at ${FACTS.priceHigh}</Label>
          <Big color={colors.text} size={70}>
            $<Counter to={FACTS.valHigh} start={b} dur={30} format={(n) => n.toFixed(2)} />T
          </Big>
          <div style={{ fontFamily: fonts.body, fontSize: 22, color: colors.muted, marginTop: 4 }}>${FACTS.valLow}T at ${FACTS.priceLow}</div>
        </Card>
        <Card delay={c} style={{ flex: 1 }}>
          <Label>Implied share count</Label>
          <Big color={colors.text} size={70}>
            ~<Counter to={SHARES} start={c} dur={30} format={(n) => n.toFixed(1)} />B
          </Big>
          <div style={{ fontFamily: fonts.body, fontSize: 22, color: colors.muted, marginTop: 4 }}>valuation ÷ price</div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1250, textAlign: "center", opacity: prog(f, c + 20, 16) }}>
        <Body size={27}>Expected range as supplied; the final price is set the night before trading.</Body>
      </div>
    </AbsoluteFill>
  );
};

// 5b ─ What if: $2 trillion, and a higher open
export const SWhatIf: React.FC = () => {
  const f = useCurrentFrame();
  const q = at("whatif", 0, 0.4);
  const two = at("whatif", 1, 0.4);
  const open = at("whatif", 2, 0.6);
  const p2t = priceFor(FACTS.valuation); // ≈ 107.5
  const pOpen = FACTS.priceHigh * (1 + FACTS.spacexDay1 / 100); // ≈ 92.8
  const rows = [
    { t: `IPO price · top of range`, price: FACTS.priceHigh, val: FACTS.valHigh, c: colors.dim, at: q + 10, note: "the base case" },
    { t: `SpaceX-style open · +${FACTS.spacexDay1}%`, price: pOpen, val: (pOpen * SHARES) / 1000, c: colors.orange, at: open, note: "a higher open on day one" },
    { t: `$${FACTS.valuation} trillion valuation`, price: p2t, val: FACTS.valuation, c: colors.orangeBright, at: two, note: `+${Math.round((p2t / FACTS.priceHigh - 1) * 100)}% above $${FACTS.priceHigh}` },
  ];
  const maxP = p2t * 1.05;
  return (
    <AbsoluteFill>
      <Backdrop glow={1} />
      <Column top={210} gap={24}>
        <Kicker delay={4}>What if · scenarios, not forecasts</Kicker>
        <Headline text="What if it reaches $2 trillion?" accent={["$2", "trillion?"]} delay={8} size={92} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 520, display: "flex", flexDirection: "column", gap: 18 }}>
        {rows.map((r) => {
          const p = prog(f, r.at, 36);
          return (
            <Card key={r.t} delay={r.at} glow={r.c === colors.orangeBright} style={{ padding: "18px 26px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <Label color={r.c === colors.dim ? colors.muted : r.c}>{r.t}</Label>
                  <div style={{ fontFamily: fonts.body, fontSize: 22, color: colors.muted, marginTop: 2 }}>{r.note}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 66, color: r.c === colors.dim ? colors.text : r.c, letterSpacing: -2, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                    $<Counter to={r.price} start={r.at} dur={34} format={(n) => Math.round(n).toString()} />
                  </div>
                  <div style={{ fontFamily: fonts.body, fontSize: 24, color: colors.muted }}>≈ ${r.val.toFixed(2)}T valuation</div>
                </div>
              </div>
              <div style={{ height: 22, borderRadius: 7, background: "rgba(255,255,255,0.08)", marginTop: 14, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(r.price / maxP) * 100 * p}%`, background: r.c === colors.dim ? "#5a3b2e" : r.c, borderRadius: 7 }} />
              </div>
            </Card>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1210, textAlign: "center", opacity: prog(f, open + 40, 16) }}>
        <Body size={26}>Same share count (~{SHARES.toFixed(1)}B) in every case. A higher open is also where day-one buyers can overpay: the opening price is not the IPO price.</Body>
      </div>
    </AbsoluteFill>
  );
};

// 5c ─ Trade ANT on 1:10 leverage: the four tiers, both ways
const LEV = 10;
const TIERS = [25_000, 50_000, 100_000, 250_000];
const MOVES = [3, 15];
const usd0 = (n: number) => (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
export const SLeverage: React.FC = () => {
  const f = useCurrentFrame();
  const a = at("leverage", 0, 0.5);
  const b = at("leverage", 1, 0.3);
  const c = at("leverage", 2, 0.3);
  const d = at("leverage", 3, 0.3);
  const e = at("leverage", 4, 0.3);
  const rowAt = [c, d, d + 14, d + 28];
  const col = (w: number | string) => ({ flex: `0 0 ${typeof w === "number" ? w + "px" : w}` } as React.CSSProperties);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>Trade ANT with us · CFD on leverage</Kicker>
        <Headline text="Leverage 1 : 10." accent={["1", ":", "10."]} delay={8} size={104} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 470, display: "flex", gap: 16 }}>
        <Card delay={a} glow style={{ flex: 1.1, padding: "16px 22px" }}>
          <Label color={colors.orangeBright}>Exposure</Label>
          <Big color={colors.orangeBright} size={46}><span style={{ whiteSpace: "nowrap" }}>{LEV}× margin</span></Big>
        </Card>
        {MOVES.map((m, i) => (
          <Card key={m} delay={b + i * 14} style={{ flex: 1, padding: "16px 22px" }}>
            <Label>ANT +{m}%</Label>
            <Big color={colors.text} size={54}>+{m * LEV}%</Big>
          </Card>
        ))}
      </div>
      <Card delay={c - 8} style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 660, padding: "14px 22px 8px" }}>
        <div style={{ display: "flex", gap: 10, fontFamily: fonts.mono, fontSize: 17, letterSpacing: 2, color: colors.muted, textTransform: "uppercase", paddingBottom: 10, borderBottom: `1px solid ${colors.line}` }}>
          <span style={col(165)}>Margin</span>
          <span style={col(165)}>Exposure</span>
          <span style={{ ...col("1"), textAlign: "right", whiteSpace: "nowrap" }}>+3% · +30%</span>
          <span style={{ ...col(205), textAlign: "right", color: colors.orangeBright, whiteSpace: "nowrap" }}>+15% · +150%</span>
          <span style={{ ...col(165), textAlign: "right", color: colors.red, whiteSpace: "nowrap" }}>−3% · −30%</span>
        </div>
        {TIERS.map((t, i) => {
          const p = prog(f, rowAt[i], 18);
          return (
            <div key={t} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "13px 0", borderBottom: i < TIERS.length - 1 ? `1px dashed ${colors.line}` : undefined, opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
              <span style={{ ...col(165), fontFamily: fonts.display, fontWeight: 800, fontSize: 30, color: colors.text, whiteSpace: "nowrap" }}>{usd0(t)}</span>
              <span style={{ ...col(165), fontFamily: fonts.body, fontSize: 23, color: colors.muted, whiteSpace: "nowrap" }}>{usd0(t * LEV)}</span>
              <span style={{ ...col("1"), textAlign: "right", fontFamily: fonts.display, fontWeight: 700, fontSize: 28, color: colors.text, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>+{usd0(t * LEV * 0.03)}</span>
              <span style={{ ...col(205), textAlign: "right", fontFamily: fonts.display, fontWeight: 800, fontSize: 30, color: colors.orangeBright, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>+{usd0(t * LEV * 0.15)}</span>
              <span style={{ ...col(165), textAlign: "right", fontFamily: fonts.display, fontWeight: 700, fontSize: 27, color: colors.red, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", opacity: prog(f, e, 16) }}>{usd0(-t * LEV * 0.03)}</span>
            </div>
          );
        })}
      </Card>
      <Card delay={e} style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1120, padding: "18px 24px", display: "flex", alignItems: "center", gap: 20, border: `1px solid ${colors.red}66` }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 48, color: colors.red, whiteSpace: "nowrap" }}>−10%</div>
        <div style={{ fontFamily: fonts.body, fontSize: 25, color: colors.text, lineHeight: 1.35 }}>
          A 10% fall in ANT is −100% of the margin: the position can be closed out. Leverage multiplies losses exactly as it multiplies gains.
        </div>
      </Card>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1290, textAlign: "center", opacity: prog(f, e + 30, 16) }}>
        <Body size={25}>Illustrative CFD maths before spreads, commissions and overnight financing. Not a guaranteed return.</Body>
      </div>
    </AbsoluteFill>
  );
};

// 6 ─ What to watch + disclaimer
export const SWatch: React.FC = () => {
  const f = useCurrentFrame();
  const w = at("watch", 0, 0.4);
  const d = at("watch", 1);
  return (
    <AbsoluteFill>
      <Backdrop glow={0.8} />
      <Column top={210} gap={24}>
        <Kicker delay={4}>What to watch</Kicker>
        <Headline text="Three things to watch." accent={["Three"]} delay={8} size={96} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 520, display: "flex", flexDirection: "column", gap: 16 }}>
        {[
          { t: "The final price · 18 November", s: "set the night before trading, inside or above the range" },
          { t: "The opening trade · Thursday 19 November", s: "the opening price can differ a lot from the IPO price" },
          { t: "Demand from big investors", s: "oversubscribed books often lift the range" },
        ].map((it, i) => (
          <Card key={it.t} delay={w + i * 12} glow={i === 0}>
            <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 40, color: colors.text }}>{it.t}</div>
            <div style={{ fontFamily: fonts.body, fontSize: 24, color: colors.muted, marginTop: 4 }}>{it.s}</div>
          </Card>
        ))}
      </div>
      <div style={{ position: "absolute", left: SAFE.x + 10, right: SAFE.x + 10, top: 1120, padding: "22px 26px", borderRadius: 22, background: "rgba(0,0,0,0.5)", border: `1px solid ${colors.line}`, opacity: prog(f, d, 20) }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 20, letterSpacing: 3, color: colors.muted, marginBottom: 8 }}>RISK DISCLAIMER</div>
        <div style={{ fontFamily: fonts.body, fontSize: 21, lineHeight: 1.45, color: colors.muted }}>
          Trading shares, CFDs and FX Contracts is highly speculative and involves significant risk of your capital. You should not risk more than you can afford. Past performance is not a guarantee of future performance. The information above is general and is not investment advice or an offer. Figures are as reported from Anthropic's S-1, its amendments, press reports and the expected terms supplied on 13 November 2026 (price $70–$78, valuation $1.3–$1.45T, pricing 18 Nov, first trading day 19 Nov); the $2T and higher-open figures are scenarios, not forecasts; leveraged CFD returns are illustrative and losses can exceed the expected move. Terms and dates may change.
        </div>
      </div>
    </AbsoluteFill>
  );
};
