// Derived views over the book: the calling queue, desk metrics, pipeline
// grouping, and the "who do I call next" logic behind the reminder.

import { OPEN_STATUSES, STATUS_META, type Client, type LeadStatus, type Stage } from "./types";
import { AGENTS } from "./seed";

const HOUR = 3_600_000;

export function isOpen(c: Client): boolean {
  return OPEN_STATUSES.includes(c.status);
}

export function urgency(c: Client): number {
  const base = c.nextFollowUp ? new Date(c.nextFollowUp).getTime() : Date.now();
  const boost = c.priority === "high" ? 6 * HOUR : c.priority === "low" ? -6 * HOUR : 0;
  return base - boost;
}

export function isOverdue(c: Client, at = Date.now()): boolean {
  return Boolean(c.nextFollowUp && new Date(c.nextFollowUp).getTime() < at);
}

/** Everyone still worth calling for this agent, most urgent first. */
export function callQueue(clients: Client[], agentId?: string): Client[] {
  return clients
    .filter((c) => isOpen(c) && (!agentId || c.ownerId === agentId))
    .sort((a, b) => urgency(a) - urgency(b));
}

export function dueNow(clients: Client[], agentId?: string, at = Date.now()): Client[] {
  return callQueue(clients, agentId).filter((c) =>
    !c.nextFollowUp ? true : new Date(c.nextFollowUp).getTime() <= at,
  );
}

export function nextUp(clients: Client[], agentId?: string): Client | null {
  return dueNow(clients, agentId)[0] ?? callQueue(clients, agentId)[0] ?? null;
}

export interface Metrics {
  dueNow: number;
  overdue: number;
  newLeads: number;
  openTotal: number;
  funded: number;
  aum: number; // total equity under management
  netDeposits: number; // lifetime deposits − withdrawals
  ftdToday: number; // first-time deposits booked today
  conversion: number; // funded / (funded + open), %
  avgPnl: number; // average open P/L % across funded accounts
}

export function metrics(clients: Client[], agentId?: string): Metrics {
  const at = Date.now();
  const mine = agentId ? clients.filter((c) => c.ownerId === agentId) : clients;
  const funded = mine.filter((c) => ["active", "deposited", "dormant"].includes(c.status));
  const open = mine.filter(isOpen);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const ftdToday = mine.filter((c) =>
    c.depositHistory.some((d) => new Date(d.date).getTime() >= todayStart.getTime()),
  ).length;

  const avgPnl = funded.length
    ? funded.reduce((s, c) => s + c.pnlPct, 0) / funded.length
    : 0;

  return {
    dueNow: dueNow(mine, agentId, at).length,
    overdue: mine.filter((c) => isOpen(c) && isOverdue(c, at)).length,
    newLeads: mine.filter((c) => c.status === "new").length,
    openTotal: open.length,
    funded: funded.length,
    aum: funded.reduce((s, c) => s + c.equity, 0),
    netDeposits: mine.reduce((s, c) => s + c.deposits - c.withdrawals, 0),
    ftdToday,
    conversion: funded.length + open.length ? (funded.length / (funded.length + open.length)) * 100 : 0,
    avgPnl,
  };
}

export function byStage(clients: Client[], agentId?: string): Record<Stage, Client[]> {
  const out: Record<Stage, Client[]> = { new: [], attempting: [], engaged: [], deposited: [] };
  for (const c of clients) {
    if (agentId && c.ownerId !== agentId) continue;
    const stage = STATUS_META[c.status].stage;
    if (stage) out[stage].push(c);
  }
  for (const k of Object.keys(out) as Stage[]) {
    out[k].sort((a, b) => b.score - a.score);
  }
  return out;
}

export function recentActivity(clients: Client[], limit = 8) {
  return clients
    .flatMap((c) => c.activity.map((a) => ({ client: c, act: a })))
    .sort((x, y) => +new Date(y.act.at) - +new Date(x.act.at))
    .slice(0, limit);
}

export interface DaySummary {
  date: string;
  callsMade: number;
  reached: number; // calls where someone actually picked up
  notesAdded: number;
  byOutcome: { outcome: LeadStatus; count: number }[];
  callbacksBooked: number;
  deals: { client: Client; amount: number; method: string; at: string }[];
  depositsTotal: number;
  calls: { client: Client; outcome: LeadStatus | undefined; body: string; at: string }[];
}

/** Everything an agent did on a given day — the end-of-day report. */
export function daySummary(clients: Client[], agentId: string, day = new Date()): DaySummary {
  const start = new Date(day); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(start.getDate() + 1);
  const within = (iso: string) => { const t = new Date(iso).getTime(); return t >= start.getTime() && t < end.getTime(); };

  const acts = clients.flatMap((c) =>
    c.activity.filter((a) => a.agentId === agentId && within(a.at)).map((a) => ({ c, a })),
  );
  const callActs = acts.filter(({ a }) => a.kind === "call");
  const notesAdded = acts.filter(({ a }) => a.kind === "note").length;

  const counts = new Map<LeadStatus, number>();
  for (const { a } of callActs) if (a.outcome) counts.set(a.outcome, (counts.get(a.outcome) ?? 0) + 1);

  const deals = clients
    .filter((c) => c.ownerId === agentId)
    .flatMap((c) => c.depositHistory.filter((d) => within(d.date)).map((d) => ({ client: c, amount: d.amount, method: d.method, at: d.date })))
    .sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return {
    date: start.toISOString(),
    callsMade: callActs.length,
    reached: callActs.filter(({ a }) => a.outcome && a.outcome !== "no_answer").length,
    notesAdded,
    byOutcome: Array.from(counts, ([outcome, count]) => ({ outcome, count })).sort((a, b) => b.count - a.count),
    callbacksBooked: counts.get("callback") ?? 0,
    deals,
    depositsTotal: deals.reduce((s, d) => s + d.amount, 0),
    calls: callActs
      .map(({ c, a }) => ({ client: c, outcome: a.outcome, body: a.body, at: a.at }))
      .sort((x, y) => +new Date(y.at) - +new Date(x.at)),
  };
}

/** Sum of deposits booked this calendar month for an agent's clients. */
export function monthToDateDeposits(clients: Client[], agentId: string): number {
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
  return clients
    .filter((c) => c.ownerId === agentId)
    .reduce((s, c) => s + c.depositHistory.filter((d) => new Date(d.date).getTime() >= start.getTime()).reduce((a, d) => a + d.amount, 0), 0);
}

export interface LeaderRow {
  agentId: string;
  name: string;
  desk: string;
  mtd: number; // month-to-date deposits
  target: number;
  ftdToday: number;
}

/** Desk leaderboard, ranked by month-to-date deposits. */
export function leaderboard(clients: Client[]): LeaderRow[] {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  return AGENTS.map((a) => ({
    agentId: a.id,
    name: a.name,
    desk: a.desk,
    target: a.monthlyTarget,
    mtd: monthToDateDeposits(clients, a.id),
    ftdToday: clients.filter((c) => c.ownerId === a.id && c.depositHistory.some((d) => new Date(d.date).getTime() >= todayStart.getTime())).length,
  })).sort((x, y) => y.mtd - x.mtd);
}

export function statusCounts(clients: Client[], agentId?: string): { status: LeadStatus; count: number }[] {
  const mine = agentId ? clients.filter((c) => c.ownerId === agentId) : clients;
  const order: LeadStatus[] = ["new", "no_answer", "callback", "qualified", "deposited", "active", "dormant", "not_interested"];
  return order.map((status) => ({ status, count: mine.filter((c) => c.status === status).length }));
}
