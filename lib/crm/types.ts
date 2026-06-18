// Trading CRM — domain types.
// This module is self-contained and shares nothing with the marketplace or
// property apps. All data lives client-side (localStorage); see store.ts.

export type ClientStatus =
  | "new" // brand new lead, never contacted
  | "no_answer" // tried, didn't pick up
  | "callback" // callback scheduled
  | "interested" // warm, working toward a deposit
  | "deposited" // converted — funded account
  | "not_interested"; // closed/lost

export type Priority = "high" | "medium" | "low";

// A single logged interaction, newest pushed to the front of `history`.
export interface CallLog {
  id: string;
  at: string; // ISO timestamp
  outcome: ClientStatus;
  note: string;
  agent: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  flag: string; // emoji flag for quick visual scanning
  source: string; // lead source (e.g. "Google Ads", "Webinar")
  status: ClientStatus;
  priority: Priority;
  balance: number; // current account balance, USD
  deposits: number; // lifetime deposited, USD
  assignedTo: string; // agent / desk
  note: string; // the live working note — drives the reminder ("call them about…")
  nextFollowUp: string | null; // ISO — when to call next
  lastContact: string | null; // ISO — last time we spoke
  createdAt: string; // ISO
  history: CallLog[];
}

export const STATUS_META: Record<
  ClientStatus,
  { label: string; tone: string; dot: string }
> = {
  new: {
    label: "New Lead",
    tone: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
    dot: "bg-sky-400",
  },
  no_answer: {
    label: "No Answer",
    tone: "bg-zinc-500/10 text-zinc-300 ring-zinc-500/30",
    dot: "bg-zinc-400",
  },
  callback: {
    label: "Callback",
    tone: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    dot: "bg-amber-400",
  },
  interested: {
    label: "Interested",
    tone: "bg-violet-500/10 text-violet-300 ring-violet-500/30",
    dot: "bg-violet-400",
  },
  deposited: {
    label: "Deposited",
    tone: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    dot: "bg-emerald-400",
  },
  not_interested: {
    label: "Not Interested",
    tone: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
    dot: "bg-rose-400",
  },
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; tone: string }
> = {
  high: { label: "High", tone: "text-rose-300 bg-rose-500/10 ring-rose-500/30" },
  medium: {
    label: "Medium",
    tone: "text-amber-300 bg-amber-500/10 ring-amber-500/30",
  },
  low: { label: "Low", tone: "text-zinc-400 bg-zinc-500/10 ring-zinc-500/30" },
};

// Statuses that keep a client in the active calling queue.
export const OPEN_STATUSES: ClientStatus[] = [
  "new",
  "no_answer",
  "callback",
  "interested",
];

export const AGENT_NAME = "Alex Morgan";
