/*
 * Autopilot — runs in GitHub Actions every 5 min (after fetch-scores).
 * Self-drives the automated runs with NO human input:
 *   1) settles each run's pending bet from the finished score, then
 *   2) auto-picks the next bet from that run's curated queue (compounding),
 *      with a safe fallback so the chain never stalls.
 *
 * Runs driven:
 *   - ai-track.json  + picks.json   (Model: 17 legs, ~1.40)
 *   - ai2-track.json + picks2.json  (AI 2.0: 10 legs, ~2.00)
 */
import { readFileSync, writeFileSync } from "node:fs";

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const read = (f, d) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };

const matches = (read("live.json", { matches: [] }).matches) || [];

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

function processTrack(trackFile, queueFile, fallbackOdds) {
  const track = read(trackFile, null);
  if (!track) { console.log(`skip ${trackFile} (missing)`); return; }
  const queue = (read(queueFile, { picks: [] }).picks) || [];
  const bets = track.bets || (track.bets = []);
  let changed = false;

  // 1) settle pending
  const pending = bets.find((b) => b.result === "pending");
  if (pending) {
    const r = legResult(pending.selections[0], matchFor(pending.match));
    if (r !== null) {
      pending.result = r ? "won" : "lost";
      pending.returnAmount = r ? Math.round(pending.stake * pending.odds * 100) / 100 : 0;
      changed = true;
      console.log(`${trackFile}: settled leg ${pending.leg} (${pending.match}) -> ${pending.result}`);
    }
  }

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

  // 2) auto-pick next — curated queue first, then fallback
  if (!lost && !hasPending && wins < target && bankroll > 0) {
    let pick = null, m = null;
    const cands = queue.map((p) => ({ p, m: matchFor(p.match) }))
      .filter((x) => upcoming(x.m) && !used.has(norm(x.p.match)))
      .sort((a, b) => new Date(a.m.utcDate) - new Date(b.m.utcDate));
    if (cands.length) { pick = cands[0].p; m = cands[0].m; }
    if (!pick) {
      m = matches.filter((x) => upcoming(x) && !used.has(norm(x.home + " vs " + x.away)))
        .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))[0];
      if (m) pick = { match: m.home + " vs " + m.away, selection: fallbackOdds.sel, odds: fallbackOdds.odds };
    }
    if (pick && m) {
      bets.push({
        leg: bets.length + 1,
        date: new Date(m.utcDate).toISOString().slice(0, 10),
        match: pick.match,
        selections: [pick.selection],
        stake: Math.round(bankroll * 100) / 100,
        odds: pick.odds || fallbackOdds.odds,
        result: "pending", returnAmount: 0, auto: true, curated: cands.length > 0,
      });
      changed = true;
      console.log(`${trackFile}: placed leg ${bets.length} (${pick.match})`);
    }
  }

  const newStatus = lost ? "busted" : (wins >= target ? "won" : "active");
  if (newStatus !== track.status) { track.status = newStatus; changed = true; }
  if (changed) { track.updatedAt = new Date().toISOString(); writeFileSync(trackFile, JSON.stringify(track, null, 2)); }
  else console.log(`${trackFile}: no change`);
}

// Model: fallback Over 1.5 @1.40 ; AI 2.0: fallback Over 2.5 @2.00
processTrack("ai-track.json", "picks.json", { sel: { label: "Over 1.5 total goals", type: "over_goals", line: 1.5 }, odds: 1.40 });
processTrack("ai2-track.json", "picks2.json", { sel: { label: "Over 2.5 total goals", type: "over_goals", line: 2.5 }, odds: 2.00 });
