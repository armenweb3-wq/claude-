/*
 * AI autopilot — runs in GitHub Actions every 5 min (after fetch-scores).
 * It self-drives the "🤖 AI (Claude)" track with NO human input:
 *   1) settles the AI's pending bet from the finished score, then
 *   2) auto-picks the next bet (Over 1.5 goals on the next upcoming match),
 *      compounding the stake.
 * Strategy: 17 legs, ~1.40 odds each, single mainstream market (always placeable).
 */
import { readFileSync, writeFileSync } from "node:fs";

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const track = JSON.parse(readFileSync("ai-track.json", "utf8"));
let matches = [];
try { matches = (JSON.parse(readFileSync("live.json", "utf8")).matches) || []; } catch {}

const matchFor = (name) => {
  const parts = norm(name).split(/\s+vs\.?\s+|\s+-\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return matches.find((m) => parts.every((p) =>
    norm(m.home).includes(p) || norm(m.away).includes(p) || p.includes(norm(m.home)) || p.includes(norm(m.away))));
};

const bets = track.bets || (track.bets = []);
let changed = false;

// 1) settle the pending bet (AI only bets Over <line> total goals)
const pending = bets.find((b) => b.result === "pending");
if (pending) {
  const m = matchFor(pending.match);
  if (m && m.status === "FINISHED" && m.homeScore != null && m.awayScore != null) {
    const line = (pending.selections[0] && pending.selections[0].line) || 1.5;
    const won = (m.homeScore + m.awayScore) > line;
    pending.result = won ? "won" : "lost";
    pending.returnAmount = won ? Math.round(pending.stake * pending.odds * 100) / 100 : 0;
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

// 2) auto-pick the next bet
if (!lost && !hasPending && wins < target && bankroll > 0) {
  const now = Date.now();
  const used = new Set(bets.map((b) => norm(b.match)));
  const next = matches
    .filter((m) => (m.status === "TIMED" || m.status === "SCHEDULED") && m.utcDate && new Date(m.utcDate).getTime() > now + 5 * 60000)
    .filter((m) => !used.has(norm(m.home + " vs " + m.away)))
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))[0];
  if (next) {
    bets.push({
      leg: bets.length + 1,
      date: new Date(next.utcDate).toISOString().slice(0, 10),
      match: next.home + " vs " + next.away,
      selections: [{ label: "Over 1.5 total goals", type: "over_goals", line: 1.5 }],
      stake: Math.round(bankroll * 100) / 100,
      odds: 1.40,
      result: "pending",
      returnAmount: 0,
      auto: true,
    });
    changed = true;
    console.log(`Placed leg ${bets.length} (${next.home} vs ${next.away})`);
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
} else {
  console.log("No AI change.");
}
