/*
 * Fetches World Cup match scores from football-data.org (free tier) and writes
 * them to live.json. Runs in GitHub Actions on a schedule — NOT in the browser.
 *
 * Requires env var FOOTBALL_DATA_TOKEN (a free API key from football-data.org),
 * stored as a GitHub repo secret.
 */
import { writeFileSync, readFileSync } from "node:fs";

const TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!TOKEN) {
  console.error("Missing FOOTBALL_DATA_TOKEN env var.");
  process.exit(1);
}

// Window: yesterday .. tomorrow (catches finished + upcoming, UTC).
const day = (offset) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const url = `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${day(-4)}&dateTo=${day(2)}`;

async function main() {
  const res = await fetch(url, { headers: { "X-Auth-Token": TOKEN } });
  if (!res.ok) {
    console.error(`API error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();

  const matches = (data.matches || []).map((m) => ({
    home: m.homeTeam?.shortName || m.homeTeam?.name || "TBD",
    away: m.awayTeam?.shortName || m.awayTeam?.name || "TBD",
    status: m.status, // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED
    homeScore: m.score?.fullTime?.home ?? null,
    awayScore: m.score?.fullTime?.away ?? null,
    utcDate: m.utcDate,
  }));

  const out = { updatedAt: new Date().toISOString(), matches };
  const json = JSON.stringify(out, null, 2);

  // Only report a change if content actually differs (lets the workflow skip empty commits).
  let prev = "";
  try { prev = readFileSync("live.json", "utf8"); } catch {}
  const prevMatches = prev ? JSON.stringify(JSON.parse(prev).matches) : "";
  if (prevMatches === JSON.stringify(matches)) {
    console.log("No score changes.");
    writeFileSync("live.json", json); // still refresh updatedAt locally; workflow checks git diff
    process.exit(0);
  }

  writeFileSync("live.json", json);
  console.log(`Wrote ${matches.length} matches to live.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
