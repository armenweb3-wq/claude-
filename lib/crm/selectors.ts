// Derived views over the book: the calling queue, desk metrics, pipeline
// grouping, and the "who do I call next" logic behind the reminder.

import { OPEN_STATUSES, STATUS_META, type Client, type LeadStatus, type Stage } from "./types";

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

export function statusCounts(clients: Client[], agentId?: string): { status: LeadStatus; count: number }[] {
  const mine = agentId ? clients.filter((c) => c.ownerId === agentId) : clients;
  const order: LeadStatus[] = ["new", "no_answer", "callback", "qualified", "deposited", "active", "dormant", "not_interested"];
  return order.map((status) => ({ status, count: mine.filter((c) => c.status === status).length }));
}
