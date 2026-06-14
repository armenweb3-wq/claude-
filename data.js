/*
 * ==========================================================================
 *  EDIT THIS FILE EACH DAY — it is the only file you need to touch.
 * ==========================================================================
 *
 *  Structure: the streak is tracked in "attempts". Each attempt is one run at
 *  the 17-leg goal with its own bankroll. When a streak busts, start a new
 *  attempt (the Restart button on the site does this locally on your phone;
 *  to share it with friends, add a new attempt object here and push).
 *
 *  SELECTIONS can be plain strings (display only) OR structured objects so the
 *  site can AUTO-SETTLE them from the live score:
 *    { label, type:"team_win",      team:"Germany" }
 *    { label, type:"double_chance", team:"Sweden"  }   // win OR draw
 *    { label, type:"over_goals",    line:1.5       }
 *    { label, type:"under_goals",   line:3.5       }
 *    { label, type:"btts" }
 *    { label, type:"corners", manual:true }            // confirmed manually
 *    { label, type:"cards",   manual:true }
 */

window.BETTING_DATA = {
  currency: "€",
  targetLegs: 17,
  targetMultiplierPerLeg: 1.4,

  // ---- Each attempt = one run at the 17-leg goal. status: active|busted|won ----
  attempts: [
    {
      id: 1,
      label: "Attempt 1",
      startingBankroll: 340,
      status: "busted", // busted at leg 3 (Qatar 1-1 Switzerland, 90+4' equaliser)
      bets: [
        {
          leg: 1, date: "2026-06-11", match: "Mexico vs South Africa",
          selections: ["1X double chance (Mexico or draw)", "Over 0.5 goals", "Raúl Jiménez — shot on target"],
          stake: 340.0, odds: 1.44, result: "won", returnAmount: 489.60,
        },
        {
          leg: 2, date: "2026-06-12", match: "Canada vs Bosnia & Herzegovina",
          selections: ["Over 0.5 goals", "Bosnia over 1.5 corners", "Over 1.5 total cards"],
          stake: 489.60, odds: 1.39, result: "won", returnAmount: 680.54,
        },
        {
          leg: 3, date: "2026-06-13", match: "Qatar vs Switzerland",
          selections: [
            { label: "Switzerland to win", type: "team_win", team: "Switzerland" },
            { label: "Switzerland over 0.5 first-half corner", type: "corners", manual: true },
            { label: "Over 0.5 cards", type: "cards", manual: true },
          ],
          stake: 680.54, odds: 1.40,
          result: "lost",        // Qatar equalised 1-1 in stoppage time -> Switzerland win failed
          returnAmount: 0,
        },
      ],
    },
    // New attempts get added here (or created on your phone via the Restart button).
    {
      // Your live attempt — shared with the group. Tell me bets and I add them here.
      id: 3,
      label: "Attempt 2",
      startingBankroll: 340,
      status: "active",
      bets: [
        {
          leg: 1, date: "2026-06-13", match: "Brazil vs Morocco",
          selections: [
            { label: "Over 1.5 total goals", type: "over_goals", line: 1.5 },
            { label: "Over 4.5 corners", type: "corners", manual: true },
          ],
          stake: 340, odds: 1.40,
          result: "won", returnAmount: 476.00, // 1-1 = over 1.5 ✓; corners well over 4.5 ✓
        },
      ],
    },

    {
      // Claude's own parallel run — same 17-leg / 1.4x goal, separate €500 bankroll.
      // Picks are MY analysis, auto-settled from real scores so we can compare.
      id: 2,
      label: "🤖 AI (Claude)",
      owner: "AI",
      startingBankroll: 500,
      status: "active",
      bets: [
        {
          leg: 1, date: "2026-06-13", match: "Brazil vs Morocco",
          selections: [
            { label: "Over 1.5 total goals", type: "over_goals", line: 1.5 },
          ],
          stake: 500, odds: 1.45, // Brazil 1-1 Morocco = 2 goals -> WON
          result: "won", returnAmount: 725,
        },
        {
          leg: 2, date: "2026-06-14", match: "Germany vs Curaçao",
          selections: [
            { label: "Over 2.5 total goals", type: "over_goals", line: 2.5 },
            { label: "Germany over 5.5 corners", type: "corners", manual: true },
            { label: "Over 1.5 total cards", type: "cards", manual: true },
          ],
          stake: 725, odds: 1.45, // illustrative ~1.4 combo
          result: "pending", returnAmount: 0,
        },
      ],
    },
  ],

  // ---- Daily recommendations (risk-rated; Today / Tomorrow toggle) ----
  picks: {
    today: {
      date: "2026-06-14",
      candidates: [
        {
          match: "Germany vs Curaçao", risk: "low",
          market: "Over 2.5 goals + Germany over 4.5 corners (skip a Germany-win leg only if you want max safety)",
          summary: "Clearest mismatch of the day — the safest leg (kicks off 17:00 UTC).",
          why: "Germany (possession + wide play) vs Curaçao (smallest nation ever at a WC) defending deep reliably produces goals AND corners.",
          whyRisk: "Lowest risk on the board, but still multi-leg; a minnow can frustrate for ~60 mins and the corners leg is manual.",
        },
        {
          match: "Spain vs Cape Verde", risk: "low",
          market: "Spain win + Over 1.5 goals (or Spain over corners)",
          summary: "Second clear mismatch — Spain are elite vs WC debutants Cape Verde.",
          why: "Spain dominate possession and create high volume; Cape Verde will sit deep, feeding Spanish corners and chances.",
          whyRisk: "Low, but debutants can park the bus early; keep goal lines modest and avoid a big handicap.",
        },
        {
          match: "Belgium vs Egypt", risk: "medium",
          market: "Over 1.5 goals + Belgium Double Chance",
          summary: "Solid but not a gimme.",
          why: "Belgium have the attacking quality; over 1.5 is reasonable and DC covers a draw.",
          whyRisk: "Medium — Egypt with Salah are dangerous and well-organised; an upset or low-scoring game is live.",
        },
        {
          match: "Netherlands vs Japan", risk: "high",
          market: "Over 1.5 goals + Netherlands DNB",
          summary: "Higher variance — only if safer options aren't at ~1.40.",
          why: "Netherlands should control and create; over 1.5 reasonable, DNB covers a draw.",
          whyRisk: "High — Japan are dangerous on the break; a low-scoring upset threatens both legs.",
        },
      ],
    },
  },
};
