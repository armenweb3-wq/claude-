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
 *   5. Update "todaysPick.candidates" with the next day's recommendations.
 *   6. Save, commit, push — the live site updates automatically.
 *
 *  The stake of the next bet should equal the returnAmount of the last win
 *  (that is what "compounding" means here).
 *
 *  SELECTIONS can be plain strings (display only) OR structured objects so the
 *  site can AUTO-SETTLE them from the live score. Structured types:
 *    { label, type:"team_win",      team:"Germany" }   // team to win
 *    { label, type:"double_chance", team:"Sweden"  }   // win OR draw (1X / X2)
 *    { label, type:"over_goals",    line:1.5       }   // total goals over line
 *    { label, type:"under_goals",   line:3.5       }
 *    { label, type:"btts" }                            // both teams to score
 *    { label, type:"corners", manual:true }            // NOT in free feed ->
 *    { label, type:"cards",   manual:true }            //   confirmed manually
 *  A pending bet auto-marks LOST if any auto leg misses, and WON only when all
 *  auto legs hit AND there are no manual legs left to confirm.
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
      result: "won",
      returnAmount: 489.60,
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
    // ---- Next leg template (structured = auto-settles). Uncomment when placed: ----
    // {
    //   leg: 4,
    //   date: "2026-06-14",
    //   match: "Germany vs Curaçao",
    //   selections: [
    //     { label: "Germany to win",        type: "team_win",  team: "Germany" },
    //     { label: "Over 1.5 total goals",  type: "over_goals", line: 1.5 },
    //     { label: "Germany over 4.5 corners", type: "corners", manual: true },
    //   ],
    //   stake: 952.76,
    //   odds: 1.40,
    //   result: "pending",
    //   returnAmount: 0,
    // },
  ],

  // ---- Daily recommendations (risk-rated, expandable on the site) ----
  //  candidates[0] is the top pick (⭐). risk: "low" | "medium" | "high".
  todaysPick: {
    date: "2026-06-14",
    candidates: [
      {
        match: "Germany vs Curaçao",
        risk: "low",
        market: "Germany win + Over 1.5 goals + Germany over 4.5 corners (~1.40 combo)",
        summary: "The clearest mismatch on the day's card — the safest profile for the next leg.",
        why:
          "Germany are a possession + wide/crossing side; Curaçao (the smallest nation ever at a " +
          "World Cup) will defend a deep low block. That forces sustained pressure, which reliably " +
          "produces goals AND corners for the favourite. Germany also must win to keep pace in the group.",
        whyRisk:
          "Lowest risk of the four, but NOT risk-free: it's still a 3-leg combo, so every leg must " +
          "land. Minnows can occasionally frustrate for ~60 mins, and the corners leg can't be " +
          "auto-verified. Avoid adding a cards leg — a one-sided game rarely turns fractious.",
      },
      {
        match: "Sweden vs Tunisia",
        risk: "medium",
        market: "Over total cards + Sweden Double Chance (1X)",
        summary: "Cards-led angle in a tighter, more physical game.",
        why:
          "Tunisia are organised, physical and defensive; Sweden will have to break them down. " +
          "That style clash tends to mean fouls and bookings, and Sweden are unlikely to lose outright.",
        whyRisk:
          "Medium risk: cards depend heavily on the referee (check the assignment first) and a tight " +
          "game can stay clean. The 1X leg is solid but the cards leg is the variable — and it's manual.",
      },
      {
        match: "Netherlands vs Japan",
        risk: "high",
        market: "Over 1.5 goals + Netherlands DNB",
        summary: "More variance — only if the safer options aren't available at ~1.40.",
        why:
          "Netherlands should control and create chances; over 1.5 goals is a reasonable lean and DNB " +
          "protects against a draw.",
        whyRisk:
          "High risk: Japan are genuinely dangerous on the break and well-organised — capable of a " +
          "low-scoring upset or a 1-0 either way, which threatens BOTH legs. Not a 'safe' compounding leg.",
      },
      {
        match: "Ivory Coast vs Ecuador",
        risk: "high",
        market: "Over total cards",
        summary: "Avoid unless you specifically want a cards punt with a card-heavy referee.",
        why:
          "Two physical, athletic sides in a competitive, evenly-matched group game — the profile for fouls.",
        whyRisk:
          "High risk: evenly matched means the result is a coin-flip (so no safe win/DC leg), and the " +
          "cards total still hinges on the referee. Lots of unknowns for a streak you can't afford to break.",
      },
    ],
  },
};
