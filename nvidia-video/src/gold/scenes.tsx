import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Chart, pathPrice } from "../edu/kit";
import { makeTimeline } from "../edu/timeline";
import vo from "../data/voiceover-gold-pitch.json";
import { Backdrop, Body, clamp, Column, Counter, Headline, Kicker, prog } from "./primitives";
import { colors, fonts, SAFE } from "./theme";

/*
 * "$2,500 on gold": a pitch built from one broker ticket (XAUUSD, 0.01 lot = 1 oz, ~$40.71 margin per ounce → 1:100).
 * Every number on screen is derived from the constants below.
 */
export const tl = makeTimeline(vo);
const at = (scene: string, n: number, off = 0) => tl.at(scene, n, off);
const atEnd = (scene: string, n: number, off = 0) => tl.atEnd(scene, n, off);

export const G = {
  open: 4020, // where gold started the day (example move)
  now: 4071.97, // ask on the ticket
  bid: 4070.32,
  move: 50,
  marginPerOz: 40.71, // from the ticket: 0.01 lot
  margin: 2500,
  maxLossPct: 10,
  small: 100,
};
const LEVERAGE = Math.round(G.now / G.marginPerOz); // 100
const OZ = Math.floor(G.margin / G.marginPerOz); // 61
const LOTS = OZ / 100; // 0.61
const USED = OZ * G.marginPerOz; // ≈ 2,483
const PROFIT = OZ * G.move; // 3,050
const MAX_LOSS = (G.margin * G.maxLossPct) / 100; // 250
const STOP_DIST = MAX_LOSS / OZ; // 4.10
const SMALL_OZ = Math.floor(G.small / G.marginPerOz); // 2
const SMALL_PROFIT = SMALL_OZ * G.move; // 100
export const derived = { LEVERAGE, OZ, LOTS, USED, PROFIT, MAX_LOSS, STOP_DIST, SMALL_OZ, SMALL_PROFIT };

const usd = (n: number, d = 0) => (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (n: number, d = 0) => (n > 0 ? "+" : "") + usd(n, d);

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; border?: string }> = ({ children, style, border = colors.line }) => (
  <div style={{ padding: "22px 26px", borderRadius: 26, background: `linear-gradient(160deg, ${colors.charcoal2}, ${colors.charcoal})`, border: `1px solid ${border}`, ...style }}>{children}</div>
);
const Label: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = colors.muted }) => (
  <div style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 3, color, textTransform: "uppercase" }}>{children}</div>
);
const Big: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({ children, color = colors.text, size = 72 }) => (
  <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: size, color, letterSpacing: -size * 0.02, lineHeight: 1.08, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{children}</div>
);

/** A small gold bar (ingot). */
const Bar: React.FC<{ w?: number; glow?: boolean }> = ({ w = 64, glow }) => (
  <svg width={w} height={w * 0.55} viewBox="0 0 64 35" style={{ filter: glow ? `drop-shadow(0 0 14px ${colors.gold}99)` : undefined }}>
    <defs>
      <linearGradient id="ingot" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFE9A6" />
        <stop offset="0.5" stopColor="#E2B23C" />
        <stop offset="1" stopColor="#9A7118" />
      </linearGradient>
    </defs>
    <path d="M12 4h40l10 27H2z" fill="url(#ingot)" stroke="#5c430c" strokeWidth={1} />
    <path d="M14 8h36l2 5H12z" fill="#FFF3C4" opacity={0.6} />
  </svg>
);

/** Grid of ingots that fills up to `count` over time. */
const Ingots: React.FC<{ count: number; start: number; per?: number; cols?: number; size?: number }> = ({ count, start, per = 1.2, cols = 11, size = 72 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${size}px)`, gap: 10, justifyContent: "center" }}>
      {Array.from({ length: count }).map((_, i) => {
        const p = prog(f, start + i * per, 10);
        return (
          <div key={i} style={{ opacity: p, transform: `scale(${0.6 + 0.4 * p})` }}>
            <Bar w={size} />
          </div>
        );
      })}
    </div>
  );
};

// 1 ─ Today: gold +$50
const SToday: React.FC = () => {
  const f = useCurrentFrame();
  const t0 = at("today", 0, 0.4);
  const hit = atEnd("today", 1, -0.6);
  const path = [
    { f: t0, p: G.open },
    { f: t0 + 40, p: G.open + 12 },
    { f: t0 + 70, p: G.open + 6 },
    { f: t0 + 110, p: G.open + 31 },
    { f: t0 + 140, p: G.open + 24 },
    { f: hit, p: G.open + G.move },
  ];
  const price = pathPrice(path, f);
  const up = price - G.open;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={22}>
        <Kicker delay={4}>Gold · XAUUSD</Kicker>
        <Headline text="Today gold rose $50." accent={["$50."]} delay={8} size={100} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, top: 560, width: 936, height: 640, borderRadius: 30, background: colors.charcoal, border: `1px solid ${colors.line}`, overflow: "hidden", opacity: prog(f, 10, 20) }}>
        <Chart
          lo={G.open - 15}
          hi={G.open + G.move + 34}
          start={G.open}
          path={path}
          seed="gold-day"
          trend={0.004}
          w={936}
          h={640}
          levels={[
            { price: G.open, label: `Open · ${usd(G.open)}`, color: "#A8987E", at: t0, side: "left", dash: true },
            { price: G.open + G.move, label: `Now · ${usd(G.open + G.move)}`, color: colors.greenBright, at: at("today", 1), side: "left" },
          ]}
          markers={[{ f: hit, label: `+$${G.move} an ounce`, color: colors.greenBright }]}
        />
        <div style={{ position: "absolute", left: 24, bottom: 18, padding: "12px 18px", borderRadius: 14, background: "rgba(9,8,10,0.92)", border: `1px solid ${colors.line}`, opacity: prog(f, t0, 10) }}>
          <Label>Today's move</Label>
          <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 44, color: colors.greenBright, fontVariantNumeric: "tabular-nums" }}>{signed(up, 2)} / oz</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1240, textAlign: "center", opacity: prog(f, at("today", 1, 1.2), 20) }}>
        <Body size={32}>One day. One move. What would it have been worth to you?</Body>
      </div>
    </AbsoluteFill>
  );
};

// 2 ─ One ounce = $50
const SOunce: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at("ounce", 0, 0.3), fps, config: { damping: 14, mass: 1.1 } });
  const q = prog(f, at("ounce", 1), 22);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={22}>
        <Kicker delay={4}>The simple maths</Kicker>
        <Headline text="One ounce. One $50 move." accent={["$50"]} delay={8} size={92} />
      </Column>
      <div style={{ position: "absolute", left: 0, right: 0, top: 540, display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${0.7 + 0.3 * s})`, opacity: Math.min(1, s * 1.3) }}>
        <Bar w={360} glow />
        <div style={{ fontFamily: fonts.mono, fontSize: 24, letterSpacing: 5, color: colors.muted, marginTop: 18 }}>1 OUNCE OF GOLD</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 870, display: "flex", gap: 18, alignItems: "stretch", opacity: prog(f, at("ounce", 0, 1.6), 20) }}>
        <Card style={{ flex: 1, textAlign: "center" }}>
          <Label>Gold moves</Label>
          <Big color={colors.greenBright}>+${G.move}</Big>
        </Card>
        <div style={{ display: "flex", alignItems: "center", fontFamily: fonts.display, fontWeight: 800, fontSize: 60, color: colors.muted }}>=</div>
        <Card style={{ flex: 1, textAlign: "center" }} border={`${colors.gold}88`}>
          <Label color={colors.gold}>You earn</Label>
          <Big color={colors.greenBright}>
            <Counter to={G.move} start={at("ounce", 0, 1.8)} dur={30} format={(n) => `+$${Math.round(n)}`} />
          </Big>
        </Card>
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1130, textAlign: "center", opacity: q, transform: `translateY(${(1 - q) * 20}px)` }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 56, color: colors.text, lineHeight: 1.1 }}>
          So… how many ounces
          <br />
          <span style={{ color: colors.gold }}>do you hold?</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 3 ─ $2,500 of margin → 61 oz (mirrors the broker ticket)
const SPosition: React.FC = () => {
  const f = useCurrentFrame();
  const a = prog(f, at("position", 0, 0.2), 22);
  const b = at("position", 1, 0.6);
  const bp = prog(f, b, 22);
  const vol = interpolate(prog(f, b, 36), [0, 1], [0.01, LOTS]);
  const Row: React.FC<{ k: string; v: React.ReactNode; hi?: boolean }> = ({ k, v, hi }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 22px", borderRadius: 14, background: hi ? `${colors.gold}1E` : "rgba(0,0,0,0.35)", border: `1px solid ${hi ? colors.gold + "88" : colors.line}` }}>
      <span style={{ fontFamily: fonts.body, fontSize: 28, color: colors.muted }}>{k}</span>
      <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 34, color: hi ? colors.greenBright : colors.text, fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </div>
  );
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={22}>
        <Kicker delay={4}>Your position</Kicker>
        <Headline text="$2,500 of margin on gold." accent={["$2,500"]} delay={8} size={88} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 520, borderRadius: 28, background: "#121212", border: `1px solid ${colors.line}`, overflow: "hidden", opacity: a, transform: `translateY(${(1 - a) * 30}px)` }}>
        <div style={{ padding: "18px 0", textAlign: "center", fontFamily: fonts.display, fontWeight: 700, fontSize: 30, color: colors.text, borderBottom: `1px solid ${colors.line}` }}>XAUUSD · New position</div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          <Row k="Volume (lots)" v={vol.toFixed(2)} hi={bp > 0.3} />
          <Row k="= ounces of gold" v={<Counter to={OZ} from={1} start={b} dur={36} format={(n) => `${Math.round(n)} oz`} />} hi={bp > 0.3} />
          <Row k="Margin per ounce" v={usd(G.marginPerOz, 2)} />
          <Row k="Margin used" v={<Counter to={USED} from={G.marginPerOz} start={b} dur={36} format={(n) => usd(n, 2)} />} hi={bp > 0.3} />
          <Row k="Price (bid / ask)" v={`${usd(G.bid, 2)} / ${usd(G.now, 2)}`} />
        </div>
        <div style={{ margin: "0 18px 18px", padding: "14px 0", borderRadius: 16, background: "#1D5BE8", color: "#fff", textAlign: "center", fontFamily: fonts.display, fontWeight: 700, fontSize: 30 }}>Buy By Market</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1110, opacity: prog(f, b, 16) }}>
        <Ingots count={OZ} start={b + 4} per={0.9} cols={13} size={60} />
        <div style={{ textAlign: "center", fontFamily: fonts.body, fontSize: 26, color: colors.muted, marginTop: 14 }}>
          0.01 lot = 1 oz · leverage 1 : {LEVERAGE} · {usd(G.margin)} ÷ {usd(G.marginPerOz, 2)} ≈ <span style={{ color: colors.greenBright, fontWeight: 700 }}>{OZ} ounces</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 4 ─ +$50 × 61 oz = +$3,050
const SProfit: React.FC = () => {
  const f = useCurrentFrame();
  const a = at("profit", 0, 0.3);
  const total = at("profit", 0, 2.2);
  const t = prog(f, total, 24);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={22}>
        <Kicker delay={4}>Today's move, your size</Kicker>
        <Headline text="What $2,500 would have made." delay={8} size={84} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 520, display: "flex", gap: 16, alignItems: "stretch" }}>
        {[
          { k: "Ounces", v: `${OZ}`, c: colors.gold, at: a },
          { k: "Gold up", v: `+$${G.move}`, c: colors.greenBright, at: a + 14 },
        ].map((x, i) => (
          <React.Fragment key={x.k}>
            {i > 0 && <div style={{ display: "flex", alignItems: "center", fontFamily: fonts.display, fontWeight: 800, fontSize: 56, color: colors.muted, opacity: prog(f, x.at, 12) }}>×</div>}
            <Card style={{ flex: 1, textAlign: "center", opacity: prog(f, x.at, 18) }}>
              <Label>{x.k}</Label>
              <Big color={x.c} size={76}>{x.v}</Big>
            </Card>
          </React.Fragment>
        ))}
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 760, padding: "34px 36px", borderRadius: 30, background: `linear-gradient(135deg, ${colors.greenBright}, ${colors.gold})`, color: colors.ink, opacity: t, transform: `scale(${0.96 + 0.04 * t})`, boxShadow: `0 0 80px ${colors.gold}55` }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 24, letterSpacing: 4 }}>POTENTIAL PROFIT · ONE DAY</div>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 132, letterSpacing: -4, lineHeight: 1, marginTop: 10 }}>
          <Counter to={PROFIT} start={total} dur={40} format={(n) => signed(Math.round(n))} />
        </div>
        <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 34, marginTop: 10 }}>+{Math.round((PROFIT / G.margin) * 100)}% on your {usd(G.margin)}</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1150, opacity: prog(f, at("profit", 1), 20) }}>
        <Ingots count={OZ} start={at("profit", 1)} per={0.4} cols={13} size={60} />
      </div>
    </AbsoluteFill>
  );
};

// 5 ─ The risk: 10% cap → $250 → stop $4.10 below entry
const SRisk: React.FC = () => {
  const f = useCurrentFrame();
  const cap = at("risk", 0, 1.4);
  const st = at("risk", 1, 0.8);
  const sp = prog(f, st, 30);
  const yEntry = 760;
  const yStop = interpolate(sp, [0, 1], [yEntry, 1010]);
  const yTP = 560;
  const Line: React.FC<{ y: number; color: string; label: string; value: string; p: number; dash?: boolean }> = ({ y, color, label, value, p, dash }) => (
    <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: y, opacity: p }}>
      <div style={{ height: 4, width: `${p * 100}%`, borderRadius: 2, boxShadow: `0 0 18px ${color}88`, ...(dash ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 18px, transparent 18px 30px)` } : { background: color }) }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 24, letterSpacing: 3, color, textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 44, color: colors.text, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
    </div>
  );
  return (
    <AbsoluteFill>
      <Backdrop hue={colors.red} />
      <Column top={210} gap={22}>
        <Kicker delay={4} color={colors.red}>The risk, capped</Kicker>
        <Headline text="Maximum loss: 10%." accent={["10%."]} delay={8} size={96} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: yTP, height: yEntry - yTP, background: `linear-gradient(180deg, ${colors.gold}22, transparent)`, borderRadius: 12, opacity: prog(f, cap, 20) }} />
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: yEntry, height: Math.max(0, yStop - yEntry), background: `linear-gradient(0deg, ${colors.red}33, transparent)`, borderRadius: 12, opacity: prog(f, st, 10) }} />
      <Line y={yTP} color={colors.greenBright} label={`Target · +$${G.move} / oz`} value={signed(PROFIT)} p={prog(f, cap, 24)} />
      <Line y={yEntry} color="#A8987E" label="Entry" value={usd(G.now, 2)} p={prog(f, cap - 10, 20)} dash />
      <Line y={yStop} color={colors.red} label={`Stop loss · −$${STOP_DIST.toFixed(2)} / oz`} value={usd(-MAX_LOSS)} p={prog(f, st, 24)} />
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1130, display: "flex", gap: 16 }}>
        <Card style={{ flex: 1, opacity: prog(f, cap, 20) }} border={`${colors.red}66`}>
          <Label color={colors.red}>Max loss</Label>
          <Big color={colors.red} size={62}>{usd(-MAX_LOSS)}</Big>
          <div style={{ fontFamily: fonts.body, fontSize: 22, color: colors.muted }}>{G.maxLossPct}% of {usd(G.margin)}</div>
        </Card>
        <Card style={{ flex: 1, opacity: prog(f, st, 20) }} border={`${colors.gold}66`}>
          <Label color={colors.gold}>Stop distance</Label>
          <Big color={colors.text} size={62}>${STOP_DIST.toFixed(2)}</Big>
          <div style={{ fontFamily: fonts.body, fontSize: 22, color: colors.muted }}>{usd(MAX_LOSS)} ÷ {OZ} oz, below entry</div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1330, textAlign: "center", fontFamily: fonts.body, fontSize: 26, color: colors.muted, opacity: prog(f, st, 30) }}>
        Reward {usd(PROFIT)} vs risk {usd(MAX_LOSS)} · about {Math.round(PROFIT / MAX_LOSS)} : 1
      </div>
    </AbsoluteFill>
  );
};

// 6 ─ What's next: analysts see another +$50
const SNext: React.FC = () => {
  const f = useCurrentFrame();
  const t0 = at("next", 0, 0.2);
  const t1 = at("next", 0, 3.0);
  const t2 = at("next", 1, 0.4);
  const base = G.open + G.move;
  const path = [
    { f: t0, p: G.open },
    { f: t0 + 50, p: base },
    { f: t1, p: base },
  ];
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={22}>
        <Kicker delay={4}>What's next</Kicker>
        <Headline text="Analysts expect another $50." accent={["$50."]} delay={8} size={84} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, top: 520, width: 936, height: 520, borderRadius: 30, background: colors.charcoal, border: `1px solid ${colors.line}`, overflow: "hidden", opacity: prog(f, 10, 20) }}>
        <Chart
          lo={G.open - 10}
          hi={base + G.move + 15}
          start={G.open}
          path={path}
          seed="gold-next"
          trend={0.003}
          w={936}
          h={520}
          levels={[
            { price: base, label: `Today · ${usd(base)}`, color: "#A8987E", at: t0 + 50, side: "left", dash: true },
            { price: base + G.move, label: `Analyst view · ${usd(base + G.move)}`, color: colors.greenBright, at: t1, side: "left" },
          ]}
          zones={[{ from: base, to: base + G.move, color: colors.gold, at: t1, label: "", side: "center" }]}
          ghost={{ path: [{ f: t1, p: base }, { f: t1 + 70, p: base + G.move }], at: t1, label: `+$${G.move} expected`, color: colors.greenBright }}
        />
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1066, display: "flex", alignItems: "center", gap: 16, padding: "14px 22px", borderRadius: 18, background: "rgba(0,0,0,0.4)", border: `1px solid ${colors.line}`, opacity: prog(f, t1, 16) }}>
        <div style={{ padding: "6px 14px", borderRadius: 8, background: colors.text, color: colors.ink, fontFamily: fonts.display, fontWeight: 800, fontSize: 22 }}>TipRanks</div>
        <div style={{ fontFamily: fonts.body, fontSize: 24, color: colors.muted }}>Top analysts: gold seen rising a further ${G.move} an ounce · analyst view, reported</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1170, display: "flex", gap: 16 }}>
        <Card style={{ flex: 1.3, opacity: prog(f, t2, 20) }} border={`${colors.gold}88`}>
          <Label color={colors.gold}>Potential · {OZ} oz × ${G.move}</Label>
          <Big color={colors.greenBright} size={76}>
            <Counter to={PROFIT} start={t2} dur={36} format={(n) => signed(Math.round(n))} />
          </Big>
        </Card>
        <Card style={{ flex: 1, opacity: prog(f, t2 + 16, 20) }} border={`${colors.red}66`}>
          <Label color={colors.red}>At risk</Label>
          <Big color={colors.red} size={76}>{usd(-MAX_LOSS)}</Big>
        </Card>
      </div>
    </AbsoluteFill>
  );
};

// 7 ─ $100 by yourself vs $2,500 with the AI
const SCompare: React.FC = () => {
  const f = useCurrentFrame();
  const l = at("compare", 0, 0.3);
  const r = at("compare", 1, 0.3);
  const Side: React.FC<{ title: string; oz: number; profit: number; who: string[]; start: number; hi?: boolean }> = ({ title, oz, profit, who, start, hi }) => {
    const p = prog(f, start, 24);
    return (
      <div style={{ flex: 1, padding: "26px 24px", borderRadius: 28, background: hi ? `linear-gradient(170deg, ${colors.gold}26, ${colors.charcoal})` : `linear-gradient(160deg, ${colors.charcoal2}, ${colors.charcoal})`, border: `1px solid ${hi ? colors.gold + "AA" : colors.line}`, opacity: p, transform: `translateY(${(1 - p) * 30}px)`, display: "flex", flexDirection: "column", gap: 16, boxShadow: hi ? `0 0 60px ${colors.gold}33` : undefined }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 56, color: hi ? colors.greenBright : colors.text, letterSpacing: -1 }}>{title}</div>
        <div>
          <Label>You hold</Label>
          <Big size={48}>
            <Counter to={oz} start={start + 10} dur={24} format={(n) => `${Math.round(n)} oz`} />
          </Big>
        </div>
        <div>
          <Label>Gold +${G.move}</Label>
          <Big size={56} color={hi ? colors.greenBright : colors.text}>
            <Counter to={profit} start={start + 24} dur={30} format={(n) => signed(Math.round(n))} />
          </Big>
        </div>
        <div style={{ height: 1, background: colors.line }} />
        {who.map((w, i) => (
          <div key={w} style={{ display: "flex", gap: 12, alignItems: "flex-start", opacity: prog(f, start + 50 + i * 12, 14) }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: hi ? colors.greenBright : colors.dim, marginTop: 10, flex: "0 0 auto" }} />
            <div style={{ fontFamily: fonts.body, fontSize: 25, lineHeight: 1.3, color: hi ? colors.text : colors.muted }}>{w}</div>
          </div>
        ))}
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <Backdrop />
      <Column top={210} gap={22}>
        <Kicker delay={4}>The difference</Kicker>
        <Headline text="Do it yourself, or let the AI do it." accent={["AI"]} delay={8} size={80} />
      </Column>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 560, display: "flex", gap: 18, alignItems: "stretch" }}>
        <Side title={usd(G.small)} oz={SMALL_OZ} profit={SMALL_PROFIT} start={l} who={["You do all the analysis", "You place every trade", "You watch the market yourself"]} />
        <Side title={usd(G.margin)} oz={OZ} profit={PROFIT} start={r} hi who={["The AI does the analysis", "The AI places the trades", "A personal account manager"]} />
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 1300, textAlign: "center", fontFamily: fonts.body, fontSize: 26, color: colors.muted, opacity: prog(f, r + 70, 20) }}>
        Same market. Same ${G.move} move. {Math.round(PROFIT / SMALL_PROFIT)}× the result, hands-off.
      </div>
    </AbsoluteFill>
  );
};

// 8 ─ Close: what $2,500 unlocks + the firm's risk disclaimer
const SClose: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = prog(f, at("close", 0), 24);
  const b = prog(f, at("close", 1), 24);
  const Badge: React.FC<{ icon: React.ReactNode; title: string; sub: string; start: number }> = ({ icon, title, sub, start }) => {
    const s = spring({ frame: f - start, fps, config: { damping: 15, mass: 1 } });
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, opacity: Math.min(1, s * 1.3), transform: `scale(${0.8 + 0.2 * s})` }}>
        <div style={{ width: 170, height: 170, borderRadius: "50%", background: `radial-gradient(circle at 35% 30%, ${colors.greenBright}, ${colors.gold} 60%, ${colors.greenDeep})`, boxShadow: `0 0 70px ${colors.gold}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 36, color: colors.text, textAlign: "center" }}>{title}</div>
        <div style={{ fontFamily: fonts.body, fontSize: 24, color: colors.muted, textAlign: "center", lineHeight: 1.3 }}>{sub}</div>
      </div>
    );
  };
  const stroke = { fill: "none", stroke: colors.ink, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <AbsoluteFill>
      <Backdrop glow={0.8} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 230, opacity: a }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 26, letterSpacing: 8, color: colors.gold }}>MOVE FORWARD WITH {usd(G.margin)}</div>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 84, color: colors.text, textAlign: "center", lineHeight: 1.05, letterSpacing: -2, marginTop: 18, padding: `0 ${SAFE.x}px` }}>
          You qualify for
          <br />
          <span style={{ color: colors.greenBright }}>both.</span>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 600, display: "flex", gap: 24 }}>
        <Badge
          start={at("close", 0, 1.6)}
          title="Account manager"
          sub="A personal manager for your account"
          icon={
            <svg width={90} height={90} viewBox="0 0 24 24" {...stroke}>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
            </svg>
          }
        />
        <Badge
          start={at("close", 0, 3.2)}
          title="AI trading bot"
          sub="Analysis and trades, done for you"
          icon={
            <svg width={90} height={90} viewBox="0 0 24 24" {...stroke}>
              <rect x="4" y="7" width="16" height="12" rx="3" />
              <path d="M12 7V4M8 4h8M9 12h.01M15 12h.01M9 16h6" />
            </svg>
          }
        />
      </div>
      <div style={{ position: "absolute", left: SAFE.x + 10, right: SAFE.x + 10, top: 1030, padding: "24px 28px", borderRadius: 22, background: "rgba(0,0,0,0.45)", border: `1px solid ${colors.line}`, opacity: b }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 20, letterSpacing: 3, color: colors.muted, marginBottom: 10 }}>RISK DISCLAIMER</div>
        <div style={{ fontFamily: fonts.body, fontSize: 21, lineHeight: 1.45, color: colors.muted }}>
          Trading CFDs and FX Contracts is highly speculative and involves significant risk of your capital. You should not risk more than you can afford. Before taking any market action, you need to be properly aware of the risk. Past performance is not a guarantee of future performance. The information above is intended to be general and is not to be considered investment advice. This information should not be understood as an offer. Should you proceed using the information above for opening market positions, it is considered you did so at your own risk.
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: 19, lineHeight: 1.4, color: colors.dim, marginTop: 10 }}>Gold's $50 moves are examples; the analyst view is as reported by TipRanks. Automation does not remove market risk.</div>
      </div>
    </AbsoluteFill>
  );
};

export const scenes: Record<string, React.FC> = { today: SToday, ounce: SOunce, position: SPosition, profit: SProfit, risk: SRisk, next: SNext, compare: SCompare, close: SClose };
const abs = (scene: string, n: number, off = 0) => tl.at(scene, n, off) + tl.scenes.find((x) => x.id === scene)!.from;
export const impacts = [abs("profit", 0, 2.2), abs("risk", 0, 1.4), abs("next", 1, 0.4), abs("compare", 1, 0.3), abs("close", 0, 1.6)];
