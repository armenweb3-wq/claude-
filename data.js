/*
 * ==========================================================================
 *  EDIT THIS FILE EACH DAY — it is the only file you need to touch.
 * ==========================================================================
 *
 *  How to log a new bet:
 *   1. Copy one of the blocks inside "bets" below.
 *   2. Fill in leg number, date, match, your selections, stake, odds.
 *   3. Set result to "won", "lost", or "pending".
 *   4. When it settles, set returnAmount = stake * odds (for a win) or 0 (loss).
 *   5. Update "todaysPick" with the next recommendation.
 *   6. Save, commit, push — the live site updates automatically.
 *
 *  The stake of the next bet should equal the returnAmount of the last win
 *  (that is what "compounding" means here).
 */

window.BETTING_DATA = {
  startingBankroll: 340,
  currency: "€",
  targetLegs: 17,
  targetMultiplierPerLeg: 1.4,

  // ---- Settled + pending bets, in order ----
  bets: [
    {
      leg: 1,
      date: "2026-06-11",
      match: "Mexico vs South Africa",
      selections: [
        "1X double chance (Mexico or draw)",
        "Over 0.5 goals",
        "Raúl Jiménez — shot on target",
      ],
      stake: 340.0,
      odds: 1.44,
      result: "won",        // "won" | "lost" | "pending"
      returnAmount: 489.60, // stake * odds on a win, 0 on a loss
    },
    {
      leg: 2,
      date: "2026-06-12",
      match: "Canada vs Bosnia & Herzegovina",
      selections: [
        "Over 0.5 goals",
        "Bosnia over 1.5 corners",
        "Over 1.5 total cards",
      ],
      stake: 489.60,
      odds: 1.39,
      result: "won",
      returnAmount: 680.54,
    },
    {
      leg: 3,
      date: "2026-06-13",
      match: "Qatar vs Switzerland",
      selections: [
        "Switzerland win",
        "Switzerland over 0.5 first-half corner",
        "Over 0.5 cards",
      ],
      stake: 680.54,
      odds: 1.40,
      result: "won",
      returnAmount: 952.76,
    },
    // ---- Next leg: copy this block, fill it in, change result to "pending" ----
    // {
    //   leg: 4,
    //   date: "2026-06-14",
    //   match: "Team A vs Team B",
    //   selections: ["...", "...", "..."],
    //   stake: 952.76,
    //   odds: 1.40,
    //   result: "pending",
    //   returnAmount: 0,
    // },
  ],

  // ---- Today's recommendation shown at the top of the site ----
  todaysPick: {
    headline: "Leg 4 — Germany vs Curaçao (14 Jun)",
    match: "Germany vs Curaçao",
    market: "Goals + corners combo on the favourite (analysis-driven, NOT bookmaker-led)",
    rationale:
      "Clearest mismatch of the day. Germany play possession + wide/crossing football; " +
      "Curaçao (smallest nation ever at a World Cup) will sit in a deep low block, " +
      "which forces sustained pressure -> goals and corners pile up. Germany must win to " +
      "keep pace in the group. Suggested 3-fold to reach ~1.40: Germany to win + Over 1.5 " +
      "total goals + Germany over 4.5 team corners. AVOID card legs here — a one-sided game " +
      "rarely turns fractious, so cards are the weakest selection in this fixture.",
    backups: [
      "Backup A: Sweden vs Tunisia — Over total cards (Tunisia are physical/defensive, tighter game) + Sweden DNB",
      "Backup B: Netherlands vs Japan — Over 1.5 goals + Netherlands DNB (higher variance: Japan are dangerous on the break)",
    ],
  },
};
