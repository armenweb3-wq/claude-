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
      <Title kicker="A simple story about" size={190} top={330}>
        NVIDIA
      </Title>
      <Abs x={540} y={640} w={900}>
        <div style={{ fontFamily: F.serif, fontWeight: 700, fontSize: 50, letterSpacing: 4, color: P.red, opacity: p01(f, 30, 24) }}>
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
  const age = at("ai", 2);
  return (
    <AbsoluteFill>
      <Title kicker="Today">AI is everywhere</Title>
      <Svg>
        {/* tablet */}
        <Draw d="M600 640 h330 a20 20 0 0 1 20 20 v420 a20 20 0 0 1 -20 20 h-330 a20 20 0 0 1 -20 -20 v-420 a20 20 0 0 1 20 -20 z" at={6} dur={30} width={7} fill="#2B3B5C" />
        <circle cx={765} cy={860} r={70 + Math.sin(f / 10) * 4} fill={P.green} opacity={p01(f, 30, 20) * 0.9} />
        <text x={765} y={882} textAnchor="middle" fontFamily={F.serif} fontWeight={900} fontSize={62} fill={P.ink} opacity={p01(f, 34, 20)}>
          AI
        </text>
        <Person x={300} y={1300} scale={1.55} coat="#8E6E8E" hair="#d9d9d9" glasses cane arm="hold" />
        {/* speech: question */}
        <g opacity={p01(f, q, 16)}>
          <path d="M110 520 h420 a24 24 0 0 1 24 24 v80 a24 24 0 0 1 -24 24 h-300 l-40 40 v-40 h-80 a24 24 0 0 1 -24 -24 v-80 a24 24 0 0 1 24 -24 z" fill={P.cream} stroke={P.ink} strokeWidth={4} />
        </g>
        <g opacity={p01(f, q + 30, 16)}>
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
        <Hand at={q + 30} size={42} color={P.ink}>
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
      <Title kicker="Back in 1993">It started with games</Title>
      <Svg>
        <Person x={290} y={1260} scale={1.75} coat="#1d1d1f" hair="#3a3a3a" arm="up" />
        {/* old monitor with a game */}
        <g opacity={p01(f, games, 10)}>
          <Draw d="M600 700 h320 v250 h-320 z" at={games} dur={22} width={7} fill="#2B3B5C" />
          <Draw d="M720 950 v40 M680 990 h80" at={games + 10} dur={14} width={7} />
          {Array.from({ length: 5 }).map((_, i) => (
            <rect key={i} x={640 + i * 52} y={760 + (i % 2) * 60} width={26} height={26} fill={P.green} opacity={p01(f, games + 20 + i * 3, 8)} />
          ))}
          <path d={`M${760 + Math.sin(f / 8) * 60} 900 l-22 26 h44 z`} fill={P.gold} opacity={p01(f, games + 30, 10)} />
          {/* game controller */}
          <Draw d="M640 1110 q-40 0 -50 60 q-6 50 30 50 q24 0 40 -30 h120 q16 30 40 30 q36 0 30 -50 q-10 -60 -50 -60 z" at={games + 24} dur={26} width={6} fill="#3d4f73" />
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
      <Title kicker="The key part">What is a GPU?</Title>
      {/* Panel 1: regular chip */}
      <div style={{ opacity: p01(f, one - 6, 18) }}>
        <Abs x={110} y={470} w={860} align="left">
          <Hand size={48}>A regular chip: a few jobs at a time</Hand>
        </Abs>
        <Svg>
          <rect x={90} y={540} width={900} height={300} rx={20} fill="rgba(0,0,0,0.18)" stroke={P.frame} strokeWidth={3} />
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
          <rect x={90} y={950} width={900} height={380} rx={20} fill="rgba(140,198,63,0.08)" stroke={P.green} strokeWidth={3} />
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
  const bldg = at("datacenter", 1);
  return (
    <AbsoluteFill>
      <Title kicker="Where AI lives">Giant data centers</Title>
      <Svg>
        {/* chips flowing in */}
        {Array.from({ length: 10 }).map((_, i) => {
          const t = ((f + i * 17) % 80) / 80;
          const x = 540 + (random(`c${i}`) - 0.5) * 600;
          return <rect key={i} x={x - 18} y={470 + t * 330} width={36} height={36} rx={4} fill={P.green} stroke={P.ink} strokeWidth={3} opacity={(1 - t) * p01(f, 10, 20)} />;
        })}
        <Draw d="M140 840 L540 700 L940 840 L940 1300 L140 1300 Z" at={bldg - 10} dur={30} width={7} fill="#2B3B5C" />
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
        <Hand at={bldg + 20} size={46} color={P.gold}>
          full of NVIDIA-type chips, running AI
        </Hand>
      </Abs>
    </AbsoluteFill>
  );
};

// 6 ─ Connect the dots
export const SDots: React.FC = () => {
  const f = useCurrentFrame();
  const t0 = at("dots", 1);
  const nodes = [
    { x: 280, y: 620, label: "video games" },
    { x: 800, y: 800, label: "GPUs" },
    { x: 280, y: 980, label: "AI" },
    { x: 800, y: 1160, label: "data centers" },
  ];
  const step = 30;
  return (
    <AbsoluteFill>
      <Title kicker="Let's put it together">Connecting the dots</Title>
      <Svg>
        {nodes.slice(1).map((n, i) => (
          <Draw key={i} d={`M${nodes[i].x} ${nodes[i].y} L ${n.x} ${n.y}`} at={t0 + (i + 1) * step - 14} dur={16} color={P.red} width={6} />
        ))}
        {nodes.map((n, i) => (
          <g key={i} opacity={p01(f, i === 0 ? 8 : t0 + i * step - 2, 12)}>
            <circle cx={n.x} cy={n.y} r={70} fill="#2B3B5C" stroke={P.cream} strokeWidth={6} />
            <circle cx={n.x} cy={n.y} r={22} fill={i === 3 ? P.green : P.gold} />
          </g>
        ))}
      </Svg>
      {nodes.map((n, i) => (
        <Abs key={i} x={n.x} y={n.y + 82} w={420}>
          <Hand at={i === 0 ? 10 : t0 + i * step} size={50}>
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
  const beatsAt = [at("revenue", 1, 2.3), at("revenue", 2, 0.2), at("revenue", 2, 2.0)];
  const base = 1240;
  const scale = 6; // px per $1B → $100B = 600px
  const xs = [290, 540, 790];
  return (
    <AbsoluteFill>
      <Title kicker="Sales per quarter">The business has grown</Title>
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
              <rect x={xs[i] - 90} y={base - h} width={180} height={h} fill={i === 2 ? P.green : "#6E8FB3"} stroke={P.ink} strokeWidth={4} />
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
    { x: 230, y: 560 },
    { x: 850, y: 560 },
    { x: 190, y: 770 },
    { x: 890, y: 770 },
    { x: 540, y: 900 },
  ];
  return (
    <AbsoluteFill>
      <Title kicker="Who works with NVIDIA">Many big partners</Title>
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
            <Abs key={n} x={x} y={y - 34} w={250}>
              <Pop at={20 + i * 8} style={{ display: "flex", justifyContent: "center" }}>
                <div style={{ fontFamily: F.hand, fontSize: 42, color: P.ink, background: P.cream, borderRadius: 14, padding: "6px 12px", border: `3px solid ${P.ink}` }}>{n}</div>
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
          the price can move up or down
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
  const rise = at("price", 1);
  const walkT = interpolate(f, [rise, rise + 90], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Title kicker="An example">One share: $218</Title>
      <Tag x={290} y={1080} text={fmtUSD(price.start)} at={at("price", 0, 1.6)} />
      <Svg>
        <Draw d="M300 1060 C 450 1040, 560 920, 780 760" at={rise} dur={60} color={P.green} width={10} />
        <Person x={300 + 480 * walkT} y={1060 - 300 * walkT * walkT + 0 * walkT} scale={0.9} hat bag walk={f / 4} coat="#6f6553" />
      </Svg>
      <Tag x={780} y={600} text={fmtUSD(price.target, 2)} at={rise + 50} color={P.green} />
      <Abs x={640} y={980} w={300}>
        <Hand at={rise + 30} size={72} color={P.green}>
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
      <Title kicker="This is called leverage">Using borrowed money</Title>
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
          your money is stretched about {A.leverage.toFixed(0)} times
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
      <Title size={86}>{title}</Title>
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
export const SInvest: React.FC = () => <Reveal scene="invest" idx={0} inLine={0} outLine={1} title="By investing $25,000…" note="before costs · just an example" />;

// 12 ─ $50,000
export const SFifty: React.FC = () => <Reveal scene="fifty" idx={1} inLine={0} outLine={1} title="With $50,000…" note={`more borrowing: about ${B.leverage.toFixed(1)}× · before costs`} />;

// 13 ─ Risk
export const SRisk: React.FC = () => {
  const f = useCurrentFrame();
  const down = at("risk", 1);
  const extra = at("risk", 2);
  const card = (bg: string, border: string): React.CSSProperties => ({
    background: bg,
    border: `5px solid ${border}`,
    borderRadius: 24,
    padding: "18px 26px",
    textAlign: "left",
  });
  return (
    <AbsoluteFill>
      <Title kicker="Be careful">It works both ways</Title>
      <Abs x={540} y={480} w={900}>
        <Pop at={6}>
          <div style={card("rgba(140,198,63,0.15)", P.green)}>
            <div style={{ fontFamily: F.hand, fontSize: 50, color: P.green }}>▲ If the price rises {priceMovePct}%</div>
            <div style={{ fontFamily: F.serif, fontWeight: 900, fontSize: 60, color: P.cream }}>
              +{fmtUSD(A.grossProfit, 2)} · +{fmtUSD(B.grossProfit, 2)}
            </div>
          </div>
        </Pop>
      </Abs>
      <Abs x={540} y={750} w={900}>
        <Pop at={down}>
          <div style={card("rgba(228,81,63,0.15)", P.red)}>
            <div style={{ fontFamily: F.hand, fontSize: 50, color: P.red }}>▼ If the price falls {priceMovePct}%</div>
            <div style={{ fontFamily: F.serif, fontWeight: 900, fontSize: 60, color: P.cream }}>
              −{fmtUSD(A.grossLossIfDown, 2)} · −{fmtUSD(B.grossLossIfDown, 2)}
            </div>
          </div>
        </Pop>
      </Abs>
      <Abs x={540} y={1030} w={900}>
        <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 14 }}>
          <Hand at={extra} size={50}>
            • the loan costs interest and fees
          </Hand>
          <Hand at={extra + 40} size={50}>
            • if prices fall far, the broker can sell your shares
          </Hand>
        </div>
      </Abs>
    </AbsoluteFill>
  );
};

// 14 ─ Close
export const SClose: React.FC = () => {
  const f = useCurrentFrame();
  const walk = interpolate(f, [60, 260], [560, 1000], clamp);
  return (
    <AbsoluteFill>
      <Title kicker="Remember" size={120} top={300}>
        Examples, not promises
      </Title>
      <Abs x={540} y={640} w={900}>
        <div style={{ fontFamily: F.serif, fontWeight: 700, fontSize: 48, letterSpacing: 4, color: P.red, opacity: p01(f, 20, 20) }}>NOT FINANCIAL ADVICE</div>
      </Abs>
      <Abs x={540} y={740} w={860}>
        <Hand at={at("close", 1)} size={56}>
          Talk with someone you trust before investing.
        </Hand>
      </Abs>
      <Svg>
        <Arcs x0={180} x1={900} y={1250} at={10} />
        <Person x={walk} y={1262} scale={1.1} hat bag walk={f / 4.5} coat="#6f6553" />
      </Svg>
      <Abs x={540} y={1290} w={900}>
        <Hand at={30} size={32} color={P.creamDim}>
          Figures as supplied, to be verified · Not affiliated with NVIDIA
        </Hand>
      </Abs>
    </AbsoluteFill>
  );
};
