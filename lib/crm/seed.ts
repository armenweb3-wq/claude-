// Demo book for the Trading CRM. Generated relative to "now" so the desk always
// looks live — a handful of calls overdue, several due today, the rest scheduled
// out. Hand-crafted hot leads sit at the top to drive the next-call reminder.

import type {
  Activity,
  Agent,
  Client,
  Country,
  LeadStatus,
  Tier,
} from "./types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();

export const AGENTS: Agent[] = [
  { id: "ag_alex", name: "Alex Morgan", email: "alex.morgan@vantage.io", password: "vantage", role: "agent", desk: "Acquisition Desk" },
  { id: "ag_nadia", name: "Nadia Rahman", email: "nadia.rahman@vantage.io", password: "vantage", role: "manager", desk: "Acquisition Desk" },
  { id: "ag_marco", name: "Marco Bianchi", email: "marco.bianchi@vantage.io", password: "vantage", role: "agent", desk: "Retention Desk" },
];

export const PRIMARY_AGENT = AGENTS[0];

// Deterministic RNG so the book is stable per seed but realistically varied.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const C = {
  GB: { name: "United Kingdom", code: "GB" },
  DE: { name: "Germany", code: "DE" },
  AE: { name: "United Arab Emirates", code: "AE" },
  SG: { name: "Singapore", code: "SG" },
  IT: { name: "Italy", code: "IT" },
  ES: { name: "Spain", code: "ES" },
  FR: { name: "France", code: "FR" },
  SE: { name: "Sweden", code: "SE" },
  CH: { name: "Switzerland", code: "CH" },
  ZA: { name: "South Africa", code: "ZA" },
  NG: { name: "Nigeria", code: "NG" },
  IN: { name: "India", code: "IN" },
  JP: { name: "Japan", code: "JP" },
  BR: { name: "Brazil", code: "BR" },
  AU: { name: "Australia", code: "AU" },
  CA: { name: "Canada", code: "CA" },
} satisfies Record<string, Country>;

const SOURCES = ["Google Ads", "Meta Ads", "Webinar", "Referral", "Organic", "Affiliate", "Trading View"];
const METHODS = ["Visa", "Mastercard", "Bank Wire", "Skrill", "Crypto (USDT)"];

function curve(rng: () => number, start: number, drift: number): number[] {
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < 24; i++) {
    v = Math.max(0, v * (1 + drift * (rng() - 0.45)));
    out.push(Math.round(v));
  }
  return out;
}

let n = 0;
const id = () => `cl_${(++n).toString().padStart(3, "0")}`;
const aid = () => `ac_${Math.random().toString(36).slice(2, 8)}`;

interface Hot {
  name: string;
  phone: string;
  country: Country;
  status: LeadStatus;
  tier: Tier;
  note: string;
  followUp: number; // ms offset from now
  source: string;
}

// Hand-crafted, time-sensitive leads — these are what the agent calls first.
const HOT: Hot[] = [
  {
    name: "Daniel Okafor", phone: "+44 7700 900112", country: C.GB, status: "qualified", tier: "gold", source: "Google Ads",
    note: "Bonus clears today — he committed to a $5k first deposit. Walk him through the platform, send the deposit link on the call, close it.",
    followUp: -2 * HOUR,
  },
  {
    name: "Sofia Marchetti", phone: "+39 351 552 0198", country: C.IT, status: "callback", tier: "standard", source: "Webinar",
    note: "Asked for a callback this morning after speaking to her husband. Ready with €2k. Don't let it cool off.",
    followUp: -35 * 60_000,
  },
  {
    name: "Mohammed Al-Rashid", phone: "+971 50 123 4567", country: C.AE, status: "qualified", tier: "vip", source: "Referral",
    note: "HNW referral, talking $25k+ for a VIP account. Send the VIP terms before the call. Offer the dedicated account manager.",
    followUp: 45 * 60_000,
  },
  {
    name: "Fatima Zahra", phone: "+212 612 345678", country: { name: "Morocco", code: "MA" }, status: "new", tier: "standard", source: "Meta Ads",
    note: "Hit 'request a call' 20 minutes ago. Speed-to-lead — call now while she's at her desk.",
    followUp: -15 * 60_000,
  },
  {
    name: "Chen Wei", phone: "+65 8123 4567", country: C.SG, status: "new", tier: "platinum", source: "Trading View",
    note: "Came off the TradingView funnel, downloaded the index strategy guide. Qualify budget and trading experience.",
    followUp: 2 * HOUR,
  },
  {
    name: "Lucas Pereira", phone: "+55 11 91234 5678", country: C.BR, status: "callback", tier: "standard", source: "Google Ads",
    note: "At work — call this evening his time. Interested in FX majors and gold.",
    followUp: 5 * HOUR,
  },
];

const FIRST = ["James", "Emma", "Liam", "Olivia", "Noah", "Ava", "Lucas", "Mia", "Ethan", "Isabella", "Mason", "Sophia", "Logan", "Amelia", "Henrik", "Yuki", "Priya", "Kwame", "Olga", "Carlos", "Aisha", "Thomas", "Ingrid", "Diego", "Hannah", "Omar"];
const LAST = ["Sullivan", "Johansson", "Schmidt", "Nguyen", "Patel", "Rossi", "Andersson", "Müller", "Tanaka", "Mensah", "Petrova", "Ramirez", "Bello", "Dubois", "Novak", "Costa", "Haddad", "Larsen", "Walsh", "Romano"];
const COUNTRIES = Object.values(C);

function genClient(rng: () => number): Client {
  const name = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`;
  const country = COUNTRIES[Math.floor(rng() * COUNTRIES.length)];
  const roll = rng();
  // distribution skewed toward funded/active accounts to make AUM realistic
  let status: LeadStatus;
  if (roll < 0.18) status = "active";
  else if (roll < 0.34) status = "deposited";
  else if (roll < 0.46) status = "dormant";
  else if (roll < 0.6) status = "qualified";
  else if (roll < 0.72) status = "no_answer";
  else if (roll < 0.82) status = "callback";
  else if (roll < 0.9) status = "new";
  else status = "not_interested";

  const funded = status === "active" || status === "deposited" || status === "dormant";
  const tierRoll = rng();
  const tier: Tier = tierRoll > 0.92 ? "vip" : tierRoll > 0.8 ? "platinum" : tierRoll > 0.55 ? "gold" : "standard";
  const tierMult = tier === "vip" ? 18 : tier === "platinum" ? 7 : tier === "gold" ? 2.5 : 1;

  const deposits = funded ? Math.round((1500 + rng() * 9000) * tierMult) : 0;
  const pnlPct = funded ? Math.round((rng() * 40 - 14) * 10) / 10 : 0;
  const equity = funded ? Math.max(0, Math.round(deposits * (1 + pnlPct / 100) - rng() * deposits * 0.2)) : 0;
  const withdrawals = funded && rng() > 0.6 ? Math.round(equity * rng() * 0.3) : 0;
  const balance = Math.round(equity * (0.7 + rng() * 0.3));

  const kyc = funded ? (rng() > 0.15 ? "verified" : "pending") : rng() > 0.7 ? "pending" : "none";
  const risk = pnlPct < -5 ? "high" : tier === "vip" || tier === "platinum" ? "medium" : rng() > 0.7 ? "medium" : "low";
  const score = Math.round(funded ? 60 + rng() * 40 : 20 + rng() * 60);

  // follow-up spread
  const fuRoll = rng();
  let nextFollowUp: string | null;
  if (status === "not_interested") nextFollowUp = null;
  else if (fuRoll < 0.15) nextFollowUp = iso(-Math.round(rng() * 6) * HOUR - HOUR); // overdue
  else if (fuRoll < 0.45) nextFollowUp = iso(Math.round(rng() * 8) * HOUR); // today
  else nextFollowUp = iso(Math.round(1 + rng() * 8) * DAY); // upcoming

  const lastContact = status === "new" ? null : iso(-Math.round(1 + rng() * 9) * DAY);
  const lastLogin = funded ? iso(-Math.round(rng() * 6) * DAY) : null;

  const depositHistory = [] as Client["depositHistory"];
  if (funded) {
    let acc = 0;
    const tranches = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < tranches; i++) {
      const amt = Math.round((deposits / tranches) * (0.7 + rng() * 0.6));
      acc += amt;
      depositHistory.push({ date: iso(-Math.round((tranches - i) * (3 + rng() * 20)) * DAY), amount: amt, method: METHODS[Math.floor(rng() * METHODS.length)] });
    }
    void acc;
  }

  const activity: Activity[] = [];
  const owner = AGENTS[Math.floor(rng() * AGENTS.length)].id;
  if (lastContact) {
    activity.push({ id: aid(), at: lastContact, kind: "call", outcome: status, body: outcomeNote(status, rng), agentId: owner });
  }
  if (funded && depositHistory.length) {
    activity.push({ id: aid(), at: depositHistory[depositHistory.length - 1].date, kind: "deposit", body: `Deposited ${usdRaw(depositHistory[depositHistory.length - 1].amount)} via ${depositHistory[depositHistory.length - 1].method}`, agentId: owner });
  }
  activity.sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return {
    id: id(),
    name,
    email: `${name.toLowerCase().replace(/[^a-z]/g, ".")}@${rng() > 0.5 ? "gmail.com" : "outlook.com"}`,
    phone: `+${10 + Math.floor(rng() * 80)} ${100 + Math.floor(rng() * 899)} ${1000 + Math.floor(rng() * 8999)}`,
    country,
    source: SOURCES[Math.floor(rng() * SOURCES.length)],
    status,
    tier,
    kyc,
    risk,
    priority: score > 75 ? "high" : score > 45 ? "medium" : "low",
    score,
    balance,
    equity,
    pnlPct,
    deposits,
    withdrawals,
    depositHistory,
    equityCurve: curve(rng, funded ? deposits : 1000, funded ? 0.06 : 0.02),
    ownerId: owner,
    note: workingNote(status, name),
    nextFollowUp,
    lastContact,
    lastLogin,
    createdAt: iso(-Math.round(2 + rng() * 40) * DAY),
    activity,
  };
}

function usdRaw(n: number) {
  return `$${n.toLocaleString("en-US")}`;
}

function outcomeNote(s: LeadStatus, rng: () => number): string {
  const pool: Record<string, string[]> = {
    no_answer: ["No answer, left a voicemail.", "Rang out — try a different time.", "Went to voicemail again."],
    callback: ["Asked to be called back later.", "Busy — scheduled a callback.", "Wants to talk after market close."],
    qualified: ["Good call. Keen on indices and gold.", "Engaged — sending platform walkthrough.", "Warm. Discussing deposit size."],
    deposited: ["First deposit landed. Onboarded to the platform.", "Funded the account on the call."],
    active: ["Trading actively. Happy with fills.", "Checked in — all good, considering a top-up."],
    dormant: ["Hasn't logged in for a while. Re-engage.", "Quiet lately — reactivation call needed."],
    new: ["First touch pending."],
    not_interested: ["Not interested. Just browsing.", "Asked not to be called again."],
  };
  const arr = pool[s] ?? ["Call logged."];
  return arr[Math.floor(rng() * arr.length)];
}

function workingNote(s: LeadStatus, name: string): string {
  const first = name.split(" ")[0];
  switch (s) {
    case "new": return "Fresh lead — qualify budget, experience and timeline on the first call.";
    case "no_answer": return `Couldn't reach ${first}. Try a different time slot before moving to the nurture sequence.`;
    case "callback": return `${first} asked for a callback. Pick up where we left off and push for the deposit.`;
    case "qualified": return `${first} is warm. Recap the value, handle objections, get the first deposit in.`;
    case "deposited": return `${first} just funded. Confirm onboarding and set expectations for week one.`;
    case "active": return `${first} is trading. Review performance and explore a top-up or tier upgrade.`;
    case "dormant": return `${first} has gone quiet. Reactivation call — find out what stalled.`;
    case "not_interested": return "Closed. Email-only nurture.";
  }
}

export function seedClients(): Client[] {
  n = 0;
  const rng = mulberry32(20260618);

  const hot: Client[] = HOT.map((h) => {
    const base = genClient(rng);
    return {
      ...base,
      name: h.name,
      phone: h.phone,
      country: h.country,
      status: h.status,
      tier: h.tier,
      source: h.source,
      note: h.note,
      nextFollowUp: iso(h.followUp),
      ownerId: PRIMARY_AGENT.id,
      priority: "high",
      score: Math.max(base.score, 80),
      email: `${h.name.toLowerCase().replace(/[^a-z]/g, ".")}@gmail.com`,
    };
  });

  const rest = Array.from({ length: 22 }, () => genClient(rng));
  // ensure a healthy slice is owned by the primary agent so the queue is full
  rest.forEach((c, i) => {
    if (i % 2 === 0) c.ownerId = PRIMARY_AGENT.id;
  });

  return [...hot, ...rest];
}
