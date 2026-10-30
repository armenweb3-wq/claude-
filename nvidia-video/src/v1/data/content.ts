/**
 * Single edit point for every figure shown on screen.
 *
 * SUPPLIED  = provided by the client brief; needs verification against a primary source
 *             before publication (see VERIFICATION.md).
 * DERIVED   = computed below from supplied figures; never hard-code these.
 */

// SUPPLIED — quarterly revenue (USD billions), oldest → newest.
// Quarter labels were NOT supplied; replace with exact fiscal quarters once verified.
export const revenue = [
  { label: "Quarter 1", value: 68.1 },
  { label: "Quarter 2", value: 81.6 },
  { label: "Quarter 3", value: 96.2 },
];

// SUPPLIED — partnership categories. Specific partner names were not supplied in the brief,
// so the video shows categories only. Replace with names verified in the research pack.
export const partners = [
  { title: "Cloud hyperscalers", sub: "AI capacity at global scale" },
  { title: "AI model labs", sub: "Training frontier models" },
  { title: "Enterprise software", sub: "AI inside business workflows" },
  { title: "Automotive & robotics", sub: "Autonomy and physical AI" },
  { title: "Sovereign AI", sub: "National AI infrastructure" },
];

// SUPPLIED — catalyst. Exact date was not supplied: confirm on NVIDIA's investor-relations site.
export const earnings = { headline: "Next quarterly earnings report", date: "Date to be confirmed" };

// SUPPLIED — hypothetical price scenario.
export const price = { start: 218, target: 235.44 };

// SUPPLIED — position scenarios.
export const scenarios = [
  { capital: 25_000, shares: 572 },
  { capital: 50_000, shares: 1_720 },
];

// ---------- DERIVED ----------
const round2 = (n: number) => Math.round(n * 100) / 100;

export const priceMovePct = round2(((price.target - price.start) / price.start) * 100); // 8
export const gainPerShare = round2(price.target - price.start); // 17.44

export const positions = scenarios.map((s) => {
  const exposure = round2(s.shares * price.start);
  const grossProfit = round2(s.shares * gainPerShare);
  return {
    ...s,
    exposure,
    leverage: exposure / s.capital,
    borrowed: round2(exposure - s.capital),
    grossProfit,
    returnOnCapitalPct: (grossProfit / s.capital) * 100,
    /** Same 8% move downward — leverage magnifies losses equally. */
    grossLossIfDown: grossProfit,
  };
});

export const revenueGrowth = revenue.slice(1).map((q, i) => ((q.value - revenue[i].value) / revenue[i].value) * 100);

// Guardrail: fail the render loudly if the supplied totals stop matching the derived maths.
const expected = [9_975.68, 29_996.8];
positions.forEach((p, i) => {
  if (Math.abs(p.grossProfit - expected[i]) > 0.005) {
    throw new Error(`Scenario ${i + 1} gross profit ${p.grossProfit} != supplied ${expected[i]}`);
  }
});
if (priceMovePct !== 8) throw new Error(`Price move ${priceMovePct}% != supplied 8%`);

export const fmtUSD = (n: number, decimals = 0) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
