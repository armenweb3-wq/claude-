import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { fmtInt, fmtUSD, positions, price, priceMovePct, revenue } from "../data/content";
import { at, atEnd } from "./timeline";
import { Bills, Draw, F, Hand, P, p01, Person, Pop, Title } from "./kit";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const [A, B] = positions;
const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
    {children}
  </svg>
);
const Abs: React.FC<{ x: number; y: number; w?: number; align?: "left" | "center" | "right"; children: React.ReactNode }> = ({ x, y, w = 400, align = "center", children }) => (
  <div style={{ position: "absolute", left: align === "center" ? x - w / 2 : align === "right" ? x - w : x, top: y, width: w, textAlign: align }}>{children}</div>
);
/** Reference motif: a row of hand-drawn arcs that grow, like steps of a rising cycle. */
const Arcs: React.FC<{ x0: number; x1: number; y: number; at: number; n?: number; color?: string }> = ({ x0, x1, y, at: t0, n = 9, color = "#7FB0D8" }) => {
  const w = (x1 - x0) / n;
  return (
    <>
      {Array.from({ length: n }).map((_, i) => {
        const h = 20 + Math.pow(i / (n - 1), 1.6) * 260;
        const x = x0 + i * w;
        return <Draw key={i} d={`M${x} ${y} Q ${x + w * 0.75} ${y - h * 2} ${x + w * 1.5} ${y}`} at={t0 + i * 5} dur={18} color={color} width={5} />;
      })}
    </>
  );
};

// 1 ─ Title card
export const STitle: React.FC = () => {
  const f = useCurrentFrame();
  const walk = interpolate(f, [20, 220], [170, 640], clamp);
  return (
    <AbsoluteFill>
      <Title kicker="The story of" size={190} top={330} gold={["NVIDIA"]}>
        NVIDIA
      </Title>
      <Abs x={540} y={640} w={900}>
        <div style={{ fontFamily: F.serif, fontWeight: 700, fontSize: 50, letterSpacing: 4, color: P.orange, opacity: p01(f, at("title", 1), 24) }}>
          AND ONE INVESTMENT IDEA
        </div>
      </Abs>
      <Svg>
        <Arcs x0={180} x1={900} y={1250} at={20} />
        <Person x={walk} y={1262} scale={1.25} hat bag walk={f / 4.5} coat="#6f6553" />
      </Svg>
    </AbsoluteFill>
  );
};

// 2 ─ AI in everyday life
export const SAi: React.FC = () => {
  const f = useCurrentFrame();
  const q = at("ai", 1);
  const ans = at("ai", 2);
  const age = at("ai", 3);
  return (
    <AbsoluteFill>
      <Title kicker="Today" gold={["AI"]}>AI is everywhere</Title>
      <Svg>
        {/* tablet */}
        <Draw d="M600 640 h330 a20 20 0 0 1 20 20 v420 a20 20 0 0 1 -20 20 h-330 a20 20 0 0 1 -20 -20 v-420 a20 20 0 0 1 20 -20 z" at={6} dur={30} width={7} fill={P.panel} />
        <circle cx={765} cy={860} r={70 + Math.sin(f / 10) * 4} fill={P.green} opacity={p01(f, 30, 20) * 0.9} />
        <text x={765} y={882} textAnchor="middle" fontFamily={F.serif} fontWeight={900} fontSize={62} fill={P.ink} opacity={p01(f, 34, 20)}>
          AI
        </text>
        <circle cx={300} cy={1010} r={250} fill={P.sky} opacity={0.18} />
        <Person x={300} y={1300} scale={1.55} coat={P.purple} hair="#e6e6e6" glasses cane arm="hold" />
        {/* speech: question */}
        <g opacity={p01(f, q, 16)}>
          <path d="M110 520 h420 a24 24 0 0 1 24 24 v80 a24 24 0 0 1 -24 24 h-300 l-40 40 v-40 h-80 a24 24 0 0 1 -24 -24 v-80 a24 24 0 0 1 24 -24 z" fill={P.cream} stroke={P.ink} strokeWidth={4} />
        </g>
        <g opacity={p01(f, ans, 16)}>
          <path d="M560 1130 h390 a24 24 0 0 1 24 24 v80 a24 24 0 0 1 -24 24 h-390 a24 24 0 0 1 -24 -24 v-80 a24 24 0 0 1 24 -24 z" fill={P.green} stroke={P.ink} strokeWidth={4} />
        </g>
        {/* age call-out */}
        <Draw d="M330 790 C 420 800, 420 960, 320 985 C 220 1005, 170 900, 200 840 C 225 795, 290 785, 360 805" at={age + 6} dur={22} color={P.red} width={6} />
      </Svg>
      <Abs x={330} y={548} w={420}>
        <Hand at={q} size={44} color={P.ink}>
          “What's a good soup recipe?”
        </Hand>
      </Abs>
      <Abs x={755} y={1160} w={400}>
        <Hand at={ans} size={42} color={P.ink}>
          “Here's an easy one…”
        </Hand>
      </Abs>
      <Abs x={300} y={1312} w={460}>
        <Hand at={age + 20} size={54} color={P.red}>
          ↑ retiree, age 80
        </Hand>
      </Abs>
    </AbsoluteFill>
  );
};

// 3 ─ Founder & games
export const SFounder: React.FC = () => {
  const f = useCurrentFrame();
  const games = at("founder", 1);
  return (
    <AbsoluteFill>
      <Title kicker="Back in 1993" gold={["games"]}>It started with games</Title>
      <Svg>
        <circle cx={290} cy={980} r={250} fill={P.gold} opacity={0.2} />
        <Person x={290} y={1260} scale={1.75} coat="#1d1d1f" hair="#3a3a3a" arm="up" />
        {/* old monitor with a game */}
        <g opacity={p01(f, games, 10)}>
          <Draw d="M600 700 h320 v250 h-320 z" at={games} dur={22} width={7} fill={P.panel} />
          <Draw d="M720 950 v40 M680 990 h80" at={games + 10} dur={14} width={7} />
          {Array.from({ length: 5 }).map((_, i) => (
            <rect key={i} x={640 + i * 52} y={760 + (i % 2) * 60} width={26} height={26} fill={P.green} opacity={p01(f, games + 20 + i * 3, 8)} />
          ))}
          <path d={`M${760 + Math.sin(f / 8) * 60} 900 l-22 26 h44 z`} fill={P.gold} opacity={p01(f, games + 30, 10)} />
          {/* game controller */}
          <Draw d="M640 1110 q-40 0 -50 60 q-6 50 30 50 q24 0 40 -30 h120 q16 30 40 30 q36 0 30 -50 q-10 -60 -50 -60 z" at={games + 24} dur={26} width={6} fill={P.purple} />
          <circle cx={650} cy={1160} r={10} fill={P.cream} opacity={p01(f, games + 44, 8)} />
          <circle cx={800} cy={1150} r={9} fill={P.red} opacity={p01(f, games + 46, 8)} />
          <circle cx={825} cy={1172} r={9} fill={P.green} opacity={p01(f, games + 48, 8)} />
        </g>
      </Svg>
      <Abs x={290} y={1290} w={520}>
        <Hand at={14} size={54}>
          Jensen Huang
        </Hand>
        <Hand at={20} size={40} color={P.creamDim}>
          co-founder of NVIDIA
        </Hand>
      </Abs>
      <Abs x={760} y={600} w={420}>
        <Hand at={games + 10} size={46} color={P.gold}>
          chips for video games
        </Hand>
      </Abs>
    </AbsoluteFill>
  );
};

/** A tiny worker carrying a box. */
const Worker: React.FC<{ x: number; y: number; s: number; t: number }> = ({ x, y, s, t }) => (
  <g>
    <Person x={x} y={y} scale={s} coat="#c98a3a" hair="#2a2a2a" walk={t} arm="hold" />
    <rect x={x + 10 * s} y={y - 205 * s} width={46 * s} height={40 * s} fill="#b88a57" stroke={P.ink} strokeWidth={3} />
  </g>
);

// 4 ─ What is a GPU?
export const SGpu: React.FC = () => {
  const f = useCurrentFrame();
  const one = at("gpu", 1);
  const many = at("gpu", 2);
  const need = at("gpu", 3);
  const loop = (t: number, period: number) => ((t % period) + period) % period / period;
  const cx = interpolate(loop(f - one, 90), [0, 1], [190, 860]);
  return (
    <AbsoluteFill>
      <Title kicker="The key part" gold={["GPU?"]}>What is a GPU?</Title>
      {/* Panel 1: regular chip */}
      <div style={{ opacity: p01(f, one - 6, 18) }}>
        <Abs x={110} y={470} w={860} align="left">
          <Hand size={48} color={P.gold}>A regular chip: a few jobs at a time</Hand>
        </Abs>
        <Svg>
          <rect x={90} y={540} width={900} height={300} rx={20} fill="rgba(255,201,74,0.10)" stroke={P.gold} strokeWidth={3} />
          <Worker x={cx} y={800} s={0.75} t={f / 4} />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={110} y={740 - i * 44} width={56} height={44} fill="#b88a57" stroke={P.ink} strokeWidth={3} />
          ))}
        </Svg>
      </div>
      {/* Panel 2: GPU */}
      <div style={{ opacity: p01(f, many - 6, 18) }}>
        <Abs x={110} y={880} w={860} align="left">
          <Hand size={48} color={P.green}>
            A GPU: thousands of jobs at once
          </Hand>
        </Abs>
        <Svg>
          <rect x={90} y={950} width={900} height={380} rx={20} fill="rgba(140,198,63,0.14)" stroke={P.green} strokeWidth={3} />
          {Array.from({ length: 21 }).map((_, i) => {
            const col = i % 7;
            const row = Math.floor(i / 7);
            const xx = 150 + col * 122 + Math.sin((f - many) / 10 + i) * 14;
            return <Worker key={i} x={xx} y={1060 + row * 118} s={0.36} t={f / 4 + i} />;
          })}
        </Svg>
      </div>
      <Svg>
        <Draw d="M80 960 C 60 1120, 70 1330, 300 1345 C 600 1365, 1000 1350, 1005 1150 C 1010 960, 700 935, 400 942" at={need + 4} dur={24} color={P.red} width={7} />
      </Svg>
      <Abs x={540} y={1340} w={700}>
        <Hand at={need + 20} size={50} color={P.red}>
          exactly what AI needs
        </Hand>
      </Abs>
    </AbsoluteFill>
  );
};

// 5 ─ Data centers
export const SDataCenter: React.FC = () => {
  const f = useCurrentFrame();
  const bldg = at("datacenter", 0, 0.5);
  const named = at("datacenter", 1);
  const lives = at("datacenter", 2);
  return (
    <AbsoluteFill>
      <Title kicker="Where AI lives" gold={["data", "centers"]}>Giant data centers</Title>
      <Svg>
        {/* chips flowing in */}
        {Array.from({ length: 10 }).map((_, i) => {
          const t = ((f + i * 17) % 80) / 80;
          const x = 540 + (random(`c${i}`) - 0.5) * 600;
          return <rect key={i} x={x - 18} y={470 + t * 330} width={36} height={36} rx={4} fill={P.green} stroke={P.ink} strokeWidth={3} opacity={(1 - t) * p01(f, 10, 20)} />;
        })}
        <Draw d="M140 840 L540 700 L940 840 L940 1300 L140 1300 Z" at={bldg} dur={30} width={7} fill={P.panel} />
        <path d="M140 840 L540 700 L940 840 Z" fill={P.orange} opacity={p01(f, bldg + 30, 16)} />
        <circle cx={540} cy={1100} r={300} fill={P.green} opacity={0.18 * p01(f, lives, 20) * (0.8 + 0.2 * Math.sin(f / 12))} />
        {[0, 1, 2, 3].map((r) =>
          [0, 1, 2, 3, 4].map((c) => {
            const x = 200 + c * 150;
            const y = 900 + r * 96;
            const on = random(`led${r}${c}${Math.floor(f / 8)}`) > 0.35;
            return (
              <g key={`${r}${c}`} opacity={p01(f, bldg + 8 + (r * 5 + c) * 2, 10)}>
                <rect x={x} y={y} width={110} height={70} rx={6} fill="#16223a" stroke={P.frame} strokeWidth={2} />
                <circle cx={x + 20} cy={y + 22} r={7} fill={on ? P.green : "#3b4a2a"} />
                <circle cx={x + 44} cy={y + 22} r={7} fill={!on ? P.green : "#3b4a2a"} />
                <path d={`M${x + 14} ${y + 50} h80`} stroke={P.creamDim} strokeWidth={3} />
              </g>
            );
          }),
        )}
      </Svg>
      <Abs x={540} y={1310} w={800}>
        <Hand at={named} size={52} color={P.gold}>
          a data center
        </Hand>
      </Abs>
    </AbsoluteFill>
  );
};

// 6 ─ Connect the dots
export const SDots: React.FC = () => {
  const f = useCurrentFrame();
  const nodes = [
    { x: 280, y: 620, label: "video games", t: at("dots", 1, 0.1), c: P.purple },
    { x: 800, y: 800, label: "GPUs", t: at("dots", 1, 1.2), c: P.gold },
    { x: 280, y: 980, label: "AI", t: at("dots", 2, 1.0), c: P.sky },
    { x: 800, y: 1160, label: "data centers", t: at("dots", 3, 1.6), c: P.green },
  ];
  return (
    <AbsoluteFill>
      <Title kicker="Let's put it together" gold={["dots"]}>Connecting the dots</Title>
      <Svg>
        {nodes.slice(1).map((n, i) => (
          <Draw key={i} d={`M${nodes[i].x} ${nodes[i].y} L ${n.x} ${n.y}`} at={n.t - 20} dur={16} color={P.gold} width={7} />
        ))}
        {nodes.map((n, i) => (
          <g key={i} opacity={p01(f, n.t, 12)}>
            <circle cx={n.x} cy={n.y} r={70} fill={P.panel} stroke={n.c} strokeWidth={8} />
            <circle cx={n.x} cy={n.y} r={26} fill={n.c} />
          </g>
        ))}
      </Svg>
      {nodes.map((n, i) => (
        <Abs key={i} x={n.x} y={n.y + 82} w={420}>
          <Hand at={n.t} size={52}>
            {n.label}
          </Hand>
        </Abs>
      ))}
    </AbsoluteFill>
  );
};

// 7 ─ Revenue chart (zero-based, to scale)
export const SRevenue: React.FC = () => {
  const f = useCurrentFrame();
  const beatsAt = [atEnd("revenue", 1, -1.6), at("revenue", 2, 0.3), at("revenue", 3, 0.3)];
  const base = 1240;
  const scale = 6; // px per $1B → $100B = 600px
  const xs = [290, 540, 790];
  return (
    <AbsoluteFill>
      <Title kicker="Sales per quarter" gold={["growing"]}>The business is growing</Title>
      <Svg>
        <Draw d={`M96 ${base} H 960`} at={10} dur={20} width={5} />
        {[50, 100].map((v) => (
          <g key={v} opacity={p01(f, 20, 20)}>
            <path d={`M96 ${base - v * scale} H 960`} stroke={P.frame} strokeWidth={2} strokeDasharray="10 12" opacity={0.6} />
            <text x={96} y={base - v * scale - 12} fontFamily={F.hand} fontSize={36} fill={P.creamDim}>
              ${v}B
            </text>
          </g>
        ))}
        {revenue.map((q, i) => {
          const g = p01(f, beatsAt[i], 30);
          const h = q.value * scale * g;
          return (
            <g key={i}>
              <rect x={xs[i] - 90} y={base - h} width={180} height={h} fill={[P.sky, P.gold, P.green][i]} stroke={P.ink} strokeWidth={4} />
              <text x={xs[i]} y={base - h - 22} textAnchor="middle" fontFamily={F.serif} fontWeight={900} fontSize={58} fill={P.cream} opacity={g}>
                ${(q.value * g).toFixed(1)}B
              </text>
            </g>
          );
        })}
        {/* the rising "bounce" between bar tops */}
        {[0, 1].map((i) => (
          <Draw
            key={i}
            d={`M${xs[i]} ${base - revenue[i].value * scale - 90} Q ${(xs[i] + xs[i + 1]) / 2} ${base - revenue[i + 1].value * scale - 220} ${xs[i + 1]} ${base - revenue[i + 1].value * scale - 90}`}
            at={beatsAt[i + 1] + 20}
            dur={18}
            color="#7FB0D8"
            width={5}
          />
        ))}
      </Svg>
      {revenue.map((q, i) => (
        <Abs key={i} x={xs[i]} y={base + 14} w={240}>
          <Hand at={20} size={40} color={P.creamDim}>
            {q.label}
          </Hand>
        </Abs>
      ))}
    </AbsoluteFill>
  );
};

// 8 ─ Partners + next results
export const SPartners: React.FC = () => {
  const f = useCurrentFrame();
  const cal = at("partners", 1);
  const move = at("partners", 2);
  const hub = { x: 540, y: 720 };
  const names = ["Cloud", "AI labs", "Business", "Cars & robots", "Countries"];
  const spots = [
    { x: 240, y: 560 },
    { x: 840, y: 560 },
    { x: 220, y: 770 },
    { x: 850, y: 770 },
    { x: 540, y: 900 },
  ];
  return (
    <AbsoluteFill>
      <Title kicker="Who works with NVIDIA" gold={["partners"]}>Many big partners</Title>
      <div style={{ opacity: 1 - p01(f, cal - 10, 16) * 0.5 }}>
        <Svg>
          {spots.map(({ x, y }, i) => (
            <Draw key={i} d={`M${hub.x} ${hub.y} L${x} ${y}`} at={14 + i * 8} dur={14} width={4} color={P.frame} />
          ))}
          <circle cx={hub.x} cy={hub.y} r={84} fill={P.green} stroke={P.ink} strokeWidth={5} opacity={p01(f, 4, 16)} />
          <text x={hub.x} y={hub.y + 14} textAnchor="middle" fontFamily={F.serif} fontWeight={900} fontSize={40} fill={P.ink} opacity={p01(f, 8, 16)}>
            NVIDIA
          </text>
        </Svg>
        {names.map((n, i) => {
          const { x, y } = spots[i];
          return (
            <Abs key={n} x={x} y={y - 34} w={320}>
              <Pop at={20 + i * 8} style={{ display: "flex", justifyContent: "center" }}>
                <div style={{ fontFamily: F.hand, fontSize: 44, color: P.ink, background: [P.sky, P.gold, P.orange, P.purple, P.green][i], borderRadius: 14, padding: "6px 14px", border: `3px solid ${P.ink}`, whiteSpace: "nowrap" }}>{n}</div>
              </Pop>
            </Abs>
          );
        })}
      </div>
      <Abs x={540} y={1010} w={420}>
        <Pop at={cal}>
          <div style={{ background: P.cream, border: `5px solid ${P.ink}`, borderRadius: 18, overflow: "hidden" }}>
            <div style={{ background: P.red, color: P.cream, fontFamily: F.serif, fontWeight: 700, fontSize: 40, padding: "8px 0" }}>NEXT RESULTS</div>
            <div style={{ fontFamily: F.hand, fontSize: 48, color: P.ink, padding: "18px 0" }}>date to be confirmed</div>
          </div>
        </Pop>
      </Abs>
      <Svg>
        <g opacity={p01(f, move, 14)}>
          <path d="M190 1230 V1060 M140 1110 L190 1050 L240 1110" stroke={P.green} strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M890 1050 V1220 M840 1170 L890 1230 L940 1170" stroke={P.red} strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </Svg>
      <Abs x={540} y={1250} w={700}>
        <Hand at={move + 8} size={46} color={P.creamDim}>
          results can move the price
        </Hand>
      </Abs>
    </AbsoluteFill>
  );
};

const Tag: React.FC<{ x: number; y: number; text: string; at: number; color?: string }> = ({ x, y, text, at: t, color = P.cream }) => (
  <Abs x={x} y={y} w={340}>
    <Pop at={t}>
      <div style={{ display: "inline-block", background: color, color: P.ink, fontFamily: F.serif, fontWeight: 900, fontSize: 70, padding: "10px 28px", borderRadius: 16, border: `5px solid ${P.ink}` }}>
        {text}
      </div>
    </Pop>
  </Abs>
);

// 9 ─ Price example
export const SPrice: React.FC = () => {
  const f = useCurrentFrame();
  const rise = at("price", 2);
  const walkT = interpolate(f, [rise, rise + 150], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Title kicker="The investment idea" gold={["$218"]}>One share: $218</Title>
      <Tag x={290} y={1080} text={fmtUSD(price.start)} at={at("price", 1)} />
      <Svg>
        <Draw d="M300 1060 C 450 1040, 560 920, 780 760" at={rise} dur={60} color={P.green} width={10} />
        <Person x={300 + 480 * walkT} y={1060 - 300 * walkT * walkT + 0 * walkT} scale={0.9} hat bag walk={f / 4} coat="#6f6553" />
      </Svg>
      <Tag x={780} y={600} text={fmtUSD(price.target, 2)} at={at("price", 3)} color={P.green} />
      <Abs x={640} y={980} w={300}>
        <Hand at={rise + 10} size={72} color={P.green}>
          +{priceMovePct}%
        </Hand>
      </Abs>
    </AbsoluteFill>
  );
};

// 10 ─ Leverage
export const SLeverage: React.FC = () => {
  const f = useCurrentFrame();
  const own = at("leverage", 1);
  const lend = at("leverage", 2);
  const buy = at("leverage", 3);
  const borrowed = A.exposure - A.capital;
  return (
    <AbsoluteFill>
      <Title kicker="This is called leverage" gold={["borrowed"]}>Using borrowed money</Title>
      <Svg>
        <g opacity={p01(f, own, 14)}>
          <Bills x={200} y={1120} n={4} w={170} />
        </g>
        <g opacity={p01(f, lend, 14)}>
          <text x={340} y={1060} textAnchor="middle" fontFamily={F.serif} fontWeight={900} fontSize={90} fill={P.cream}>
            +
          </text>
          <Bills x={500} y={1120} n={Math.round(interpolate(f, [lend, lend + 40], [1, 16], clamp))} color="#C9D8E6" w={190} />
        </g>
        <g opacity={p01(f, buy, 14)}>
          <path d="M630 1000 h60 M670 980 l24 20 l-24 20" stroke={P.cream} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x={720} y={840} width={260} height={290} rx={18} fill="#b88a57" stroke={P.ink} strokeWidth={5} />
          <path d="M720 900 h260" stroke={P.ink} strokeWidth={4} />
        </g>
      </Svg>
      <Abs x={200} y={1150} w={260}>
        <Hand at={own} size={42}>
          yours
        </Hand>
        <Hand at={own} size={46} color={P.green}>
          {fmtUSD(A.capital)}
        </Hand>
      </Abs>
      <Abs x={500} y={1150} w={300}>
        <Hand at={lend} size={42}>
          borrowed
        </Hand>
        <Hand at={lend} size={46} color="#C9D8E6">
          ≈ {fmtUSD(Math.round(borrowed / 1000) * 1000)}
        </Hand>
      </Abs>
      <Abs x={850} y={930} w={240}>
        <Hand at={buy + 10} size={58} color={P.ink}>
          {fmtInt(A.shares)}
        </Hand>
        <Hand at={buy + 10} size={44} color={P.ink}>
          shares
        </Hand>
        <Hand at={buy + 18} size={34} color={P.ink}>
          worth {fmtUSD(A.exposure)}
        </Hand>
      </Abs>
      <Abs x={540} y={1270} w={900}>
        <Hand at={buy + 30} size={44} color={P.gold}>
          your money works about {A.leverage.toFixed(0)} times bigger
        </Hand>
      </Abs>
    </AbsoluteFill>
  );
};

/** "You put in → you could potentially make" call-out with a red marker circle. */
const Reveal: React.FC<{ scene: string; idx: number; inLine: number; outLine: number; title: string; note: string }> = ({ scene, idx, inLine, outLine, title, note }) => {
  const f = useCurrentFrame();
  const p = positions[idx];
  const tin = at(scene, inLine, 0.2);
  const tout = at(scene, outLine, 0.6);
  const circle = atEnd(scene, outLine, -1.4);
  const v = interpolate(f, [tout + 10, tout + 70], [0, p.grossProfit], { ...clamp });
  return (
    <AbsoluteFill>
      <Title size={86} gold={[title.split(" ").pop()!.replace(/[^\w$%]/g, "")]}>{title}</Title>
      <Abs x={540} y={470} w={880}>
        <Pop at={tin}>
          <div style={{ fontFamily: F.hand, fontSize: 50, color: P.creamDim }}>you put in</div>
          <div style={{ fontFamily: F.serif, fontWeight: 900, fontSize: 130, color: P.cream, lineHeight: 1.05 }}>{fmtUSD(p.capital)}</div>
          <div style={{ fontFamily: F.hand, fontSize: 42, color: P.creamDim }}>
            + borrowed money → {fmtInt(p.shares)} shares
          </div>
        </Pop>
      </Abs>
      <Svg>
        <Draw d="M540 820 C 520 860, 560 900, 540 950 M505 915 L540 955 L575 915" at={tout - 20} dur={20} color={P.cream} width={8} />
      </Svg>
      <Abs x={730} y={850} w={400}>
        <Hand at={tout - 14} size={46} color={P.green}>
          if it rises {priceMovePct}%…
        </Hand>
      </Abs>
      <Abs x={540} y={980} w={900}>
        <Pop at={tout}>
          <div style={{ fontFamily: F.hand, fontSize: 52, color: P.cream }}>you could potentially make</div>
          <div style={{ fontFamily: F.serif, fontWeight: 900, fontSize: 132, color: P.green, lineHeight: 1.08, fontVariantNumeric: "tabular-nums" }}>
            {fmtUSD(v, 2)}
          </div>
        </Pop>
      </Abs>
      <Svg>
        <Draw d="M720 1050 C 900 1060, 1010 1110, 990 1170 C 970 1240, 700 1250, 520 1248 C 300 1246, 80 1230, 80 1160 C 80 1090, 300 1052, 560 1052 C 700 1052, 780 1058, 840 1070" at={circle} dur={26} color={P.red} width={8} />
      </Svg>
      <Abs x={540} y={1268} w={900}>
        <Hand at={circle + 18} size={46} color={P.red}>
          {note}
        </Hand>
      </Abs>
    </AbsoluteFill>
  );
};

// 11 ─ $25,000
export const SInvest: React.FC = () => <Reveal scene="invest" idx={0} inLine={0} outLine={1} title="By investing $25,000…" note="before interest and fees" />;

// 12 ─ $50,000
export const SFifty: React.FC = () => <Reveal scene="fifty" idx={1} inLine={0} outLine={3} title="With $50,000…" note={`more borrowing: about ${B.leverage.toFixed(1)}× · before interest and fees`} />;

// 13 ─ One thing to remember (kept deliberately short)
export const SRisk: React.FC = () => {
  const f = useCurrentFrame();
  const line = at("risk", 1);
  const tilt = interpolate(f, [line, line + 50], [-10, 10], { ...clamp });
  return (
    <AbsoluteFill>
      <Title kicker="One thing to remember" gold={["ways"]}>It works both ways</Title>
      <Svg>
        <g transform={`rotate(${tilt} 540 960)`} opacity={p01(f, 6, 16)}>
          <rect x={180} y={945} width={720} height={30} rx={14} fill={P.orange} stroke={P.ink} strokeWidth={4} />
          <circle cx={240} cy={915} r={34} fill={P.green} stroke={P.ink} strokeWidth={4} />
          <circle cx={840} cy={915} r={34} fill={P.red} stroke={P.ink} strokeWidth={4} />
        </g>
        <path d="M540 975 L480 1080 H600 Z" fill={P.gold} stroke={P.ink} strokeWidth={4} opacity={p01(f, 6, 16)} />
      </Svg>
      <Abs x={540} y={560} w={880}>
        <Hand at={10} size={58} color={P.green}>
          price up → bigger gains
        </Hand>
      </Abs>
      <Abs x={540} y={1130} w={880}>
        <Hand at={line} size={58} color={P.red}>
          price down → bigger losses
        </Hand>
      </Abs>
    </AbsoluteFill>
  );
};

/** Little shovel icon. */
const Shovel: React.FC<{ x: number; y: number; s?: number; rot?: number }> = ({ x, y, s = 1, rot = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
    <path d="M0 -90 V20" stroke="#8a5a32" strokeWidth={10} strokeLinecap="round" />
    <path d="M-16 -96 h32" stroke="#8a5a32" strokeWidth={10} strokeLinecap="round" />
    <path d="M-22 20 h44 v26 q-22 26 -44 0 z" fill="#c9d3dc" stroke={P.ink} strokeWidth={4} />
  </g>
);

// 5b ─ Why NVIDIA matters: selling shovels in a gold rush
export const SWhy: React.FC = () => {
  const f = useCurrentFrame();
  const rush = at("why", 1);
  const sold = at("why", 2);
  const nv = at("why", 3, 1.0);
  const buyers = at("why", 4);
  const swap = p01(f, nv, 16);
  const minersFade = 1 - p01(f, buyers - 10, 16) * 0.7;
  const queue = interpolate(f, [buyers, buyers + 140], [-160, 330], clamp);
  return (
    <AbsoluteFill>
      <Title kicker="Why NVIDIA matters" gold={["shovels"]}>Selling shovels in a gold rush</Title>
      <Svg>
        {/* gold hills and miners */}
        <g opacity={p01(f, rush, 16) * minersFade}>
          <path d="M60 1300 Q 170 1020 320 1120 Q 430 960 600 1300 Z" fill="#B9853F" stroke={P.ink} strokeWidth={4} />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={150 + i * 80} cy={1180 + (i % 2) * 40} r={12} fill={P.gold} stroke={P.ink} strokeWidth={2} />
          ))}
          {[160, 330, 480].map((x, i) => (
            <g key={i}>
              <Person x={x} y={1290} scale={0.62} hat coat={[P.red, P.sky, P.purple][i]} />
              <g transform={`rotate(${Math.sin(f / 7 + i) * 25} ${x + 20} ${1290 - 150})`}>
                <path d={`M${x + 20} ${1290 - 150} l40 -40 M${x + 46} ${1290 - 196} l28 28`} stroke="#8a5a32" strokeWidth={6} strokeLinecap="round" />
              </g>
            </g>
          ))}
        </g>
        {/* the shop */}
        <g opacity={p01(f, sold, 16)}>
          <rect x={620} y={860} width={380} height={440} fill="#8B5A33" stroke={P.ink} strokeWidth={5} />
          {Array.from({ length: 6 }).map((_, i) => (
            <path key={i} d={`M${620 + i * 63.3} 860 h63.3 v60 q-31.6 26 -63.3 0 z`} fill={i % 2 ? P.cream : P.red} stroke={P.ink} strokeWidth={3} />
          ))}
          <rect x={650} y={1040} width={320} height={60} fill="#6d4426" stroke={P.ink} strokeWidth={4} />
          <g opacity={1 - swap}>
            <Shovel x={710} y={1000} s={0.8} rot={-12} />
            <Shovel x={810} y={1000} s={0.8} />
            <Shovel x={910} y={1000} s={0.8} rot={12} />
          </g>
          <g opacity={swap}>
            {[710, 810, 910].map((x) => (
              <g key={x}>
                <rect x={x - 34} y={950} width={68} height={68} rx={8} fill={P.green} stroke={P.ink} strokeWidth={4} />
                <path d={`M${x - 20} 950 v-14 M${x} 950 v-14 M${x + 20} 950 v-14 M${x - 20} 1018 v14 M${x} 1018 v14 M${x + 20} 1018 v14`} stroke={P.ink} strokeWidth={4} />
              </g>
            ))}
          </g>
          {/* coins: the shop did well */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ellipse key={i} cx={760 + (i % 3) * 60} cy={1240 - Math.floor(i / 3) * 18} rx={26} ry={10} fill={P.gold} stroke={P.ink} strokeWidth={3} opacity={p01(f, sold + 20 + i * 4, 8)} />
          ))}
        </g>
        {/* big tech buyers walk up to the shop */}
        <g opacity={p01(f, buyers, 12)}>
          {[0, 1, 2].map((i) => (
            <Person key={i} x={queue + 140 - i * 120} y={1300} scale={0.85} coat={["#2f2f3a", P.sky, P.purple][i]} hair="#3a2a20" walk={queue < 330 ? f / 4 + i : undefined} />
          ))}
        </g>
      </Svg>
      <Abs x={810} y={770} w={420}>
        <div style={{ position: "relative", height: 70 }}>
          <div style={{ position: "absolute", inset: 0, opacity: p01(f, sold, 12) * (1 - swap), fontFamily: F.serif, fontWeight: 900, fontSize: 52, color: P.ink, background: P.cream, borderRadius: 12, border: `4px solid ${P.ink}` }}>
            SHOVELS
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: swap, fontFamily: F.serif, fontWeight: 900, fontSize: 48, color: P.ink, background: P.green, borderRadius: 12, border: `4px solid ${P.ink}` }}>
            NVIDIA CHIPS
          </div>
        </div>
      </Abs>
      <Abs x={330} y={760} w={520}>
        <div style={{ opacity: 1 - p01(f, buyers - 10, 12) }}>
          <Hand at={rush} size={52} color={P.gold}>
            the gold rush
          </Hand>
        </div>
      </Abs>
      <Abs x={330} y={1318} w={560}>
        <Hand at={buyers + 10} size={48} color={P.cream}>
          big tech companies, lining up
        </Hand>
      </Abs>
    </AbsoluteFill>
  );
};

// 14 ─ Close
export const SClose: React.FC = () => {
  const f = useCurrentFrame();
  const walk = interpolate(f, [40, 300], [560, 1000], clamp);
  return (
    <AbsoluteFill>
      <Title kicker="The company that sells" size={190} top={300} gold={["NVIDIA"]}>
        NVIDIA
      </Title>
      <Abs x={540} y={600} w={900}>
        <div style={{ fontFamily: F.serif, fontWeight: 700, fontSize: 58, color: P.cream, opacity: p01(f, 30, 24), lineHeight: 1.15 }}>
          the <span style={{ color: P.gold }}>shovels</span> of the AI age
        </div>
      </Abs>
      <Svg>
        <g opacity={p01(f, 50, 20)}>
          <Shovel x={430} y={880} s={1.5} rot={-20} />
          <rect x={560} y={820} width={140} height={140} rx={14} fill={P.green} stroke={P.ink} strokeWidth={5} />
          <path d="M590 820 v-24 M630 820 v-24 M670 820 v-24 M590 960 v24 M630 960 v24 M670 960 v24" stroke={P.ink} strokeWidth={6} />
        </g>
        <Arcs x0={180} x1={900} y={1250} at={10} />
        <Person x={walk} y={1262} scale={1.1} hat bag walk={f / 4.5} coat="#6f6553" />
      </Svg>
    </AbsoluteFill>
  );
};
