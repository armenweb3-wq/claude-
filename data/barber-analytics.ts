// Hustle Blends — business analytics engine.
//
// There is no live booking database yet, so this module synthesizes a realistic
// appointment history (deterministic, anchored to "now") and derives every
// business metric from it with PURE functions. When real bookings exist, drop
// the generated `appointments` array for your real one and the same
// `computeDashboard()` pipeline produces the numbers — nothing else changes.

import { services, barbers, type Service } from "./barber";

export type Appointment = {
  id: string;
  clientId: string;
  date: Date;
  serviceId: string;
  price: number;
  tip: number;
  barberId: string;
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
const realBarbers = barbers.filter((b) => b.id !== "any");
const byId = Object.fromEntries(services.map((s) => [s.id, s])) as Record<string, Service>;

type Archetype = {
  key: string;
  count: number;
  intervalMean: number; // avg days between visits
  intervalJitter: number;
  tenureDays: number; // how long they've been a client
  lastVisitMin: number; // days ago (range)
  lastVisitMax: number;
  tipRate: number;
  serviceWeights: Partial<Record<string, number>>;
  escalate?: boolean; // spend rises over time (a climbing client)
};

// Each archetype is just a generation recipe — segmentation later is computed
// from the actual appointment pattern, never from these labels.
const ARCHETYPES: Archetype[] = [
  {
    key: "vip",
    count: 5,
    intervalMean: 16,
    intervalJitter: 4,
    tenureDays: 430,
    lastVisitMin: 2,
    lastVisitMax: 12,
    tipRate: 0.18,
    serviceWeights: { "cut-beard": 3, "signature-cut": 2, "skin-fade": 2, "hot-towel-shave": 1 },
  },
  {
    key: "regular",
    count: 12,
    intervalMean: 28,
    intervalJitter: 6,
    tenureDays: 250,
    lastVisitMin: 5,
    lastVisitMax: 26,
    tipRate: 0.12,
    serviceWeights: { "skin-fade": 3, "signature-cut": 3, "beard-trim": 1, "cut-beard": 1 },
  },
  {
    key: "new-rising",
    count: 5,
    intervalMean: 19,
    intervalJitter: 4,
    tenureDays: 58,
    lastVisitMin: 3,
    lastVisitMax: 14,
    tipRate: 0.1,
    serviceWeights: { "skin-fade": 3, "signature-cut": 2 },
  },
  {
    key: "climbing",
    count: 3,
    intervalMean: 24,
    intervalJitter: 5,
    tenureDays: 140,
    lastVisitMin: 4,
    lastVisitMax: 15,
    tipRate: 0.12,
    serviceWeights: { "signature-cut": 2, "cut-beard": 2 },
    escalate: true,
  },
  {
    key: "at-risk",
    count: 6,
    intervalMean: 27,
    intervalJitter: 6,
    tenureDays: 210,
    lastVisitMin: 40,
    lastVisitMax: 60,
    tipRate: 0.1,
    serviceWeights: { "skin-fade": 2, "signature-cut": 2, "beard-trim": 1 },
  },
  {
    key: "lost",
    count: 8,
    intervalMean: 30,
    intervalJitter: 8,
    tenureDays: 175,
    lastVisitMin: 76,
    lastVisitMax: 170,
    tipRate: 0.08,
    serviceWeights: { "skin-fade": 2, "signature-cut": 2, "junior-cut": 1 },
  },
  {
    key: "occasional",
    count: 4,
    intervalMean: 55,
    intervalJitter: 15,
    tenureDays: 300,
    lastVisitMin: 10,
    lastVisitMax: 40,
    tipRate: 0.1,
    serviceWeights: { "signature-cut": 2, "hot-towel-shave": 1, "beard-trim": 1 },
  },
];

const NAMES = [
  "Andre Mills", "Tobias Reed", "Chris Dunn", "Marcus Tate", "Jared Boon",
  "Devon Clarke", "Eli Navarro", "Omar Haddad", "Pierre Laurent", "Sam Okafor",
  "Liam Doyle", "Noah Brandt", "Caleb Frost", "Mateo Rossi", "Isaiah Vaughn",
  "Hugo Pereira", "Kenji Watanabe", "Andre Sable", "Felix Romero", "Damian Wolfe",
  "Theo Marsh", "Rashid Amari", "Victor Salah", "Owen Pratt", "Lucas Greer",
  "Malik Owens", "Nathan Cole", "Diego Mata", "Aiden Brooks", "Ezra Lin",
  "Carter Voss", "Jonah Beck", "Ryan Castle", "Simon Wells", "Adrian Cruz",
  "Gabriel Stone", "Hassan Ali", "Levi Hart", "Julian Pace", "Cole Banner",
  "Marco Bianchi", "Reza Karimi", "Dominic Shaw",
];

function pickWeighted(weights: Partial<Record<string, number>>, r: number): string {
  const entries = Object.entries(weights) as [string, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let t = r * total;
  for (const [id, w] of entries) {
    if ((t -= w) <= 0) return id;
  }
  return entries[0][0];
}

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
      visitTimes.reverse(); // oldest → newest

      const total = visitTimes.length;
      visitTimes.forEach((t, i) => {
        // Escalating clients buy cheaper early, pricier later.
        let serviceId: string;
        if (arc.escalate) {
          const progress = total > 1 ? i / (total - 1) : 1;
          serviceId =
            progress < 0.4
              ? "beard-trim"
              : progress < 0.75
                ? "signature-cut"
                : "cut-beard";
        } else {
          serviceId = pickWeighted(arc.serviceWeights, rng());
        }
        const svc = byId[serviceId] ?? services[0];
        const tip = Math.round(svc.price * arc.tipRate * (0.6 + rng() * 0.8));
        appointments.push({
          id: `a${apptId++}`,
          clientId,
          date: new Date(t),
          serviceId,
          price: svc.price,
          tip,
          barberId: realBarbers[Math.floor(rng() * realBarbers.length)].id,
        });
      });
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
  // Monday-anchored weeks ending with the current week.
  const today = startOfDay(now);
  const dow = (today.getDay() + 6) % 7;
  const thisMonday = today.getTime() - dow * DAY;
  const out: Bucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = thisMonday - i * 7 * DAY;
    const end = start + 7 * DAY;
    const { revenue, cuts } = revenueIn(appts, start, end);
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
    const start = d.getTime();
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
    const { revenue, cuts } = revenueIn(appts, start, end);
    out.push({ label: d.toLocaleDateString("en-US", { month: "short" }), revenue, cuts });
  }
  return out;
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
  monthlyValue: number; // typical spend per 30 days while active
  spendTrend: number; // recent avg ticket − early avg ticket
  recencyRatio: number; // daysSinceLast ÷ usual interval (>1 = overdue)
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
    const tenureDays = Math.max(
      1,
      (lastVisit.getTime() - firstVisit.getTime()) / DAY,
    );
    const avgIntervalDays = visits > 1 ? tenureDays / (visits - 1) : 30;
    const avgTicket = visits ? lifetimeValue / visits : 0;
    const monthlyValue = (lifetimeValue / Math.max(tenureDays, 1)) * 30;
    const early = list.slice(0, 2);
    const recent = list.slice(-2);
    const avg = (xs: Appointment[]) =>
      xs.length ? xs.reduce((s, a) => s + a.price + a.tip, 0) / xs.length : 0;
    const spendTrend = avg(recent) - avg(early);
    const recencyRatio = daysSinceLast / Math.max(avgIntervalDays, 7);

    // Most-booked service for context.
    const svcCount: Record<string, number> = {};
    for (const a of list) svcCount[a.serviceId] = (svcCount[a.serviceId] ?? 0) + 1;
    const topServiceId =
      Object.entries(svcCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    const topService = byId[topServiceId]?.name ?? "—";

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
      topService,
    };
  });

  // Monetary threshold for VIP = top quartile of active lifetime value.
  const ltvSorted = [...raw].map((r) => r.lifetimeValue).sort((a, b) => a - b);
  const vipThreshold = ltvSorted[Math.floor(ltvSorted.length * 0.75)] ?? Infinity;

  return raw.map((r) => {
    const tenureDays = Math.max(
      1,
      (r.lastVisit.getTime() - r.firstVisit.getTime()) / DAY,
    );
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
      ((tenureDays < 95 && r.avgIntervalDays <= 32) || r.spendTrend >= 12)
    ) {
      segment = "high-potential";
    } else if (r.lifetimeValue >= vipThreshold && r.visits >= 6 && r.daysSinceLast <= 40) {
      segment = "vip";
    } else {
      segment = "regular";
    }

    // Potential = forward-looking value: frequency + recent momentum + runway.
    const frequencyScore = Math.min(1, 30 / Math.max(r.avgIntervalDays, 7));
    const momentumScore = Math.max(0, Math.min(1, r.spendTrend / 25 + 0.4));
    const runwayScore = Math.max(0, Math.min(1, (120 - tenureDays) / 120));
    const valueScore = Math.min(1, r.monthlyValue / 120);
    const potential = Math.round(
      (frequencyScore * 0.3 + momentumScore * 0.25 + runwayScore * 0.2 + valueScore * 0.25) *
        100,
    );

    const action =
      segment === "lost"
        ? `Win-back text + 20% off — last seen ${r.daysSinceLast}d ago`
        : segment === "at-risk"
          ? `"We miss you" message + priority slot this week`
          : segment === "high-potential"
            ? `Lock in a loyalty card — rebook on the spot`
            : segment === "vip"
              ? `Reserved standing slot + ask for a referral`
              : `Keep the rhythm — nudge to rebook near day ${Math.round(r.avgIntervalDays)}`;

    return { ...r, segment, potential, action };
  });
}

// ── Public API: one call returns everything the dashboard needs ──────────────
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

  // Revenue slipping away = recurring monthly value of churned + at-risk clients.
  const revenueAtRisk = Math.round(
    [...atRisk, ...lost].reduce((s, c) => s + c.monthlyValue, 0),
  );

  // New clients whose first-ever visit was this calendar month.
  const newThisMonth = stats.filter(
    (s) => s.firstVisit.getTime() >= monthStart,
  ).length;

  const retention = Math.round((active.length / stats.length) * 100);

  // Service mix (by revenue) and barber performance.
  const serviceMix = services
    .map((svc) => {
      const rows = appointments.filter((a) => a.serviceId === svc.id);
      const revenue = rows.reduce((s, a) => s + a.price + a.tip, 0);
      return { name: svc.name, revenue, count: rows.length };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const barberPerf = realBarbers
    .map((b) => {
      const rows = appointments.filter((a) => a.barberId === b.id);
      const revenue = rows.reduce((s, a) => s + a.price + a.tip, 0);
      return { name: b.name, revenue, count: rows.length };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const byPotential = (a: ClientStat, b: ClientStat) => b.potential - a.potential;
  const byValue = (a: ClientStat, b: ClientStat) => b.lifetimeValue - a.lifetimeValue;
  const byRecency = (a: ClientStat, b: ClientStat) => b.daysSinceLast - a.daysSinceLast;

  return {
    now,
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
    serviceMix,
    barberPerf,
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
