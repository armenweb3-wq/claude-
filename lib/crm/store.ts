"use client";

// Tiny localStorage-backed store for the Trading CRM, exposed to React via
// useSyncExternalStore. No backend required — everything persists in the
// browser so the demo runs instantly. Clearing the key re-seeds the book.

import { useSyncExternalStore } from "react";
import { AGENT_NAME, type Client, type ClientStatus, type Priority } from "./types";
import { seedClients } from "./seed";

const KEY = "trading-crm:v1";

let cache: Client[] | null = null;
const EMPTY: Client[] = [];
const listeners = new Set<() => void>();

function load(): Client[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Client[];
  } catch {
    /* ignore corrupt state and re-seed */
  }
  const seeded = seedClients();
  persist(seeded);
  return seeded;
}

function persist(next: Client[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  }
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

function getSnapshot(): Client[] {
  return cache ?? EMPTY;
}

function getServerSnapshot(): Client[] {
  return EMPTY;
}

/** Reactively read the full client book. Empty array during SSR / first paint. */
export function useClients(): Client[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function current(): Client[] {
  return cache ?? load();
}

// ---- mutations -------------------------------------------------------------

export function updateClient(id: string, patch: Partial<Client>) {
  commit(current().map((c) => (c.id === id ? { ...c, ...patch } : c)));
}

export interface CallResult {
  outcome: ClientStatus;
  note: string;
  nextFollowUp: string | null;
  priority?: Priority;
  deposit?: number; // amount funded on this call, if any
}

/** Log the outcome of a call and roll the client forward. */
export function logCall(id: string, result: CallResult) {
  const now = new Date().toISOString();
  commit(
    current().map((c) => {
      if (c.id !== id) return c;
      const deposit = result.deposit ?? 0;
      return {
        ...c,
        status: result.outcome,
        note: result.note.trim() || c.note,
        nextFollowUp: result.nextFollowUp,
        lastContact: now,
        priority: result.priority ?? c.priority,
        deposits: c.deposits + deposit,
        balance: c.balance + deposit,
        history: [
          {
            id: `${id}-${Date.now()}`,
            at: now,
            outcome: result.outcome,
            note: result.note.trim() || "(no note)",
            agent: AGENT_NAME,
          },
          ...c.history,
        ],
      };
    }),
  );
}

export function addClient(input: Partial<Client> & { name: string }) {
  const now = new Date().toISOString();
  const client: Client = {
    id: `c-${Date.now()}`,
    name: input.name,
    email: input.email ?? "",
    phone: input.phone ?? "",
    country: input.country ?? "",
    flag: input.flag ?? "🌐",
    source: input.source ?? "Manual",
    status: input.status ?? "new",
    priority: input.priority ?? "medium",
    balance: input.balance ?? 0,
    deposits: input.deposits ?? 0,
    assignedTo: input.assignedTo ?? AGENT_NAME,
    note: input.note ?? "",
    nextFollowUp: input.nextFollowUp ?? now,
    lastContact: null,
    createdAt: now,
    history: [],
  };
  commit([client, ...current()]);
  return client;
}

/** Wipe local state and re-seed the demo book. */
export function resetDemo() {
  const fresh = seedClients();
  commit(fresh);
}
