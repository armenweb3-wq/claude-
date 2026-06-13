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
 *   5. Update "picks.today" / "picks.tomorrow" with fresh recommendations.
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
 *  A pending bet auto-marks LOST the moment any auto leg misses, and WON only
 *  when all auto legs hit AND there are no manual legs left to confirm.
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
      // STILL IN PLAY — auto-settles at full time. "Switzerland win" only counts
      // once the final whistle goes; if Qatar equalises this leg (and the bet) dies.
      leg: 3,
      date: "2026-06-13",
      match: "Qatar vs Switzerland",
      selections: [
        { label: "Switzerland to win", type: "team_win", team: "Switzerland" },
        { label: "Switzerland over 0.5 first-half corner", type: "corners", manual: true },
        { label: "Over 0.5 cards", type: "cards", manual: true },
      ],
      stake: 680.54,
      odds: 1.40,
      result: "pending",
      returnAmount: 0,
    },
  ],

  // ---- Daily recommendations (risk-rated, expandable; Today / Tomorrow toggle) ----
  //  candidates[0] is the top pick (⭐). risk: "low" | "medium" | "high".
  picks: {
    today: {
      date: "2026-06-13",
      candidates: [
        {
          match: "Haiti vs Scotland",
          risk: "low",
          market: "Scotland Double Chance (draw or Scotland win) + over corners",
          summary: "Safest profile on tonight's slate while you wait on the Switzerland leg.",
          why:
            "Scotland are a settled European side facing World Cup debutants Haiti; they should " +
            "control possession and territory, which also feeds corners. 'Not losing' is a low bar here.",
          whyRisk:
            "Low — but debutant minnows often defend very deep and Scotland aren't prolific, so back " +
            "Double Chance (not a straight win) and keep the corners line modest. A nervy 0-0 is the worst case.",
        },
        {
          match: "Brazil vs Morocco",
          risk: "medium",
          market: "Over 1.5 total goals + Brazil over 4.5 corners",
          summary: "Earliest kickoff tonight; lean on goals/corners, NOT on a Brazil win.",
          why:
            "Brazil's possession and wing play against a deeper Morocco block should generate corners, " +
            "and the overall quality points to goals.",
          whyRisk:
            "Medium — Morocco were 2022 semi-finalists: elite defensively and lethal on the counter. " +
            "A 'Brazil to win' leg would be HIGH risk (they can be held or upset), so stay on goals/corners.",
        },
        {
          match: "Australia vs Turkey",
          risk: "medium",
          market: "Turkey Double Chance + over 1.5 goals",
          summary: "Overnight kickoff — only if you want a third option.",
          why: "Turkey are the stronger, more attacking side and shouldn't lose to Australia.",
          whyRisk:
            "Medium — Australia are physical and well-drilled and can grind out a draw; a cagey, " +
            "low-scoring game would threaten the goals leg.",
        },
      ],
    },
    tomorrow: {
      date: "2026-06-14",
      candidates: [
        {
          match: "Germany vs Curaçao",
          risk: "low",
          market: "Germany win + Over 1.5 goals + Germany over 4.5 corners (~1.40 combo)",
          summary: "The clearest mismatch of the weekend — the safest leg available.",
          why:
            "Germany are a possession + wide/crossing side; Curaçao (the smallest nation ever at a " +
            "World Cup) will defend a deep low block, which reliably produces goals AND corners for the " +
            "favourite. Germany must win to keep pace in the group.",
          whyRisk:
            "Lowest risk on the board, but NOT risk-free: still a 3-leg combo, minnows can frustrate for " +
            "~60 mins, and the corners leg is manual. Avoid adding cards — a one-sided game rarely turns fractious.",
        },
        {
          match: "Sweden vs Tunisia",
          risk: "medium",
          market: "Over total cards + Sweden Double Chance (1X)",
          summary: "Cards-led angle in a tighter, more physical game.",
          why:
            "Tunisia are organised, physical and defensive; Sweden must break them down. That clash tends " +
            "to mean fouls and bookings, and Sweden are unlikely to lose outright.",
          whyRisk:
            "Medium — cards depend heavily on the referee (check the assignment first) and a tight game can " +
            "stay clean. The 1X leg is solid; the cards leg is the variable, and it's manual.",
        },
        {
          match: "Netherlands vs Japan",
          risk: "high",
          market: "Over 1.5 goals + Netherlands DNB",
          summary: "More variance — only if the safer options aren't at ~1.40.",
          why: "Netherlands should control and create chances; over 1.5 goals is reasonable and DNB protects vs a draw.",
          whyRisk:
            "High — Japan are genuinely dangerous on the break and well-organised, capable of a low-scoring " +
            "upset or a 1-0 either way, which threatens BOTH legs.",
        },
        {
          match: "Ivory Coast vs Ecuador",
          risk: "high",
          market: "Over total cards",
          summary: "Avoid unless you specifically want a cards punt with a card-heavy referee.",
          why: "Two physical, athletic sides in an even group game — the profile for fouls.",
          whyRisk:
            "High — evenly matched means the result is a coin-flip (no safe win/DC leg) and the cards total " +
            "still hinges on the referee. Too many unknowns for a streak you can't afford to break.",
        },
      ],
    },
  },
};
