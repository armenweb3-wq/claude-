"use client";

// Agent session. Demo-grade auth that validates against the seeded agent list
// and persists the signed-in agent id in localStorage. Swap for real auth later
// — the rest of the app only depends on useSession()/signIn()/signOut().

import { useSyncExternalStore } from "react";
import { AGENTS } from "./seed";
import type { Agent } from "./types";

const KEY = "vantage-crm:session:v1";

let cache: string | null | undefined; // undefined = not yet read
const listeners = new Set<() => void>();

function read(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

function subscribe(cb: () => void) {
  if (cache === undefined) cache = read();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getSnapshot = () => (cache === undefined ? null : cache);
const getServerSnapshot = () => null;

/** Returns the signed-in agent, or null. */
export function useSession(): Agent | null {
  const id = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return AGENTS.find((a) => a.id === id) ?? null;
}

/** True once the session has been read on the client (avoids redirect flash). */
export function useSessionReady(): boolean {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return cache !== undefined;
}

export function signIn(email: string, password: string): { ok: true; agent: Agent } | { ok: false; error: string } {
  const agent = AGENTS.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  if (!agent || agent.password !== password) {
    return { ok: false, error: "Invalid email or password." };
  }
  cache = agent.id;
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, agent.id);
  listeners.forEach((l) => l());
  return { ok: true, agent };
}

export function signOut() {
  cache = null;
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}
