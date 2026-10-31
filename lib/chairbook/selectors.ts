import { round2 } from "./deals";
import { addDays, startOfDay, startOfMonth, startOfWeek } from "./format";
import type { Appointment, Barber, DB, Sale } from "./types";

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
