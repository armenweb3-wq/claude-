"use client";

// localStorage-backed store for the CRM, exposed to React via
// useSyncExternalStore. The persistence layer is intentionally isolated here so
// it can be replaced with Supabase/an API later without touching the UI.

import { useSyncExternalStore } from "react";
import type { Activity, Client, LeadStatus, Priority } from "./types";
import { seedClients } from "./seed";

const KEY = "vantage-crm:clients:v2";

let cache: Client[] | null = null;
const EMPTY: Client[] = [];
const listeners = new Set<() => void>();

function load(): Client[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Client[];
  } catch {
    /* fall through and re-seed */
  }
  const seeded = seedClients();
  persist(seeded);
  return seeded;
}

function persist(next: Client[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(next));
}

function commit(next: Client[]) {
  cache = next;
  persist(next);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  if (cache === null) cache = load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getSnapshot = () => cache ?? EMPTY;
const getServerSnapshot = () => EMPTY;

export function useClients(): Client[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const current = () => cache ?? load();

export function getClient(id: string): Client | undefined {
  return current().find((c) => c.id === id);
}

export function updateClient(id: string, patch: Partial<Client>) {
  commit(current().map((c) => (c.id === id ? { ...c, ...patch } : c)));
}

export interface CallResult {
  outcome: LeadStatus;
  note: string;
  nextFollowUp: string | null;
  priority?: Priority;
  agentId: string;
  deposit?: { amount: number; method: string };
}

/** Log a call outcome and roll the client forward. */
export function logCall(id: string, r: CallResult) {
  const now = new Date().toISOString();
  commit(
    current().map((c) => {
      if (c.id !== id) return c;
      const activity: Activity[] = [
        { id: `act_${Date.now()}`, at: now, kind: "call", outcome: r.outcome, body: r.note.trim() || "Call logged.", agentId: r.agentId },
        ...c.activity,
      ];
      let { balance, equity, deposits, depositHistory, status, equityCurve } = c;
      status = r.outcome;
      if (r.deposit && r.deposit.amount > 0) {
        deposits += r.deposit.amount;
        balance += r.deposit.amount;
        equity += r.deposit.amount;
        depositHistory = [...depositHistory, { date: now, amount: r.deposit.amount, method: r.deposit.method }];
        equityCurve = [...equityCurve.slice(1), equity];
        activity.unshift({ id: `act_${Date.now()}_d`, at: now, kind: "deposit", body: `Deposited $${r.deposit.amount.toLocaleString("en-US")} via ${r.deposit.method}`, agentId: r.agentId });
      }
      return {
        ...c,
        status,
        balance,
        equity,
        deposits,
        depositHistory,
        equityCurve,
        note: r.note.trim() || c.note,
        nextFollowUp: r.nextFollowUp,
        lastContact: now,
        priority: r.priority ?? c.priority,
        activity,
      };
    }),
  );
}

export function resetDemo() {
  commit(seedClients());
}
