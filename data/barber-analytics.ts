// Hustle Blends — business analytics engine.
//
// No live booking database yet, so this synthesizes a realistic appointment
// history (deterministic, anchored to "now") and derives every business metric
// with PURE functions. The shop runs one €15 service with one barber (Marios),
// so value differences come from how often clients visit and tip — which is
// exactly what drives the retention/RFM segmentation below. Swap the generated
// `appointments` for a real feed and `computeDashboard()` is unchanged.

import { mainService, barber } from "./barber";

export type Appointment = {
  id: string;
  clientId: string;
  date: Date;
  price: number;
  tip: number;
};

export type Client = { id: string; name: string };

// ── Deterministic PRNG so the demo dataset is stable build-to-build ──────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
const PRICE = mainService.price;

type Archetype = {
  key: string;
  count: number;
  intervalMean: number; // avg days between visits
  intervalJitter: number;
  tenureDays: number; // how long they've been a client
  lastVisitMin: number; // days ago (range)
  lastVisitMax: number;
  tipRate: number;
};

// Each archetype is a generation recipe — segmentation is computed from the
// actual visit pattern afterwards, never from these labels.
const ARCHETYPES: Archetype[] = [
  { key: "vip", count: 6, intervalMean: 14, intervalJitter: 3, tenureDays: 430, lastVisitMin: 2, lastVisitMax: 12, tipRate: 0.25 },
  { key: "regular", count: 14, intervalMean: 24, intervalJitter: 6, tenureDays: 260, lastVisitMin: 5, lastVisitMax: 24, tipRate: 0.15 },
  { key: "new-rising", count: 6, intervalMean: 17, intervalJitter: 4, tenureDays: 55, lastVisitMin: 3, lastVisitMax: 14, tipRate: 0.12 },
  { key: "at-risk", count: 6, intervalMean: 24, intervalJitter: 6, tenureDays: 210, lastVisitMin: 40, lastVisitMax: 60, tipRate: 0.1 },
  { key: "lost", count: 9, intervalMean: 28, intervalJitter: 8, tenureDays: 175, lastVisitMin: 76, lastVisitMax: 175, tipRate: 0.08 },
  { key: "occasional", count: 5, intervalMean: 50, intervalJitter: 14, tenureDays: 300, lastVisitMin: 10, lastVisitMax: 38, tipRate: 0.1 },
];

const NAMES = [
  "Andreas K.", "Yiannis P.", "Daniel R.", "Marco S.", "Costas M.",
  "Petros A.", "Nikos D.", "Stelios G.", "Loukas V.", "Christos N.",
  "Giorgos T.", "Antonis L.", "Michalis F.", "Savvas R.", "Panayiotis E.",
  "Elias B.", "Theo C.", "Marios I.", "Renos K.", "Andy P.",
  "Dimitris H.", "Alex T.", "Sotiris M.", "Charis V.", "Kyriakos D.",
  "Lefteris S.", "Pavlos A.", "Tasos G.", "Vasilis N.", "Haris L.",
  "Stavros P.", "Demis K.", "Orestis V.", "Fanos M.", "Iakovos R.",
  "Neo C.", "Aris D.", "Filippos T.", "Achilleas S.", "Rafael B.",
  "Leon H.", "Max V.", "Sammy P.", "Joel K.", "Adam R.", "Niko B.",
];

function generate(): { clients: Client[]; appointments: Appointment[]; now: Date } {
  const now = new Date();
  const rng = mulberry32(20260620);
  const clients: Client[] = [];
  const appointments: Appointment[] = [];
  let nameIdx = 0;
  let apptId = 0;

  for (const arc of ARCHETYPES) {
    for (let c = 0; c < arc.count; c++) {
      const clientId = `c${clients.length}`;
      clients.push({ id: clientId, name: NAMES[nameIdx++ % NAMES.length] });

      const lastVisitDaysAgo =
        arc.lastVisitMin + rng() * (arc.lastVisitMax - arc.lastVisitMin);
      let cursor = now.getTime() - lastVisitDaysAgo * DAY;
      const earliest = now.getTime() - arc.tenureDays * DAY;
      const visitTimes: number[] = [];
      while (cursor > earliest) {
        visitTimes.push(cursor);
        const interval = Math.max(
          7,
          arc.intervalMean + (rng() - 0.5) * 2 * arc.intervalJitter,
        );
        cursor -= interval * DAY;
      }
      if (visitTimes.length === 0) visitTimes.push(now.getTime() - lastVisitDaysAgo * DAY);

      for (const t of visitTimes) {
        const tip = Math.round(PRICE * arc.tipRate * (0.5 + rng()));
        appointments.push({ id: `a${apptId++}`, clientId, date: new Date(t), price: PRICE, tip });
      }
    }
  }

  return { clients, appointments, now };
}

// ── Aggregation helpers ──────────────────────────────────────────────────────
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function revenueIn(appts: Appointment[], start: number, end: number) {
  let revenue = 0;
  let cuts = 0;
  for (const a of appts) {
    const t = a.date.getTime();
    if (t >= start && t < end) {
      revenue += a.price + a.tip;
      cuts++;
    }
  }
  return { revenue, cuts };
}

export type Bucket = { label: string; revenue: number; cuts: number };

function weeklySeries(appts: Appointment[], now: Date, weeks: number): Bucket[] {
  const today = startOfDay(now);
  const dow = (today.getDay() + 6) % 7;
  const thisMonday = today.getTime() - dow * DAY;
  const out: Bucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = thisMonday - i * 7 * DAY;
    const { revenue, cuts } = revenueIn(appts, start, start + 7 * DAY);
    out.push({
      label: new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue,
      cuts,
    });
  }
  return out;
}

function monthlySeries(appts: Appointment[], now: Date, months: number): Bucket[] {
  const out: Bucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
    const { revenue, cuts } = revenueIn(appts, d.getTime(), end);
    out.push({ label: d.toLocaleDateString("en-US", { month: "short" }), revenue, cuts });
  }
  return out;
}

// Revenue by day-of-week over the last ~12 weeks — shows the barber his
// busiest days so he can plan hours and promos. Sunday/Thursday are closed.
function weekdayRevenue(appts: Appointment[], now: Date) {
  const since = now.getTime() - 84 * DAY;
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const rev = new Array(7).fill(0);
  const cnt = new Array(7).fill(0);
  for (const a of appts) {
    if (a.date.getTime() < since) continue;
    const idx = (a.date.getDay() + 6) % 7;
    rev[idx] += a.price + a.tip;
    cnt[idx]++;
  }
  return labels
    .map((name, i) => ({ name, revenue: rev[i], count: cnt[i] }))
    .filter((r) => r.count > 0);
}

// ── Per-client profile (the basis for all segmentation) ──────────────────────
export type ClientStat = {
  id: string;
  name: string;
  visits: number;
  lifetimeValue: number;
  firstVisit: Date;
  lastVisit: Date;
  daysSinceLast: number;
  avgIntervalDays: number;
  avgTicket: number;
  monthlyValue: number;
  spendTrend: number;
  recencyRatio: number;
  segment: Segment;
  potential: number;
  topService: string;
  action: string;
};

export type Segment = "vip" | "high-potential" | "regular" | "at-risk" | "lost";

function buildStats(clients: Client[], appts: Appointment[], now: Date): ClientStat[] {
  const byClient = new Map<string, Appointment[]>();
  for (const a of appts) {
    (byClient.get(a.clientId) ?? byClient.set(a.clientId, []).get(a.clientId)!).push(a);
  }

  const raw = clients.map((client) => {
    const list = (byClient.get(client.id) ?? []).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
    const visits = list.length;
    const lifetimeValue = list.reduce((s, a) => s + a.price + a.tip, 0);
    const firstVisit = list[0]?.date ?? now;
    const lastVisit = list[visits - 1]?.date ?? now;
    const daysSinceLast = Math.round((now.getTime() - lastVisit.getTime()) / DAY);
    const tenureDays = Math.max(1, (lastVisit.getTime() - firstVisit.getTime()) / DAY);
    const avgIntervalDays = visits > 1 ? tenureDays / (visits - 1) : 30;
    const avgTicket = visits ? lifetimeValue / visits : 0;
    const monthlyValue = (lifetimeValue / Math.max(tenureDays, 1)) * 30;
    const avg = (xs: Appointment[]) =>
      xs.length ? xs.reduce((s, a) => s + a.price + a.tip, 0) / xs.length : 0;
    const spendTrend = avg(list.slice(-2)) - avg(list.slice(0, 2));
    const recencyRatio = daysSinceLast / Math.max(avgIntervalDays, 7);

    return {
      id: client.id,
      name: client.name,
      visits,
      lifetimeValue,
      firstVisit,
      lastVisit,
      daysSinceLast,
      avgIntervalDays,
      avgTicket,
      monthlyValue,
      spendTrend,
      recencyRatio,
      topService: mainService.name,
    };
  });

  const ltvSorted = [...raw].map((r) => r.lifetimeValue).sort((a, b) => a - b);
  const vipThreshold = ltvSorted[Math.floor(ltvSorted.length * 0.75)] ?? Infinity;

  return raw.map((r) => {
    const tenureDays = Math.max(1, (r.lastVisit.getTime() - r.firstVisit.getTime()) / DAY);
    let segment: Segment;
    if (r.visits >= 2 && r.daysSinceLast > 70) {
      segment = "lost";
    } else if (
      r.visits >= 2 &&
      (r.daysSinceLast > 42 || (r.recencyRatio > 1.9 && r.daysSinceLast > 30))
    ) {
      segment = "at-risk";
    } else if (
      r.daysSinceLast <= 35 &&
      r.visits >= 2 &&
      tenureDays < 95 &&
      r.avgIntervalDays <= 30
    ) {
      segment = "high-potential";
    } else if (r.lifetimeValue >= vipThreshold && r.visits >= 8 && r.daysSinceLast <= 35) {
      segment = "vip";
    } else {
      segment = "regular";
    }

    const frequencyScore = Math.min(1, 28 / Math.max(r.avgIntervalDays, 7));
    const runwayScore = Math.max(0, Math.min(1, (120 - tenureDays) / 120));
    const valueScore = Math.min(1, r.monthlyValue / 60);
    const recencyScore = Math.max(0, Math.min(1, 1.5 - r.recencyRatio));
    const potential = Math.round(
      (frequencyScore * 0.34 + runwayScore * 0.22 + valueScore * 0.24 + recencyScore * 0.2) *
        100,
    );

    const action =
      segment === "lost"
        ? `Win-back DM + free beard tidy — last seen ${r.daysSinceLast}d ago`
        : segment === "at-risk"
          ? `"We miss you" text + priority slot this week`
          : segment === "high-potential"
            ? `Lock in a loyalty card — rebook on the spot`
            : segment === "vip"
              ? `Reserved standing slot + ask for a referral`
              : `Nudge to rebook around day ${Math.round(r.avgIntervalDays)}`;

    return { ...r, segment, potential, action };
  });
}

// ── Public API ───────────────────────────────────────────────────────────────
export type Dashboard = ReturnType<typeof computeDashboard>;

export function computeDashboard() {
  const { clients, appointments, now } = generate();
  const stats = buildStats(clients, appointments, now);

  const today = startOfDay(now);
  const dow = (today.getDay() + 6) % 7;
  const thisMonday = today.getTime() - dow * DAY;
  const thisWeek = revenueIn(appointments, thisMonday, thisMonday + 7 * DAY);
  const lastWeek = revenueIn(appointments, thisMonday - 7 * DAY, thisMonday);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const thisMonth = revenueIn(appointments, monthStart, monthEnd);
  const lastMonth = revenueIn(appointments, prevMonthStart, monthStart);

  const allRevenue = appointments.reduce((s, a) => s + a.price + a.tip, 0);
  const avgTicket = allRevenue / appointments.length;

  const active = stats.filter((s) => s.segment !== "lost");
  const lost = stats.filter((s) => s.segment === "lost");
  const atRisk = stats.filter((s) => s.segment === "at-risk");
  const highPotential = stats.filter((s) => s.segment === "high-potential");

  const revenueAtRisk = Math.round(
    [...atRisk, ...lost].reduce((s, c) => s + c.monthlyValue, 0),
  );
  const newThisMonth = stats.filter((s) => s.firstVisit.getTime() >= monthStart).length;
  const retention = Math.round((active.length / stats.length) * 100);

  const byPotential = (a: ClientStat, b: ClientStat) => b.potential - a.potential;
  const byValue = (a: ClientStat, b: ClientStat) => b.lifetimeValue - a.lifetimeValue;
  const byRecency = (a: ClientStat, b: ClientStat) => b.daysSinceLast - a.daysSinceLast;

  return {
    now,
    barberName: barber.name,
    kpis: {
      thisWeek: thisWeek.revenue,
      thisWeekCuts: thisWeek.cuts,
      weekDelta: pctDelta(thisWeek.revenue, lastWeek.revenue),
      thisMonth: thisMonth.revenue,
      thisMonthCuts: thisMonth.cuts,
      monthDelta: pctDelta(thisMonth.revenue, lastMonth.revenue),
      avgTicket: Math.round(avgTicket),
      activeClients: active.length,
      totalClients: stats.length,
      retention,
      revenueAtRisk,
      newThisMonth,
    },
    weekly: weeklySeries(appointments, now, 10),
    monthly: monthlySeries(appointments, now, 6),
    weekday: weekdayRevenue(appointments, now),
    highPotential: [...highPotential].sort(byPotential),
    atRisk: [...atRisk].sort(byRecency),
    lost: [...lost].sort(byValue),
    vips: stats.filter((s) => s.segment === "vip").sort(byValue),
    segmentCounts: countSegments(stats),
  };
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function countSegments(stats: ClientStat[]) {
  const order: Segment[] = ["vip", "high-potential", "regular", "at-risk", "lost"];
  return order.map((seg) => ({
    segment: seg,
    count: stats.filter((s) => s.segment === seg).length,
  }));
}
