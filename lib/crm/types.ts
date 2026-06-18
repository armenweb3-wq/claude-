// Trading CRM — domain model.
//
// Self-contained: shares nothing with the marketplace or property apps. The
// data layer is abstracted behind the store (see store.ts) so the localStorage
// backing can later be swapped for Supabase/an API without touching the UI.

export type LeadStatus =
  | "new" // untouched lead
  | "no_answer" // attempted, no contact
  | "callback" // callback scheduled
  | "qualified" // engaged, working toward first deposit
  | "deposited" // FTD — first-time deposit landed
  | "active" // funded & trading
  | "dormant" // funded but gone quiet
  | "not_interested"; // lost

export type Tier = "standard" | "gold" | "platinum" | "vip";
export type Kyc = "none" | "pending" | "verified" | "rejected";
export type Risk = "low" | "medium" | "high";
export type Priority = "high" | "medium" | "low";

export interface Country {
  name: string;
  code: string; // ISO-3166 alpha-2, shown as a mono pill (no emoji)
}

export interface DepositRecord {
  date: string; // ISO
  amount: number;
  method: string;
}

export interface Activity {
  id: string;
  at: string; // ISO
  kind: "call" | "note" | "system" | "deposit" | "email";
  outcome?: LeadStatus;
  body: string;
  agentId: string;
}

export interface Position {
  id: string;
  symbol: string; // e.g. EUR/USD, XAU/USD, BTC/USD, US500
  side: "buy" | "sell";
  size: number; // lots / units
  entry: number;
  pnl: number; // open P/L in USD
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: Country;
  source: string;
  status: LeadStatus;
  tier: Tier;
  kyc: Kyc;
  risk: Risk;
  priority: Priority;
  score: number; // lead/health score 0-100

  // money
  balance: number; // cash balance, USD
  equity: number; // account equity (balance + open P/L), USD
  pnlPct: number; // open P/L as % of equity
  deposits: number; // lifetime deposited
  withdrawals: number; // lifetime withdrawn
  depositHistory: DepositRecord[];
  equityCurve: number[]; // last ~24 points, for sparkline
  positions: Position[]; // open trades

  // workflow
  ownerId: string; // assigned agent
  note: string; // live working note — drives the next-call reminder
  nextFollowUp: string | null; // ISO
  lastContact: string | null; // ISO
  lastLogin: string | null; // ISO — last platform login
  createdAt: string; // ISO
  activity: Activity[]; // newest first
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  password: string; // demo-only; never do this with a real backend
  role: "agent" | "manager";
  desk: string;
  monthlyTarget: number; // deposit target, USD
}

// ---- presentation metadata -------------------------------------------------

export const STATUS_META: Record<
  LeadStatus,
  { label: string; fg: string; bg: string; dot: string; stage: Stage | null }
> = {
  new: { label: "New", fg: "text-sky-300", bg: "bg-sky-500/10 ring-sky-500/25", dot: "bg-sky-400", stage: "new" },
  no_answer: { label: "No Answer", fg: "text-zinc-300", bg: "bg-zinc-500/10 ring-zinc-500/25", dot: "bg-zinc-400", stage: "attempting" },
  callback: { label: "Callback", fg: "text-amber-300", bg: "bg-amber-500/10 ring-amber-500/25", dot: "bg-amber-400", stage: "attempting" },
  qualified: { label: "Qualified", fg: "text-violet-300", bg: "bg-violet-500/10 ring-violet-500/25", dot: "bg-violet-400", stage: "engaged" },
  deposited: { label: "Deposited", fg: "text-emerald-300", bg: "bg-emerald-500/10 ring-emerald-500/25", dot: "bg-emerald-400", stage: "deposited" },
  active: { label: "Active", fg: "text-emerald-300", bg: "bg-emerald-500/10 ring-emerald-500/25", dot: "bg-emerald-400", stage: "deposited" },
  dormant: { label: "Dormant", fg: "text-orange-300", bg: "bg-orange-500/10 ring-orange-500/25", dot: "bg-orange-400", stage: "deposited" },
  not_interested: { label: "Lost", fg: "text-rose-300", bg: "bg-rose-500/10 ring-rose-500/25", dot: "bg-rose-400", stage: null },
};

export type Stage = "new" | "attempting" | "engaged" | "deposited";

export const PIPELINE_STAGES: { key: Stage; label: string }[] = [
  { key: "new", label: "New Leads" },
  { key: "attempting", label: "Attempting Contact" },
  { key: "engaged", label: "Engaged" },
  { key: "deposited", label: "Funded" },
];

export const TIER_META: Record<Tier, { label: string; cls: string }> = {
  standard: { label: "Standard", cls: "text-zinc-300 ring-zinc-500/30" },
  gold: { label: "Gold", cls: "text-amber-300 ring-amber-500/40" },
  platinum: { label: "Platinum", cls: "text-cyan-200 ring-cyan-400/40" },
  vip: { label: "VIP", cls: "text-fuchsia-200 ring-fuchsia-400/40" },
};

export const KYC_META: Record<Kyc, { label: string; cls: string }> = {
  none: { label: "No KYC", cls: "text-zinc-400 ring-zinc-500/30" },
  pending: { label: "KYC Pending", cls: "text-amber-300 ring-amber-500/30" },
  verified: { label: "KYC Verified", cls: "text-emerald-300 ring-emerald-500/30" },
  rejected: { label: "KYC Rejected", cls: "text-rose-300 ring-rose-500/30" },
};

export const RISK_META: Record<Risk, { label: string; cls: string }> = {
  low: { label: "Low risk", cls: "text-emerald-300" },
  medium: { label: "Medium risk", cls: "text-amber-300" },
  high: { label: "High risk", cls: "text-rose-300" },
};

// Statuses that keep a client in the active calling queue.
export const OPEN_STATUSES: LeadStatus[] = ["new", "no_answer", "callback", "qualified", "dormant"];
