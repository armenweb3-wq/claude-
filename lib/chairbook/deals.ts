import type { ClientType, Deal, DealRule } from "./types";

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Split one payment between the shop and the barber under a rule. */
export function settle(amount: number, rule: DealRule) {
  const shop =
    rule.kind === "flat"
      ? Math.min(amount, rule.shopTakes)
      : round2((amount * rule.shopPct) / 100);
  return { shop: round2(shop), barber: round2(amount - shop) };
}

export function ruleFor(deal: Deal, type: ClientType): DealRule {
  return type === "own" ? deal.ownClients : deal.walkIns;
}

export function describeRule(rule: DealRule): string {
  if (rule.kind === "flat") return `Shop takes €${rule.shopTakes} per cut`;
  return `Shop ${rule.shopPct}% · Barber ${100 - rule.shopPct}%`;
}

export function shortRule(rule: DealRule): string {
  if (rule.kind === "flat") return `€${rule.shopTakes} flat`;
  return `${100 - rule.shopPct}/${rule.shopPct}`;
}
