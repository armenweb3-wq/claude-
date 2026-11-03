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
  exchange: "Nasdaq",
  filed: "26 Oct 2026",
  revH1: 16.3, // $B, first half 2026 (S-1)
  revQ3: 16.8, // $B, reported to investors (FT / Bloomberg)
  lossH1: 80.7, // $B net loss, first half 2026 (S-1)
  runRate: 65, // $B, end of July 2026 (Reuters)
  customers: 11_900, // $100K+ customers, 30 Sep 2026 (S-1)
  raise: 100, // $B, reported target
  valuation: 2, // $T, reported "up to"
  spacex: 86, // $B, June 2026 record IPO (reported)
  roadshow: "Week of 9 Nov",
  trading: "Before 26 Nov",
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
          <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 56, color: colors.text, lineHeight: 1.15 }}>{FACTS.exchange}</div>
          <div style={{ fontFamily: fonts.body, fontSize: 24, color: colors.muted }}>S-1 filed {FACTS.filed}</div>
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
  const f = useCurrentFrame();
  const h1 = at("numbers", 0, 1.0);
  const q3 = at("numbers", 1, 1.2);
  const loss = at("numbers", 2, 1.4);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>The business · from the filing</Kicker>
        <Headline text="Big revenue. Bigger losses." accent={["Big", "revenue."]} delay={8} size={92} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 520, display: "flex", flexDirection: "column", gap: 18 }}>
        <Card delay={h1} glow>
          <Label color={colors.orangeBright}>Revenue · first half 2026</Label>
          <Big color={colors.orangeBright} size={96}>
            <Counter to={FACTS.revH1} start={h1} dur={34} format={usdB} />
          </Big>
          <div style={{ fontFamily: fonts.body, fontSize: 24, color: colors.muted }}>run-rate reported at ${FACTS.runRate}B by end of July</div>
        </Card>
        <div style={{ display: "flex", gap: 18 }}>
          <Card delay={q3} style={{ flex: 1 }}>
            <Label>Q3 2026 · reported</Label>
            <Big color={colors.text} size={64}>
              <Counter to={FACTS.revQ3} start={q3} dur={30} format={usdB} />
            </Big>
            <div style={{ fontFamily: fonts.body, fontSize: 22, color: colors.muted }}>in one quarter</div>
          </Card>
          <Card delay={q3 + 8} style={{ flex: 1 }}>
            <Label>Customers paying $100K+</Label>
            <Big color={colors.text} size={64}>
              <Counter to={FACTS.customers} start={q3 + 8} dur={30} format={(n) => Math.round(n).toLocaleString("en-US") + "+"} />
            </Big>
            <div style={{ fontFamily: fonts.body, fontSize: 22, color: colors.muted }}>as of 30 Sep 2026</div>
          </Card>
        </div>
        <Card delay={loss} style={{ border: `1px solid ${colors.red}66`, background: `${colors.red}12` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <Label color={colors.red}>Net loss · first half 2026</Label>
              <div style={{ fontFamily: fonts.body, fontSize: 24, color: colors.muted, marginTop: 6 }}>growth is expensive: chips, data centers, talent</div>
            </div>
            <Big color={colors.red} size={84}>
              −<Counter to={FACTS.lossH1} start={loss} dur={34} format={usdB} />
            </Big>
          </div>
        </Card>
      </div>
    </AbsoluteFill>
  );
};

// 4 ─ The deal
export const SDeal: React.FC = () => {
  const f = useCurrentFrame();
  const raise = at("deal", 0, 1.2);
  const val = at("deal", 0, 3.4);
  const record = at("deal", 1, 0.3);
  const time = at("deal", 1, 3.0);
  const barW = 936;
  const spx = (FACTS.spacex / FACTS.raise) * barW;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>The deal · as reported</Kicker>
        <Headline text="The largest IPO ever." accent={["largest"]} delay={8} size={100} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 500, display: "flex", gap: 18 }}>
        <Card delay={raise} glow style={{ flex: 1 }}>
          <Label color={colors.orangeBright}>Raise · about</Label>
          <Big color={colors.orangeBright} size={88}>
            $<Counter to={FACTS.raise} start={raise} dur={30} format={(n) => Math.round(n).toString()} />B
          </Big>
        </Card>
        <Card delay={val} style={{ flex: 1 }}>
          <Label>Valuation · up to</Label>
          <Big color={colors.text} size={88}>
            $<Counter to={FACTS.valuation} start={val} dur={30} format={(n) => n.toFixed(1)} />T
          </Big>
        </Card>
      </div>
      {/* record comparison */}
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 800, opacity: prog(f, record, 16) }}>
        <Label>Biggest IPOs · amount raised</Label>
        {[
          { n: "Anthropic (expected)", v: FACTS.raise, w: barW, c: colors.orange, t: record },
          { n: "SpaceX · June 2026", v: FACTS.spacex, w: spx, c: colors.charcoal2, t: record + 10 },
        ].map((b) => (
          <div key={b.n} style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fonts.body, fontSize: 26, color: colors.text, marginBottom: 8 }}>
              <span>{b.n}</span>
              <span style={{ fontFamily: fonts.display, fontWeight: 800 }}>${b.v}B</span>
            </div>
            <div style={{ height: 40, borderRadius: 10, width: b.w * prog(f, b.t, 36), background: b.c, border: `1px solid ${colors.line}` }} />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1110, display: "flex", gap: 18 }}>
        <Card delay={time} style={{ flex: 1 }}>
          <Label>Investor roadshow</Label>
          <Big size={44}>{FACTS.roadshow}</Big>
        </Card>
        <Card delay={time + 8} style={{ flex: 1 }} glow>
          <Label color={colors.orangeBright}>First trading day</Label>
          <Big size={44} color={colors.orangeBright}>{FACTS.trading}</Big>
        </Card>
      </div>
    </AbsoluteFill>
  );
};

// 5 ─ The share price: not set yet
export const SPrice: React.FC = () => {
  const f = useCurrentFrame();
  const notYet = at("price", 0, 0.6);
  const how = at("price", 1, 0.5);
  const blink = Math.floor(f / 18) % 2 === 0;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={24}>
        <Kicker delay={4}>The share price</Kicker>
        <Headline text="Not set yet." accent={["yet."]} delay={8} size={110} />
      </Column>
      <Card delay={notYet} glow style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 520, textAlign: "center", padding: "40px 28px" }}>
        <Label color={colors.orangeBright}>ANT · IPO price</Label>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 18 }}>
          <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 120, color: colors.dim, letterSpacing: -3, lineHeight: 1 }}>$</span>
          <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 150, color: colors.orange, letterSpacing: -4, lineHeight: 1, opacity: blink ? 1 : 0.55 }}>TBD</span>
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: 26, color: colors.muted, marginTop: 8 }}>price and share count left blank in the filing</div>
      </Card>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 900, display: "flex", flexDirection: "column", gap: 16 }}>
        {[
          { n: "1", t: "Bankers test demand on the roadshow", c: colors.text },
          { n: "2", t: "A price range is published in an amended filing", c: colors.text },
          { n: "3", t: "The final price is set the night before trading", c: colors.orangeBright },
        ].map((s, i) => (
          <Card key={s.n} delay={how + i * 12} style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 26px" }}>
            <div style={{ width: 52, height: 52, borderRadius: 26, background: colors.orange, color: colors.ink, fontFamily: fonts.display, fontWeight: 800, fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{s.n}</div>
            <div style={{ fontFamily: fonts.body, fontSize: 30, color: s.c }}>{s.t}</div>
          </Card>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1290, textAlign: "center", opacity: prog(f, how + 44, 16) }}>
        <Body size={27}>Early estimates vary widely. Only the official range counts.</Body>
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
          { t: "The official price range", s: "amended filing, before the roadshow ends" },
          { t: "The first day of trading", s: "the opening price can differ a lot from the IPO price" },
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
          Trading shares, CFDs and FX Contracts is highly speculative and involves significant risk of your capital. You should not risk more than you can afford. Past performance is not a guarantee of future performance. The information above is general and is not investment advice or an offer. Figures are as reported from Anthropic's S-1 and press reports in late October 2026; IPO terms may change.
        </div>
      </div>
    </AbsoluteFill>
  );
};
