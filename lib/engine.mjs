/*
 * Core money logic — pure, dependency-free, unit-tested (see test/engine.test.mjs).
 * Used by the autopilot; the browser app mirrors the same rules.
 */
export const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function side(m, team) {
  const t = norm(team);
  if (!t) return null;
  if (norm(m.home).includes(t) || t.includes(norm(m.home))) return "home";
  if (norm(m.away).includes(t) || t.includes(norm(m.away))) return "away";
  return null;
}

// One selection -> true (won) | false (lost) | null (undecided / unknown market)
export function legResult(sel, m) {
  if (!sel || typeof sel === "string") return null;
  if (!m || m.status !== "FINISHED" || m.homeScore == null || m.awayScore == null) return null;
  const hs = m.homeScore, as = m.awayScore, tot = hs + as;
  switch (sel.type) {
    case "over_goals": return tot > sel.line;
    case "under_goals": return tot < sel.line;
    case "btts": return hs > 0 && as > 0;
    case "team_win": { const s = side(m, sel.team); return s ? (s === "home" ? hs > as : as > hs) : null; }
    case "double_chance": { const s = side(m, sel.team); return s ? (s === "home" ? hs >= as : as >= hs) : null; }
    case "draw": return hs === as;
    case "no_draw": return hs !== as;
    default: return null; // corners/cards/shots/other = manual, can't auto-settle
  }
}

// A combo wins only if EVERY selection wins. Returns "won" | "lost" | null (not all decidable).
export function betResult(selections, m) {
  const rs = (selections || []).map((s) => legResult(s, m));
  if (!rs.length || rs.some((r) => r === null)) return null;
  return rs.every((r) => r === true) ? "won" : "lost";
}

// Arbitrage / Dutching split for equal payout across outcomes.
export function arb(odds, stake) {
  const inv = odds.map((o) => 1 / o);
  const sum = inv.reduce((a, b) => a + b, 0);
  const stakes = inv.map((i) => stake * i / sum);
  const ret = stake / sum;
  return { sum, stakes, ret, profit: ret - stake, roi: (ret - stake) / stake * 100, isArb: sum < 1 };
}

// Total stake required to net `target` profit (only possible if a true arb exists).
export function targetStake(odds, target) {
  const sum = odds.reduce((a, o) => a + 1 / o, 0);
  if (sum >= 1) return null;
  return target * sum / (1 - sum);
}

// Compound a run: returns final bankroll given start + ordered settled legs.
export function compound(start, legs) {
  let bank = start;
  for (const b of legs) {
    if (b.result === "won") bank = Math.round(bank * b.odds * 100) / 100;
    else if (b.result === "lost") return 0;
  }
  return bank;
}

// Flat/level staking: each bet risks its own stake; a loss only dents the bankroll.
// won  -> +stake*(odds-1) ; lost -> -stake. Survives variance (never all-in).
export function flatBankroll(start, bets) {
  let bank = start;
  for (const b of bets) {
    if (b.result === "won") bank += b.stake * (b.odds - 1);
    else if (b.result === "lost") bank -= b.stake;
  }
  return Math.round(bank * 100) / 100;
}
