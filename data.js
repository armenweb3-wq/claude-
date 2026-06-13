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
          stake: 500, odds: 1.45, // odds illustrative (~1.4 target)
          result: "pending", returnAmount: 0,
        },
      ],
    },
  ],

  // ---- Daily recommendations (risk-rated; Today / Tomorrow toggle) ----
  picks: {
    today: {
      date: "2026-06-13",
      candidates: [
        {
          match: "Brazil vs Morocco", risk: "medium",
          market: "Over 1.5 total goals + Brazil over 4.5 corners",
          summary: "Lean on goals/corners, NOT a Brazil win.",
          why: "Brazil's possession and wing play vs a deeper Morocco block should generate corners and goals.",
          whyRisk: "Medium — Morocco (2022 semi-finalists) are elite defensively and lethal on the counter; a 'Brazil win' leg would be HIGH risk.",
        },
        {
          match: "Haiti vs Scotland", risk: "low",
          market: "Scotland Double Chance (draw or win) + over corners",
          summary: "Safest profile left on tonight's slate.",
          why: "Scotland are a settled side vs debutants Haiti; they should control the ball and territory.",
          whyRisk: "Low — but debutants defend deep and Scotland aren't prolific, so back Double Chance, not a straight win.",
        },
        {
          match: "Australia vs Turkey", risk: "medium",
          market: "Turkey Double Chance + over 1.5 goals",
          summary: "Overnight kickoff — third option.",
          why: "Turkey are stronger and more attacking and shouldn't lose to Australia.",
          whyRisk: "Medium — Australia are physical and can grind a draw; a cagey game threatens the goals leg.",
        },
      ],
    },
    tomorrow: {
      date: "2026-06-14",
      candidates: [
        {
          match: "Germany vs Curaçao", risk: "low",
          market: "Germany win + Over 1.5 goals + Germany over 4.5 corners (~1.40 combo)",
          summary: "The clearest mismatch of the weekend — the safest leg available.",
          why: "Germany (possession + wide play) vs Curaçao (smallest nation ever at a WC) defending deep reliably produces goals AND corners.",
          whyRisk: "Lowest risk on the board, but still a 3-leg combo; minnows can frustrate early and the corners leg is manual.",
        },
        {
          match: "Sweden vs Tunisia", risk: "medium",
          market: "Over total cards + Sweden Double Chance (1X)",
          summary: "Cards-led angle in a tighter game.",
          why: "Physical, defensive Tunisia vs a Sweden side that must break them down — the profile for fouls.",
          whyRisk: "Medium — cards hinge on the referee (check the assignment) and a tight game can stay clean.",
        },
        {
          match: "Netherlands vs Japan", risk: "high",
          market: "Over 1.5 goals + Netherlands DNB",
          summary: "More variance — only if safer options aren't at ~1.40.",
          why: "Netherlands should control and create; over 1.5 is reasonable and DNB covers a draw.",
          whyRisk: "High — Japan are dangerous on the break; a low-scoring upset threatens both legs.",
        },
        {
          match: "Ivory Coast vs Ecuador", risk: "high",
          market: "Over total cards",
          summary: "Avoid unless you want a pure cards punt with a card-heavy ref.",
          why: "Two physical sides in an even game — the profile for fouls.",
          whyRisk: "High — even match = coin-flip result (no safe win leg) and cards still hinge on the referee.",
        },
      ],
    },
  },
};
