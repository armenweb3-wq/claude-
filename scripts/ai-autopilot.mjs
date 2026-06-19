/*
 * AI autopilot — runs in GitHub Actions every 5 min (after fetch-scores).
 * Self-drives the "🤖 AI (Claude)" track with NO human input:
 *   1) settles the AI's pending bet from the finished score, then
 *   2) auto-picks the next bet FROM THE CURATED QUEUE (picks.json) — the next
 *      curated pick whose match is upcoming and not yet bet — compounding the stake.
 *      If the queue has nothing upcoming, it falls back to "Over 1.5 on the next
 *      match" so the chain never stalls.
 */
import { readFileSync, writeFileSync } from "node:fs";

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const read = (f, d) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };

const track = read("ai-track.json", null);
if (!track) { console.error("no ai-track.json"); process.exit(0); }
const matches = (read("live.json", { matches: [] }).matches) || [];
const queue = (read("picks.json", { picks: [] }).picks) || [];

const matchFor = (name) => {
  const parts = norm(name).split(/\s+vs\.?\s+|\s+-\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return matches.find((m) => parts.every((p) =>
    norm(m.home).includes(p) || norm(m.away).includes(p) || p.includes(norm(m.home)) || p.includes(norm(m.away))));
};
const side = (m, team) => {
  const t = norm(team); if (!t) return null;
  if (norm(m.home).includes(t) || t.includes(norm(m.home))) return "home";
  if (norm(m.away).includes(t) || t.includes(norm(m.away))) return "away";
  return null;
};
// returns true (won), false (lost), or null (can't settle yet / unknown market)
function legResult(sel, m) {
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
    default: return null;
  }
}

const bets = track.bets || (track.bets = []);
let changed = false;

// 1) settle the pending bet
const pending = bets.find((b) => b.result === "pending");
if (pending) {
  const r = legResult(pending.selections[0], matchFor(pending.match));
  if (r !== null) {
    pending.result = r ? "won" : "lost";
    pending.returnAmount = r ? Math.round(pending.stake * pending.odds * 100) / 100 : 0;
    changed = true;
    console.log(`Settled leg ${pending.leg} (${pending.match}): ${pending.result}`);
  }
}

// recompute state
const settled = bets.filter((b) => b.result === "won" || b.result === "lost");
const lost = settled.some((b) => b.result === "lost");
const wins = settled.filter((b) => b.result === "won").length;
let bankroll = track.startingBankroll;
for (const b of bets) { if (b.result === "won") bankroll = b.returnAmount; else if (b.result === "lost") { bankroll = 0; break; } }
const hasPending = bets.some((b) => b.result === "pending");
const target = track.targetLegs || 17;
const now = Date.now();
const used = new Set(bets.map((b) => norm(b.match)));
const upcoming = (m) => m && (m.status === "TIMED" || m.status === "SCHEDULED") && m.utcDate && new Date(m.utcDate).getTime() > now + 5 * 60000;

// 2) auto-pick the next bet — prefer the curated queue, then fall back
if (!lost && !hasPending && wins < target && bankroll > 0) {
  let pick = null, m = null;
  const cands = queue
    .map((p) => ({ p, m: matchFor(p.match) }))
    .filter((x) => upcoming(x.m) && !used.has(norm(x.p.match)))
    .sort((a, b) => new Date(a.m.utcDate) - new Date(b.m.utcDate));
  if (cands.length) { pick = cands[0].p; m = cands[0].m; }

  if (!pick) { // fallback: next upcoming match, Over 1.5 goals
    m = matches.filter((x) => upcoming(x) && !used.has(norm(x.home + " vs " + x.away)))
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))[0];
    if (m) pick = { match: m.home + " vs " + m.away, selection: { label: "Over 1.5 total goals", type: "over_goals", line: 1.5 }, odds: 1.40 };
  }

  if (pick && m) {
    bets.push({
      leg: bets.length + 1,
      date: new Date(m.utcDate).toISOString().slice(0, 10),
      match: pick.match,
      selections: [pick.selection],
      stake: Math.round(bankroll * 100) / 100,
      odds: pick.odds || 1.40,
      result: "pending", returnAmount: 0,
      auto: true, curated: cands.length > 0,
    });
    changed = true;
    console.log(`Placed leg ${bets.length} (${pick.match}) ${cands.length ? "[curated]" : "[fallback]"}`);
  } else {
    console.log("No upcoming match to pick yet.");
  }
}

const newStatus = lost ? "busted" : (wins >= target ? "won" : "active");
if (newStatus !== track.status) { track.status = newStatus; changed = true; }

if (changed) {
  track.updatedAt = new Date().toISOString();
  writeFileSync("ai-track.json", JSON.stringify(track, null, 2));
  console.log("ai-track.json updated.");
} else { console.log("No AI change."); }
