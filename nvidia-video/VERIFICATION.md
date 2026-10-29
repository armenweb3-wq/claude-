# Fact & figure verification

The research screenshots and pitch PDF have **not been attached yet**, so I built every on-screen
claim from the figures in your written brief. Nothing below comes from an outside source, and no
source is cited on screen. Check each **NEEDS VERIFICATION** item against a primary source
(NVIDIA 10-Q/10-K filings, earnings press releases, investor.nvidia.com) before you publish.

## Supplied figures: need verification

| # | Claim on screen | Where | Status | Notes |
|---|---|---|---|---|
| 1 | Quarterly revenue **$68.1B → $81.6B → $96.2B** | Scene 4 | **NEEDS VERIFICATION** | The brief gives no fiscal quarters, so the bars read "Quarter 1/2/3". Confirm each value and its quarter, then set `revenue[].label` in `src/data/content.ts`. Also check whether $96.2B is a *reported* result or *guidance*. If it's guidance, it must be labelled that way. |
| 2 | "An 80-year-old retiree" uses AI daily | Scene 1 | **NEEDS SOURCE** | Shown as a *dramatisation*, and the chat text is illustrative. If your research cites a survey or a real person, add the attribution, or keep it as a dramatisation. |
| 3 | Major commercial partnerships | Scene 5 | **NEEDS NAMES + SOURCE** | No partner names were supplied, so the scene shows **categories only**. Add the partners you can document in `partners` in `content.ts`. Don't use company logos unless you have rights to them. |
| 4 | Upcoming earnings report as a catalyst | Scene 5 | **NEEDS DATE** | Shows "Date to be confirmed". Set `earnings.date` once NVIDIA confirms the date. |
| 5 | NVIDIA is "a leading supplier" of AI computing / GPUs and systems | Scenes 2–3 | Qualitative, your wording | I kept it as "a leading" supplier. I didn't add any market-share number. |
| 7 | Jensen Huang co-founded NVIDIA in **1993**, is its CEO, and the company began with graphics chips for games | Scene 1 | Widely documented | Matches NVIDIA's corporate history. Still worth confirming the wording against nvidia.com before publishing. |
| 8 | Founder portrait | Scene 1 + board | **NEEDS A LICENSED PHOTO** | Supply an image you have rights to: an NVIDIA newsroom press photo (check its editorial-use terms) or a CC-licensed photo, with attribution in `founder.credit`. Using a real person's face in investment content can read as endorsement. The disclaimer states there's no affiliation with or endorsement by NVIDIA or its founder. |
| 6 | Stock prices **$218 → $235.44** | Scenes 6–8 | Scenario, not a quote | Labelled as hypothetical on screen. The chart path is synthetic ("Illustrative path · not historical data · not a forecast"). |

## "By investing $25,000 you could potentially make…"
The investment scene says **"By investing $25,000 with about 5× leverage, you could potentially make $9,975.68 — before costs."**
The leverage is part of the sentence on purpose: **without leverage, $25,000 buys about 114 shares, and an 8% rise
makes about $2,000, not $9,975.68.** Dropping "with about 5× leverage" would make the claim false. The same scene
also shows what an 8% fall would lose (−$9,975.68).

## Derived maths: verified (the build fails if these drift)

`src/data/content.ts` recomputes these values and throws an error during render if they stop matching the brief.

| Item | Calculation | Result |
|---|---|---|
| Price move | (235.44 − 218) ÷ 218 | **+8.00%** ✔ |
| Gain per share | 235.44 − 218 | **$17.44** |
| Scenario A gross profit | 572 × 17.44 | **$9,975.68** ✔ |
| Scenario B gross profit | 1,720 × 17.44 | **$29,996.80** ✔ |
| Scenario A position | 572 × $218 | $124,696 |
| Scenario B position | 1,720 × $218 | $374,960 |
| Scenario A leverage | 124,696 ÷ 25,000 | **4.99× (≈5.0×)** |
| Scenario B leverage | 374,960 ÷ 50,000 | **7.50× (≈7.5×)** |
| Return on own capital | profit ÷ capital | +39.9% / +60.0% |
| Same 8% move downward | (same) | −$9,975.68 / −$29,996.80 (≈40% / 60% of capital) |
| Revenue growth Q→Q | (81.6−68.1)/68.1, (96.2−81.6)/81.6 | +19.8%, +17.9% |

### Things you should know about the scenarios
- **The two scenarios use different leverage** (≈5× vs ≈7.5×). The $50k case is not just "twice the
  $25k case". It holds about 3× the shares, which is why its profit is about 3×. The video says this explicitly.
- Neither the brief nor the video includes borrowing costs, commissions, spreads, taxes, FX, or margin-call
  and liquidation risk. At 7.5× leverage, a fall of roughly 13% would wipe out the entire $50k of capital
  (1 ÷ 7.5 ≈ 13.3%), and a broker would likely issue a margin call well before that. Consider adding this line if compliance asks for it.
- Check whether this leverage is available in the viewer's jurisdiction. Retail margin limits vary by region.

## Compliance on screen
- A persistent strip on every financial scene: "Hypothetical illustration · Not financial advice".
- The split-screen strip reads "Before costs · hypothetical · not guaranteed".
- The final disclaimer scene lists the assumptions, the exclusions, and the downside loss figures.
- This is not legal or regulatory review. Get the video checked by compliance before promoting it to the public.
