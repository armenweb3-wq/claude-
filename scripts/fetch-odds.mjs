/*
 * Multi-sport odds fetcher — The Odds API (the-odds-api.com).
 * Runs in GitHub Actions; key is the secret ODDS_API_KEY (never committed).
 * Writes upcoming events + best decimal H2H odds per sport to odds.json.
 *
 * QUOTA: free tier = 500 requests/month. Each sport key = 1 request per run.
 * Keep the schedule conservative (see odds.yml).
 */
import { writeFileSync } from "node:fs";

const KEY = process.env.ODDS_API_KEY;
if (!KEY) { console.error("Missing ODDS_API_KEY"); process.exit(1); }

// category -> list of The Odds API sport keys (out-of-season keys just return nothing)
// FOOTBALL / WORLD CUP ONLY for now (1 request/run = tiny quota use).
// Other sports + leagues are kept here, commented, to switch on later.
const SPORTS = {
  football: [
    "soccer_fifa_world_cup",
    // "soccer_epl", "soccer_uefa_champs_league", "soccer_spain_la_liga",
    // "soccer_germany_bundesliga", "soccer_italy_serie_a",
  ],
  tennis: [
    // "tennis_atp_wimbledon", "tennis_wta_wimbledon", "tennis_atp_us_open", "tennis_wta_us_open",
  ],
  basketball: [/* "basketball_nba" */],
  nfl: [/* "americanfootball_nfl" */],
  mma: [/* "mma_mixed_martial_arts" */],
};

async function fetchSport(sportKey) {
  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${KEY}&regions=eu&markets=h2h&oddsFormat=decimal`;
  const res = await fetch(url);
  const remaining = res.headers.get("x-requests-remaining");
  if (!res.ok) { console.error(`${sportKey}: HTTP ${res.status}`); return { events: [], remaining }; }
  const data = await res.json();
  const events = (data || []).map((ev) => {
    const best = {};
    for (const bk of ev.bookmakers || []) {
      const mkt = (bk.markets || []).find((m) => m.key === "h2h");
      if (!mkt) continue;
      for (const o of mkt.outcomes || []) {
        if (!best[o.name] || o.price > best[o.name]) best[o.name] = o.price;
      }
    }
    return { id: ev.id, sportKey, home: ev.home_team, away: ev.away_team, commence: ev.commence_time, best };
  });
  return { events, remaining };
}

async function main() {
  const out = { updatedAt: new Date().toISOString(), remaining: null, sports: {} };
  for (const [cat, keys] of Object.entries(SPORTS)) {
    out.sports[cat] = [];
    for (const k of keys) {
      try {
        const { events, remaining } = await fetchSport(k);
        if (remaining != null) out.remaining = remaining;
        out.sports[cat].push(...events);
      } catch (e) { console.error(k, e.message); }
    }
    out.sports[cat].sort((a, b) => new Date(a.commence) - new Date(b.commence));
    console.log(`${cat}: ${out.sports[cat].length} events`);
  }
  writeFileSync("odds.json", JSON.stringify(out, null, 2));
  console.log("odds.json written. Requests remaining:", out.remaining);
}
main().catch((e) => { console.error(e); process.exit(1); });
