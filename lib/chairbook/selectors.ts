import { round2 } from "./deals";
import { addDays, startOfDay, startOfMonth, startOfWeek } from "./format";
import type { Appointment, Barber, Client, DB, Expense, Sale } from "./types";

export type Period = "today" | "week" | "month";

export function periodRange(period: Period, now = new Date()) {
  const to = addDays(startOfDay(now), 1);
  if (period === "today") return { from: startOfDay(now), to };
  if (period === "week") return { from: startOfWeek(now), to };
  return { from: startOfMonth(now), to };
}

export function salesIn(
  sales: Sale[],
  opts: { from?: Date; to?: Date; shopId?: string | null; barberId?: string | null },
) {
  const from = opts.from?.toISOString();
  const to = opts.to?.toISOString();
  return sales.filter(
    (s) =>
      (!from || s.at >= from) &&
      (!to || s.at < to) &&
      (!opts.shopId || s.shopId === opts.shopId) &&
      (!opts.barberId || s.barberId === opts.barberId),
  );
}

export interface Totals {
  count: number;
  gross: number;
  shop: number;
  barber: number;
  cash: number;
  card: number;
  walkIns: number;
  booked: number;
  ownClients: number;
}

export function totals(sales: Sale[]): Totals {
  const t: Totals = {
    count: 0,
    gross: 0,
    shop: 0,
    barber: 0,
    cash: 0,
    card: 0,
    walkIns: 0,
    booked: 0,
    ownClients: 0,
  };
  for (const s of sales) {
    t.count++;
    t.gross += s.amount;
    t.shop += s.shopShare;
    t.barber += s.barberShare;
    if (s.method === "cash") t.cash += s.amount;
    else t.card += s.amount;
    if (s.source === "walk-in") t.walkIns++;
    else t.booked++;
    if (s.clientType === "own") t.ownClients++;
  }
  t.gross = round2(t.gross);
  t.shop = round2(t.shop);
  t.barber = round2(t.barber);
  t.cash = round2(t.cash);
  t.card = round2(t.card);
  return t;
}

/**
 * End-of-day settlement for one barber, assuming the barber pockets the cash
 * they take and all card money lands in the shop account.
 * Positive `net` = shop pays the barber; negative = barber hands cash to shop.
 */
export function settlement(sales: Sale[]) {
  const t = totals(sales);
  const net = round2(t.barber - t.cash);
  return { ...t, cashCollected: t.cash, net };
}

export function byBarber(db: DB, sales: Sale[]) {
  return db.barbers
    .map((b) => ({ who: b, ...totals(sales.filter((s) => s.barberId === b.id)) }))
    .filter((r) => r.count > 0 || r.who.active)
    .sort((a, b) => b.gross - a.gross);
}

export interface WeekdayRow {
  dow: number;
  days: number;
  walkIns: number;
  booked: number;
  gross: number;
  avgWalkIns: number;
  avgBooked: number;
  avgGross: number;
  walkInShare: number;
}

/** Average activity per weekday over the history window. */
export function weekdayProfile(sales: Sale[], weeks = 8, now = new Date()): WeekdayRow[] {
  const from = addDays(startOfDay(now), -weeks * 7);
  const inWindow = sales.filter((s) => new Date(s.at) >= from && new Date(s.at) < startOfDay(now));
  const rows: WeekdayRow[] = Array.from({ length: 7 }, (_, dow) => ({
    dow,
    days: 0,
    walkIns: 0,
    booked: 0,
    gross: 0,
    avgWalkIns: 0,
    avgBooked: 0,
    avgGross: 0,
    walkInShare: 0,
  }));
  const seenDays = new Set<string>();
  for (const s of inWindow) {
    const d = new Date(s.at);
    const row = rows[d.getDay()];
    const key = d.toDateString();
    if (!seenDays.has(key)) {
      seenDays.add(key);
      row.days++;
    }
    if (s.source === "walk-in") row.walkIns++;
    else row.booked++;
    row.gross += s.amount;
  }
  for (const r of rows) {
    r.avgWalkIns = r.days ? round2(r.walkIns / r.days) : 0;
    r.avgBooked = r.days ? round2(r.booked / r.days) : 0;
    r.avgGross = r.days ? Math.round(r.gross / r.days) : 0;
    r.walkInShare = r.walkIns + r.booked ? Math.round((r.walkIns / (r.walkIns + r.booked)) * 100) : 0;
  }
  // Monday-first ordering.
  return [...rows.slice(1), rows[0]];
}

/** Daily gross for the last N days (oldest first). */
export function dailySeries(sales: Sale[], days: number, now = new Date()) {
  const out: { day: Date; gross: number; shop: number; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(startOfDay(now), -i);
    const next = addDays(day, 1);
    const inDay = salesIn(sales, { from: day, to: next });
    const t = totals(inDay);
    out.push({ day, gross: t.gross, shop: t.shop, count: t.count });
  }
  return out;
}

export function hourProfile(sales: Sale[], openHour: number, closeHour: number) {
  const hours = Array.from({ length: closeHour - openHour }, (_, i) => ({
    hour: openHour + i,
    walkIns: 0,
    booked: 0,
  }));
  for (const s of sales) {
    const h = new Date(s.at).getHours();
    const row = hours[h - openHour];
    if (!row) continue;
    if (s.source === "walk-in") row.walkIns++;
    else row.booked++;
  }
  return hours;
}

export function appointmentsOn(appts: Appointment[], day: Date, barberId?: string | null) {
  const from = startOfDay(day).toISOString();
  const to = addDays(startOfDay(day), 1).toISOString();
  return appts
    .filter(
      (a) =>
        a.startsAt >= from && a.startsAt < to && (!barberId || a.barberId === barberId),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function topClients(db: DB, sales: Sale[], limit = 5) {
  const map = new Map<string, { count: number; gross: number }>();
  for (const s of sales) {
    if (!s.clientId) continue;
    const cur = map.get(s.clientId) ?? { count: 0, gross: 0 };
    cur.count++;
    cur.gross += s.amount;
    map.set(s.clientId, cur);
  }
  return Array.from(map.entries())
    .map(([id, v]) => ({ client: db.clients.find((c) => c.id === id)!, ...v }))
    .filter((r) => r.client)
    .sort((a, b) => b.gross - a.gross)
    .slice(0, limit);
}

export function barberName(db: DB, id: string) {
  return db.barbers.find((b) => b.id === id)?.name ?? "—";
}

export function clientLabel(db: DB, sale: { clientId: string | null }) {
  if (!sale.clientId) return "Walk-in";
  return db.clients.find((c) => c.id === sale.clientId)?.name ?? "Unknown";
}

export function barbersOf(db: DB, shopId: string | null): Barber[] {
  return db.barbers.filter((b) => b.active && (!shopId || b.shopId === shopId));
}

// ---------------------------------------------------------------------------
// Client-level insights: who is a regular, who is slipping away, who is lost.


export type ClientStatus = "new" | "regular" | "occasional" | "slipping" | "lost";

export interface ClientInsight {
  client: Client;
  visits: number;
  spend: number;
  firstVisit: string;
  lastVisit: string;
  daysSince: number;
  /** Typical days between visits (median), when there are ≥ 2 visits. */
  gapDays: number | null;
  noShows: number;
  hasUpcoming: boolean;
  status: ClientStatus;
  /** For slipping/lost: how many usual intervals overdue. */
  overdueBy: number;
}

const DAY = 86_400_000;

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Status rules (deliberately simple so a barber can reason about them):
 * - new:        added to the list within the last 30 days (≤ 2 visits)
 * - regular:    ≥ 3 visits with a usual gap ≤ 21 days, and not overdue
 * - occasional: everyone else who is not overdue
 * - slipping:   overdue by more than 1.5× their usual gap and ≥ 14 days
 *               since the last visit (or > 30 days for people without a rhythm)
 * - lost:       overdue by more than 2.5× their usual gap and ≥ 28 days, or > 60 days
 * An upcoming booking cancels slipping/lost.
 */
export function clientInsights(
  db: DB,
  opts: { barberId?: string | null; shopId?: string | null; servedByBarber?: boolean } = {},
  now = new Date(),
): ClientInsight[] {
  const out: ClientInsight[] = [];
  const nowMs = now.getTime();
  const upcoming = new Set(
    db.appointments
      .filter((a) => a.status === "booked" && new Date(a.startsAt) >= now && a.clientId)
      .map((a) => a.clientId as string),
  );
  const noShowCount = new Map<string, number>();
  for (const a of db.appointments) {
    if (a.status === "no-show" && a.clientId && (!opts.barberId || a.barberId === opts.barberId)) {
      noShowCount.set(a.clientId, (noShowCount.get(a.clientId) ?? 0) + 1);
    }
  }

  const byClient = new Map<string, Sale[]>();
  for (const s of db.sales) {
    if (!s.clientId) continue;
    if (opts.barberId && opts.servedByBarber && s.barberId !== opts.barberId) continue;
    const arr = byClient.get(s.clientId) ?? [];
    arr.push(s);
    byClient.set(s.clientId, arr);
  }

  for (const client of db.clients) {
    if (opts.shopId && client.shopId !== opts.shopId) continue;
    if (opts.barberId && !opts.servedByBarber && client.ownerBarberId !== opts.barberId) continue;
    const sales = (byClient.get(client.id) ?? []).sort((a, b) => a.at.localeCompare(b.at));
    if (sales.length === 0 && !opts.servedByBarber) {
      out.push({
        client,
        visits: 0,
        spend: 0,
        firstVisit: client.createdAt,
        lastVisit: client.createdAt,
        daysSince: Math.floor((nowMs - new Date(client.createdAt).getTime()) / DAY),
        gapDays: null,
        noShows: noShowCount.get(client.id) ?? 0,
        hasUpcoming: upcoming.has(client.id),
        status: (nowMs - new Date(client.createdAt).getTime()) / DAY <= 30 ? "new" : upcoming.has(client.id) ? "occasional" : "lost",
        overdueBy: 0,
      });
      continue;
    }
    if (sales.length === 0) continue;
    const gaps: number[] = [];
    for (let i = 1; i < sales.length; i++) {
      gaps.push((new Date(sales[i].at).getTime() - new Date(sales[i - 1].at).getTime()) / DAY);
    }
    const gapDays = median(gaps);
    const lastVisit = sales[sales.length - 1].at;
    const firstVisit = sales[0].at;
    const daysSince = Math.floor((nowMs - new Date(lastVisit).getTime()) / DAY);
    const sinceCreated = Math.floor((nowMs - new Date(client.createdAt).getTime()) / DAY);
    const overdueBy = gapDays ? daysSince / gapDays : 0;
    let status: ClientStatus;
    if (sinceCreated <= 30 && sales.length <= 2) status = "new";
    else if (upcoming.has(client.id)) status = gapDays !== null && gapDays <= 21 && sales.length >= 3 ? "regular" : "occasional";
    else if ((gapDays && overdueBy > 2.5 && daysSince >= 28) || daysSince > 60) status = "lost";
    else if ((gapDays && overdueBy > 1.5 && daysSince >= 14) || (!gapDays && daysSince > 30)) status = "slipping";
    else if (gapDays !== null && gapDays <= 21 && sales.length >= 3) status = "regular";
    else status = "occasional";
    out.push({
      client,
      visits: sales.length,
      spend: round2(sales.reduce((a, s) => a + s.amount, 0)),
      firstVisit,
      lastVisit,
      daysSince,
      gapDays: gapDays === null ? null : Math.round(gapDays),
      noShows: noShowCount.get(client.id) ?? 0,
      hasUpcoming: upcoming.has(client.id),
      status,
      overdueBy: Math.round(overdueBy * 10) / 10,
    });
  }
  return out;
}

export function expensesIn(
  expenses: Expense[],
  opts: { from?: Date; to?: Date; shopId?: string | null; barberId?: string | null; shopOnly?: boolean },
) {
  const from = opts.from?.toISOString();
  const to = opts.to?.toISOString();
  return expenses.filter(
    (e) =>
      (!from || e.at >= from) &&
      (!to || e.at < to) &&
      (!opts.shopId || e.shopId === opts.shopId) &&
      (opts.barberId ? e.barberId === opts.barberId : true) &&
      (opts.shopOnly ? e.barberId === null : true),
  );
}

export const sumExpenses = (xs: Expense[]) => round2(xs.reduce((a, e) => a + e.amount, 0));

/** Weekly totals for the last N weeks (Monday-based, oldest first). */
export function weeklySeries(sales: Sale[], weeks: number, now = new Date()) {
  const out: { start: Date; gross: number; barber: number; shop: number; count: number; walkIns: number }[] = [];
  const thisWeek = startOfWeek(now);
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -i * 7);
    const inWeek = salesIn(sales, { from: start, to: addDays(start, 7) });
    const t = totals(inWeek);
    out.push({ start, gross: t.gross, barber: t.barber, shop: t.shop, count: t.count, walkIns: t.walkIns });
  }
  return out;
}

export function noShowsIn(db: DB, opts: { from?: Date; to?: Date; barberId?: string | null; shopId?: string | null }) {
  const from = opts.from?.toISOString();
  const to = opts.to?.toISOString();
  return db.appointments.filter(
    (a) =>
      a.status === "no-show" &&
      (!from || a.startsAt >= from) &&
      (!to || a.startsAt < to) &&
      (!opts.barberId || a.barberId === opts.barberId) &&
      (!opts.shopId || a.shopId === opts.shopId),
  );
}
