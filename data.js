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
          ],
          stake: 725, odds: 1.45, // Germany 7-1 = 8 goals -> WON
          result: "won", returnAmount: 1051.25,
        },
        {
          leg: 3, date: "2026-06-15", match: "Belgium vs Egypt",
          selections: [
            { label: "Over 1.5 total goals", type: "over_goals", line: 1.5 },
          ],
          stake: 1051.25, odds: 1.40, // single market, kicks off 19:00 UTC
          result: "pending", returnAmount: 0,
        },
      ],
    },

    {
      // NEW STRATEGY: 6 games, ~2.0 odds each, compounding (Bet Builder slips allowed).
      // Higher risk than the 1.4 plan. Game 1 = the Germany-Curaçao 5-leg builder.
      id: 5,
      label: "🎯 6×€2 Strategy",
      keepLabel: true,
      startingBankroll: 250,
      targetLegs: 6,
      targetMultiplierPerLeg: 2.0,
      status: "busted", // Game 1 lost (cards 0, fouls 11 in the 7-1 blowout)
      bets: [
        {
          leg: 1, date: "2026-06-14", match: "Germany vs Curaçao",
          selections: [
            { label: "Over 6.5 total corners (9 ✓)", type: "corners", manual: true },
            { label: "Over 1.5 total cards (0 ✗)", type: "cards", manual: true },
            { label: "Over 0.5 first-half goal (✓)", type: "other", manual: true },
            { label: "Germany over 1.5 first-half corners (✓)", type: "corners", manual: true },
            { label: "Over 15.5 total fouls (11 ✗)", type: "other", manual: true },
          ],
          stake: 250, odds: 2.05, // Germany 7-1: corners hit, but cards & fouls missed -> LOST
          result: "lost", returnAmount: 0,
        },
      ],
    },
  ],

  // ---- Daily recommendations: ONE mainstream market per match (placeable
  //  everywhere; combine single legs across DIFFERENT matches to reach ~1.4).
  //  Never two markets on the same game in a normal bet — that's what gets refused.
  picks: {
    today: {
      date: "2026-06-15",
      candidates: [
        {
          match: "Belgium vs Egypt", risk: "medium",
          market: "SINGLE MARKET → Over 1.5 total goals  (~1.35-1.45)",
          summary: "19:00 UTC. The AI track is also on this one.",
          why: "Belgium have the attacking quality to push this past one goal; Egypt also carry a threat through Salah.",
          whyRisk: "Medium — Egypt are organised and can keep it tight; a 1-0 either way kills an over-1.5.",
        },
        {
          match: "Saudi Arabia vs Uruguay", risk: "medium",
          market: "SINGLE MARKET → Uruguay Double Chance (win or draw)  (~1.30-1.45)",
          summary: "22:00 UTC. One market — combines freely.",
          why: "Uruguay are the clearly stronger side and shouldn't lose to Saudi Arabia.",
          whyRisk: "Medium — Saudi can be awkward and physical; a draw is fine for DC but a shock loss isn't.",
        },
        {
          match: "France vs Senegal", risk: "medium",
          market: "SINGLE MARKET → Over 1.5 total goals  (16 Jun)",
          summary: "Heads-up for tomorrow — two strong attacking sides.",
          why: "France's firepower vs a quality Senegal side points to goals.",
          whyRisk: "Medium — Senegal are well-drilled and could make it a cagey, low-scoring battle.",
        },
      ],
    },
  },
};
