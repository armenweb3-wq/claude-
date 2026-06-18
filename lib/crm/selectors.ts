// Derived views over the client book: the calling queue, dashboard metrics,
// and the "who do I call next" logic that powers the reminder pop-up.

import { OPEN_STATUSES, type Client } from "./types";

const HOUR = 60 * 60 * 1000;

/** Lower = more urgent. New leads & past-due callbacks float to the top. */
export function urgency(c: Client): number {
  const base = c.nextFollowUp ? new Date(c.nextFollowUp).getTime() : Date.now();
  const boost = c.priority === "high" ? 6 * HOUR : c.priority === "low" ? -6 * HOUR : 0;
  return base - boost;
}

export function isOpen(c: Client): boolean {
  return OPEN_STATUSES.includes(c.status);
}

/** Everyone still worth calling, most urgent first. */
export function callQueue(clients: Client[]): Client[] {
  return clients.filter(isOpen).sort((a, b) => urgency(a) - urgency(b));
}

/** Open clients whose follow-up time has arrived (or who are brand new). */
export function dueNow(clients: Client[], at: number = Date.now()): Client[] {
  return callQueue(clients).filter((c) => {
    if (!c.nextFollowUp) return true; // new lead, no time set
    return new Date(c.nextFollowUp).getTime() <= at;
  });
}

export function isOverdue(c: Client, at: number = Date.now()): boolean {
  return Boolean(c.nextFollowUp && new Date(c.nextFollowUp).getTime() < at);
}

export interface Metrics {
  dueNow: number;
  overdue: number;
  newLeads: number;
  openTotal: number;
  funded: number; // count of funded accounts
  aum: number; // sum of balances
  deposited: number; // lifetime deposits
}

export function metrics(clients: Client[]): Metrics {
  const at = Date.now();
  return {
    dueNow: dueNow(clients, at).length,
    overdue: clients.filter((c) => isOpen(c) && isOverdue(c, at)).length,
    newLeads: clients.filter((c) => c.status === "new").length,
    openTotal: clients.filter(isOpen).length,
    funded: clients.filter((c) => c.status === "deposited").length,
    aum: clients.reduce((s, c) => s + c.balance, 0),
    deposited: clients.reduce((s, c) => s + c.deposits, 0),
  };
}

/** The single client to call next (top of the due queue, else top of queue). */
export function nextUp(clients: Client[]): Client | null {
  const due = dueNow(clients);
  if (due.length) return due[0];
  const q = callQueue(clients);
  return q[0] ?? null;
}

export function recentActivity(clients: Client[], limit = 6) {
  return clients
    .flatMap((c) =>
      c.history.map((h) => ({ client: c, log: h })),
    )
    .sort((a, b) => new Date(b.log.at).getTime() - new Date(a.log.at).getTime())
    .slice(0, limit);
}
