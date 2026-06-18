// Demo client book for the Trading CRM.
// Timestamps are generated relative to "now" at seed time so the dashboard
// always looks live — a handful are overdue, several are due today, the rest
// are scheduled out into the coming days.

import { AGENT_NAME, type Client, type ClientStatus } from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

let counter = 0;
const id = () => `c${(++counter).toString().padStart(3, "0")}`;

type Seed = Omit<Client, "id" | "createdAt" | "history"> & {
  // history is generated from these prior outcomes
  past?: { agoMs: number; outcome: ClientStatus; note: string }[];
  createdAgoMs: number;
};

const seeds: Seed[] = [
  {
    name: "Daniel Okafor",
    email: "d.okafor@gmail.com",
    phone: "+44 7700 900112",
    country: "United Kingdom",
    flag: "🇬🇧",
    source: "Google Ads",
    status: "interested",
    priority: "high",
    balance: 0,
    deposits: 0,
    assignedTo: AGENT_NAME,
    note: "Hot lead. Said he'd fund $5k once his bonus clears on payday. Walk him through the platform demo and push for the starter deposit.",
    nextFollowUp: iso(-2 * HOUR), // overdue
    lastContact: iso(-1 * DAY),
    createdAgoMs: 4 * DAY,
    past: [
      {
        agoMs: 1 * DAY,
        outcome: "interested",
        note: "Great call. Very keen on gold + indices. Bonus lands this week.",
      },
      {
        agoMs: 3 * DAY,
        outcome: "no_answer",
        note: "No answer, left voicemail.",
      },
    ],
  },
  {
    name: "Sofia Marchetti",
    email: "sofia.march@outlook.com",
    phone: "+39 351 552 0198",
    country: "Italy",
    flag: "🇮🇹",
    source: "Webinar",
    status: "callback",
    priority: "high",
    balance: 0,
    deposits: 0,
    assignedTo: AGENT_NAME,
    note: "Asked me to call back this morning after she speaks to her husband. Ready to start with €2k.",
    nextFollowUp: iso(-30 * 60 * 1000), // overdue 30m
    lastContact: iso(-1 * DAY),
    createdAgoMs: 2 * DAY,
    past: [
      {
        agoMs: 1 * DAY,
        outcome: "callback",
        note: "Wants to discuss with husband. Call back tomorrow AM.",
      },
    ],
  },
  {
    name: "Mohammed Al-Rashid",
    email: "m.alrashid@gmail.com",
    phone: "+971 50 123 4567",
    country: "UAE",
    flag: "🇦🇪",
    source: "Referral",
    status: "interested",
    priority: "high",
    balance: 0,
    deposits: 0,
    assignedTo: AGENT_NAME,
    note: "High net worth referral. Wants a VIP account and 1-on-1 onboarding. Mentioned a $25k starting position.",
    nextFollowUp: iso(1 * HOUR),
    lastContact: iso(-2 * DAY),
    createdAgoMs: 5 * DAY,
    past: [
      {
        agoMs: 2 * DAY,
        outcome: "interested",
        note: "Serious money. Send him the VIP terms sheet before next call.",
      },
    ],
  },
  {
    name: "Chen Wei",
    email: "chen.wei.trades@gmail.com",
    phone: "+65 8123 4567",
    country: "Singapore",
    flag: "🇸🇬",
    source: "Facebook",
    status: "new",
    priority: "medium",
    balance: 0,
    deposits: 0,
    assignedTo: AGENT_NAME,
    note: "Fresh sign-up from this morning. Downloaded the crypto e-book. First contact — qualify budget & experience.",
    nextFollowUp: iso(2 * HOUR),
    lastContact: null,
    createdAgoMs: 6 * HOUR,
  },
  {
    name: "Emma Johansson",
    email: "emma.joh@telia.se",
    phone: "+46 70 123 45 67",
    country: "Sweden",
    flag: "🇸🇪",
    source: "Organic",
    status: "no_answer",
    priority: "medium",
    balance: 0,
    deposits: 0,
    assignedTo: AGENT_NAME,
    note: "Tried twice, no answer. Try again early afternoon — she works mornings.",
    nextFollowUp: iso(3 * HOUR),
    lastContact: iso(-1 * DAY),
    createdAgoMs: 3 * DAY,
    past: [
      { agoMs: 1 * DAY, outcome: "no_answer", note: "No answer." },
      { agoMs: 2 * DAY, outcome: "no_answer", note: "No answer, ringtone foreign." },
    ],
  },
  {
    name: "Lucas Pereira",
    email: "lucas.pereira@gmail.com",
    phone: "+55 11 91234 5678",
    country: "Brazil",
    flag: "🇧🇷",
    source: "Google Ads",
    status: "callback",
    priority: "medium",
    balance: 0,
    deposits: 0,
    assignedTo: AGENT_NAME,
    note: "Busy at work, asked to be called this evening his time. Interested in forex majors.",
    nextFollowUp: iso(5 * HOUR),
    lastContact: iso(-4 * HOUR),
    createdAgoMs: 1 * DAY,
    past: [
      { agoMs: 4 * HOUR, outcome: "callback", note: "At work, call tonight." },
    ],
  },
  {
    name: "Aisha Bello",
    email: "aisha.bello@yahoo.com",
    phone: "+234 803 123 4567",
    country: "Nigeria",
    flag: "🇳🇬",
    source: "Instagram",
    status: "interested",
    priority: "medium",
    balance: 0,
    deposits: 0,
    assignedTo: AGENT_NAME,
    note: "Keen but cautious — wants to start small with $250 to test withdrawals. Reassure on the withdrawal process.",
    nextFollowUp: iso(1 * DAY),
    lastContact: iso(-1 * DAY),
    createdAgoMs: 4 * DAY,
    past: [
      {
        agoMs: 1 * DAY,
        outcome: "interested",
        note: "Wants to test small first. Explain withdrawal flow.",
      },
    ],
  },
  {
    name: "Thomas Müller",
    email: "t.mueller@web.de",
    phone: "+49 151 2345 6789",
    country: "Germany",
    flag: "🇩🇪",
    source: "Webinar",
    status: "new",
    priority: "low",
    balance: 0,
    deposits: 0,
    assignedTo: AGENT_NAME,
    note: "Attended the indices webinar. Hasn't engaged since. Soft intro call.",
    nextFollowUp: iso(1 * DAY + 3 * HOUR),
    lastContact: null,
    createdAgoMs: 2 * DAY,
  },
  {
    name: "Priya Nair",
    email: "priya.nair@gmail.com",
    phone: "+91 98765 43210",
    country: "India",
    flag: "🇮🇳",
    source: "Referral",
    status: "callback",
    priority: "medium",
    balance: 0,
    deposits: 0,
    assignedTo: AGENT_NAME,
    note: "Referred by Mohammed. Wants info on commodities. Call back over the weekend.",
    nextFollowUp: iso(2 * DAY),
    lastContact: iso(-2 * DAY),
    createdAgoMs: 3 * DAY,
    past: [
      { agoMs: 2 * DAY, outcome: "callback", note: "Send commodities one-pager." },
    ],
  },
  {
    name: "James Sullivan",
    email: "jsullivan@gmail.com",
    phone: "+1 415 555 0142",
    country: "United States",
    flag: "🇺🇸",
    source: "Google Ads",
    status: "no_answer",
    priority: "low",
    balance: 0,
    deposits: 0,
    assignedTo: AGENT_NAME,
    note: "Three no-answers. Last attempt before moving to nurture email sequence.",
    nextFollowUp: iso(3 * DAY),
    lastContact: iso(-3 * DAY),
    createdAgoMs: 8 * DAY,
    past: [
      { agoMs: 3 * DAY, outcome: "no_answer", note: "No answer #3." },
      { agoMs: 5 * DAY, outcome: "no_answer", note: "No answer #2." },
      { agoMs: 7 * DAY, outcome: "no_answer", note: "No answer #1." },
    ],
  },
  // ---- Converted / funded accounts (show up in AUM, out of the call queue) ----
  {
    name: "Olga Petrova",
    email: "olga.petrova@gmail.com",
    phone: "+357 96 123456",
    country: "Cyprus",
    flag: "🇨🇾",
    source: "Referral",
    status: "deposited",
    priority: "high",
    balance: 14250,
    deposits: 12000,
    assignedTo: AGENT_NAME,
    note: "Funded $12k, account up nicely. Upsell to managed account next month.",
    nextFollowUp: iso(6 * DAY),
    lastContact: iso(-1 * DAY),
    createdAgoMs: 20 * DAY,
    past: [
      { agoMs: 5 * DAY, outcome: "deposited", note: "Deposited $12k. Onboarded to MT5." },
      { agoMs: 8 * DAY, outcome: "interested", note: "Negotiating bonus %." },
    ],
  },
  {
    name: "Kwame Mensah",
    email: "kwame.mensah@gmail.com",
    phone: "+233 24 123 4567",
    country: "Ghana",
    flag: "🇬🇭",
    source: "Instagram",
    status: "deposited",
    priority: "medium",
    balance: 1820,
    deposits: 2000,
    assignedTo: AGENT_NAME,
    note: "Started with $2k. Trading FX majors. Check in on his experience.",
    nextFollowUp: iso(4 * DAY),
    lastContact: iso(-2 * DAY),
    createdAgoMs: 14 * DAY,
    past: [
      { agoMs: 6 * DAY, outcome: "deposited", note: "Deposited $2k." },
    ],
  },
  {
    name: "Yuki Tanaka",
    email: "yuki.tanaka@gmail.com",
    phone: "+81 90 1234 5678",
    country: "Japan",
    flag: "🇯🇵",
    source: "Organic",
    status: "deposited",
    priority: "high",
    balance: 38900,
    deposits: 35000,
    assignedTo: AGENT_NAME,
    note: "VIP. $35k funded, very active on indices. White-glove service — quarterly review due.",
    nextFollowUp: iso(9 * DAY),
    lastContact: iso(-3 * DAY),
    createdAgoMs: 30 * DAY,
    past: [
      { agoMs: 10 * DAY, outcome: "deposited", note: "Top-up to $35k." },
    ],
  },
  {
    name: "Carlos Ramirez",
    email: "carlos.ramirez@gmail.com",
    phone: "+34 612 345 678",
    country: "Spain",
    flag: "🇪🇸",
    source: "Facebook",
    status: "not_interested",
    priority: "low",
    balance: 0,
    deposits: 0,
    assignedTo: AGENT_NAME,
    note: "Not interested — said he was just browsing. Do not call, email only.",
    nextFollowUp: null,
    lastContact: iso(-4 * DAY),
    createdAgoMs: 9 * DAY,
    past: [
      { agoMs: 4 * DAY, outcome: "not_interested", note: "Just browsing. Closed." },
    ],
  },
  {
    name: "Fatima Zahra",
    email: "fatima.zahra@gmail.com",
    phone: "+212 6 12 34 56 78",
    country: "Morocco",
    flag: "🇲🇦",
    source: "Google Ads",
    status: "new",
    priority: "high",
    balance: 0,
    deposits: 0,
    assignedTo: AGENT_NAME,
    note: "Just registered and clicked the 'request a call' button. Strike while hot — call ASAP.",
    nextFollowUp: iso(-15 * 60 * 1000), // overdue 15m — should surface as 'next'
    lastContact: null,
    createdAgoMs: 1 * HOUR,
  },
];

export function seedClients(): Client[] {
  counter = 0;
  return seeds.map((s) => {
    const { past, createdAgoMs, ...rest } = s;
    const history = (past ?? []).map((p) => ({
      id: `${id()}-h`,
      at: iso(-p.agoMs),
      outcome: p.outcome,
      note: p.note,
      agent: AGENT_NAME,
    }));
    return {
      ...rest,
      id: id(),
      createdAt: iso(-createdAgoMs),
      history,
    } satisfies Client;
  });
}
