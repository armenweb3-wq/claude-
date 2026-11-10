import React from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import { prog } from "./primitives";
import { colors, fonts } from "./theme";

/*
 * Daily candlestick chart of gold for the account story, 23.09 → 10.11.2026.
 * The anchor prices are the ones in the client's report (entry 4,293.99; TP 4,327 never reached;
 * 3 Nov trade around 3,944 → 3,898; 9 Nov buy 4,087.24 and close 4,133.00; 10 Nov close 4,117.47).
 * Everything between anchors is a seeded, deterministic sketch of the path, not tick data.
 */
export const DAYS = [
  "23.09", "24.09", "25.09", "28.09", "29.09", "30.09",
  "01.10", "02.10", "05.10", "06.10", "07.10", "08.10", "09.10", "12.10", "13.10", "14.10", "15.10", "16.10", "19.10", "20.10", "21.10", "22.10", "23.10", "26.10", "27.10", "28.10", "29.10", "30.10",
  "02.11", "03.11", "04.11", "05.11", "06.11", "09.11", "10.11",
];
const N = DAYS.length; // 35
const ANCHORS: [number, number][] = [
  [0, 4_306], [2, 4_318], [4, 4_296], [7, 4_270], [10, 4_240], [14, 4_205], [18, 4_160], [22, 4_110], [25, 4_060], [27, 4_010], [28, 3_960], [29, 3_915], [30, 3_975], [31, 4_030], [32, 4_072],
];
const target = (i: number) => {
  for (let k = 1; k < ANCHORS.length; k++) {
    const [i0, p0] = ANCHORS[k - 1];
    const [i1, p1] = ANCHORS[k];
    if (i <= i1) return p0 + ((p1 - p0) * (i - i0)) / (i1 - i0);
  }
  return ANCHORS[ANCHORS.length - 1][1];
};
export type Candle = { o: number; h: number; l: number; c: number };
export const candles: Candle[] = (() => {
  const out: Candle[] = [];
  let prev = 4_293.99;
  for (let i = 0; i <= 32; i++) {
    const o = prev;
    const c = target(i) + (random(`gc${i}`) - 0.5) * 22;
    const up = Math.max(o, c) + 4 + random(`gh${i}`) * 14;
    const dn = Math.min(o, c) - 4 - random(`gl${i}`) * 14;
    out.push({ o, c, h: Math.min(up, 4_322), l: dn }); // the 4,327 take profit was never reached
    prev = c;
  }
  out.push({ o: 4_092, h: 4_138, l: 4_084, c: 4_133.0 }); // 09.11 — averaging buy at 4,087.24, 5.75 lots closed at 4,133.00
  out.push({ o: 4_131, h: 4_135, l: 4_110, c: 4_117.47 }); // 10.11 — original 1.15 lots closed at 4,117.47
  return out;
})();

export const GoldChart: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  /** frame the history starts drawing */
  at: number;
  /** frame of the averaging buy (09.11 candle dips) */
  buyAt: number;
  /** frame of the recovery and closes */
  closeAt: number;
  entry: number;
  avg: number;
  buy: number;
  closeNew: number;
  closeOld: number;
}> = ({ x, y, w, h, at, buyAt, closeAt, entry, avg, buy, closeNew, closeOld }) => {
  const f = useCurrentFrame();
  const lo = 3_860;
  const hi = 4_350;
  const padL = 10;
  const padR = 120;
  const padT = 20;
  const padB = 44;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * plotH;
  const slot = plotW / N;
  const cw = slot * 0.62;
  const X = (i: number) => padL + i * slot + slot / 2;
  const per = 3; // frames per history candle
  // live state of the two last candles
  const dip = prog(f, buyAt, 22); // 09.11: wick runs down to the buy
  const rise = prog(f, closeAt, 34); // 09.11: body closes up at 4,133
  const last = prog(f, closeAt + 40, 28); // 10.11 forms
  const c33 = candles[33];
  const c34 = candles[34];
  const live33: Candle = {
    o: c33.o,
    l: c33.o - (c33.o - c33.l) * dip,
    c: dip < 1 ? c33.o - (c33.o - buy) * dip : buy + (c33.c - buy) * rise,
    h: c33.o + (c33.h - c33.o) * rise,
  };
  const live34: Candle = { o: c34.o, h: c34.o + (c34.h - c34.o) * last, l: c34.o - (c34.o - c34.l) * Math.min(1, last * 1.4), c: c34.o + (c34.c - c34.o) * last };
  const shownHist = Math.min(33, Math.floor(Math.max(0, f - at) / per) + 1);
  const curPrice = f < buyAt ? (shownHist > 0 ? candles[Math.min(32, shownHist - 1)].c : entry) : f < closeAt + 40 ? live33.c : live34.c;
  const grid = [3_900, 4_000, 4_100, 4_200, 4_300];
  const xLabels: [number, string][] = [
    [0, "23.09"],
    [6, "01.10"],
    [16, "15.10"],
    [28, "02.11"],
    [33, "09.11"],
  ];
  const Cndl: React.FC<{ c: Candle; i: number; grow?: number; emph?: boolean }> = ({ c, i, grow = 1, emph }) => {
    const up = c.c >= c.o;
    const col = up ? colors.green : colors.red;
    const top = Y(Math.max(c.o, c.c));
    const bot = Y(Math.min(c.o, c.c));
    return (
      <g opacity={grow}>
        <line x1={X(i)} x2={X(i)} y1={Y(c.h)} y2={Y(c.l)} stroke={col} strokeWidth={emph ? 2.5 : 1.8} />
        <rect x={X(i) - cw / 2} width={cw} y={top} height={Math.max(2, bot - top)} fill={up ? "#DFF1E5" : "#F7DCDC"} stroke={col} strokeWidth={emph ? 2.5 : 1.6} rx={1.5} />
      </g>
    );
  };
  const entryP = prog(f, at, 24);
  const avgP = prog(f, buyAt + 30, 24);
  const tagY = Y(curPrice);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h }}>
      <svg width={w} height={h} style={{ overflow: "visible" }}>
        {/* frame + grid */}
        <rect x={padL} y={padT} width={plotW} height={plotH} fill="rgba(255,255,255,0.35)" stroke={colors.ink} strokeOpacity={0.35} strokeWidth={1.5} />
        {grid.map((v) => (
          <g key={v}>
            <line x1={padL} x2={padL + plotW} y1={Y(v)} y2={Y(v)} stroke={colors.ink} strokeOpacity={0.12} strokeWidth={1} />
            <text x={padL + plotW + 10} y={Y(v) + 6} fontFamily={fonts.mono} fontSize={17} fill={colors.pencil}>
              {v.toLocaleString("en-US")}
            </text>
          </g>
        ))}
        {xLabels.map(([i, t]) => (
          <text key={t} x={X(i)} y={h - 14} textAnchor="middle" fontFamily={fonts.mono} fontSize={16} fill={colors.pencil}>
            {t}
          </text>
        ))}
        {/* history candles, one after another */}
        {candles.slice(0, 33).map((c, i) => (
          <Cndl key={i} c={c} i={i} grow={prog(f, at + i * per, 8)} />
        ))}
        {f >= buyAt && <Cndl c={live33} i={33} emph />}
        {f >= closeAt + 40 && <Cndl c={live34} i={34} emph />}
        {/* entry level */}
        <line x1={padL} x2={padL + plotW * entryP} y1={Y(entry)} y2={Y(entry)} stroke={colors.blue} strokeWidth={2.5} strokeDasharray="10 8" />
        {/* average entry level */}
        <line x1={padL} x2={padL + plotW * avgP} y1={Y(avg)} y2={Y(avg)} stroke={colors.gold} strokeWidth={2.5} strokeDasharray="10 8" />
        {/* last-price tag */}
        <g opacity={prog(f, at + 6, 10)}>
          <rect x={padL + plotW + 4} y={tagY - 15} width={padR - 10} height={30} rx={5} fill={colors.ink} />
          <text x={padL + plotW + 4 + (padR - 10) / 2} y={tagY + 6} textAnchor="middle" fontFamily={fonts.mono} fontWeight={700} fontSize={16} fill={colors.paper}>
            {curPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </text>
        </g>
        {/* markers */}
        <g opacity={prog(f, at, 12)}>
          <circle cx={X(0)} cy={Y(entry)} r={8} fill={colors.blue} stroke={colors.paper} strokeWidth={2} />
        </g>
        <g opacity={prog(f, buyAt + 22, 12)}>
          <circle cx={X(33)} cy={Y(buy)} r={8} fill={colors.blue} stroke={colors.paper} strokeWidth={2} />
          <line x1={X(33)} x2={X(33)} y1={Y(buy) + 10} y2={Y(3_885) - 16} stroke={colors.blue} strokeWidth={1.5} strokeDasharray="4 5" />
        </g>
        <g opacity={prog(f, closeAt + 34, 12)}>
          <circle cx={X(33)} cy={Y(closeNew)} r={8} fill={colors.green} stroke={colors.paper} strokeWidth={2} />
        </g>
        <g opacity={prog(f, closeAt + 68, 12)}>
          <circle cx={X(34)} cy={Y(closeOld)} r={8} fill={colors.green} stroke={colors.paper} strokeWidth={2} />
        </g>
      </svg>
      {/* handwritten labels, placed off the price action */}
      <div style={{ position: "absolute", left: padL + 14, top: Y(entry) - 36, fontFamily: fonts.hand, fontWeight: 700, fontSize: 27, color: colors.blue, opacity: entryP, whiteSpace: "nowrap" }}>
        ① bought 1.15 lots · {entry.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </div>
      <div style={{ position: "absolute", left: padL + 14, top: Y(avg) + 6, fontFamily: fonts.hand, fontWeight: 700, fontSize: 27, color: colors.gold, opacity: avgP, whiteSpace: "nowrap" }}>
        average entry · {avg.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div style={{ position: "absolute", right: padR + 20, top: Y(3_885) - 14, fontFamily: fonts.hand, fontWeight: 700, fontSize: 27, color: colors.blue, opacity: prog(f, buyAt + 22, 14), whiteSpace: "nowrap", textAlign: "right" }}>
        ② bought 5.75 lots · {buy.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </div>
      <div style={{ position: "absolute", right: padR + 40, top: Y(closeNew) - 70, fontFamily: fonts.hand, fontWeight: 700, fontSize: 27, color: colors.green, opacity: prog(f, closeAt + 34, 14), whiteSpace: "nowrap", textAlign: "right", lineHeight: 1.05 }}>
        ③ both closed
        <br />
        {closeNew.toLocaleString("en-US", { minimumFractionDigits: 2 })} · {closeOld.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </div>
      <div style={{ position: "absolute", left: padL + 24, top: Y(4_030), width: 330, fontFamily: fonts.hand, fontWeight: 600, fontSize: 27, color: colors.pencil, opacity: interpolate(f, [at + 14 * per, at + 14 * per + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), lineHeight: 1.1 }}>
        gold moved lower · position kept open, waiting for the market
      </div>
    </div>
  );
};
