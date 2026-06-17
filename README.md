# ⚽ World Cup 2026 — Betting Streak Tracker

A tiny, no-build static dashboard to track a compounding betting streak with friends.
Goal: **17 legs, ~1.4× each, compounding** from a **€340** start.

> ⚠️ For entertainment only. A 17-leg compounding streak is extremely high-variance —
> even at a 85% per-leg hit rate the chance of completing all 17 is only ~6%.
> Stake only money you can fully afford to lose. Not financial advice.

## What it shows
- **Bankroll, profit, current leg, hit rate** at a glance
- **17-leg streak** strip (green = won, red = lost, amber = pending)
- **Today's recommendation** (the next pick + backups)
- **Bankroll vs. target** chart (log scale) so you instantly see if you're on pace
- **Reality-check** probability of finishing the remaining legs
- **Results log** with every selection

## The only file you edit: `data.js`
Each day:
1. Open `data.js`.
2. Settle yesterday's bet: set `result` to `"won"`/`"lost"` and `returnAmount` (`stake * odds` on a win, `0` on a loss).
3. Add the next bet block (its `stake` = the previous win's `returnAmount` — that's the compounding).
4. Update `todaysPick`.
5. Commit & push — the live site updates automatically.

## Daily recalibration routine
1. **Settle** yesterday and log it.
2. **Audit hit rate by market** (corners / cards / 1X) — down-weight whatever is dragging.
3. **Pull today's context** — confirmed XIs, suspensions, **referee assignment**, group standings, and *who needs what*.
4. **Generate candidates** with the checklist below; line-shop 2–3 books for the best ~1.40 price.
5. **Pick the single best** qualifying bet (or a diversified 2-of-3 set).
6. **Update `data.js`** and note the rationale.
7. **Re-confirm the stop-loss / budget** before placing.

### Per-leg checklist (all should be "yes")
- [ ] You believe true probability > 75% **and** price is ≥ 1.40 (i.e. underpriced)
- [ ] **1X / DNB**: at least one team is happy with a draw / must not lose
- [ ] **Corners**: clear style + game-state mismatch (wing-based favourite vs. deep block)
- [ ] **Cards**: referee confirmed and above-average; stakes high (rivalry / elimination)
- [ ] Line-shopped 2–3 books, took the best price
- [ ] If nothing qualifies, **skip the day** — that's a valid move

## Run locally
Open `index.html` in a browser. No server or build step needed.

## Deploy
Any static host works (Cloudflare Pages, Vercel, GitHub Pages, Netlify).
Just publish the folder — `index.html` is the entry point.
