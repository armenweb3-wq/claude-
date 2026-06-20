import Link from "next/link";
import type { Metadata } from "next";
import { shop, currency } from "@/data/barber";
import { computeDashboard } from "@/data/barber-analytics";
import TrendChart from "@/components/barber/dashboard/TrendChart";
import {
  Kpi,
  SegmentBar,
  BarList,
  ClientTable,
} from "@/components/barber/dashboard/parts";

export const metadata: Metadata = {
  title: `${shop.name} — Business Dashboard`,
  description: "Revenue, growth and client retention insights for the shop.",
  robots: { index: false },
};

export default function DashboardPage() {
  const d = computeDashboard();
  const k = d.kpis;
  const asOf = d.now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <main className="mx-auto max-w-editorial px-6 py-12 lg:px-10 lg:py-16">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brass">
            Owner · Business Dashboard
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-tight sm:text-5xl">
            {shop.name}
          </h1>
          <p className="mt-2 text-sm text-bone/50">As of {asOf}</p>
        </div>
        <Link
          href="/barber"
          className="rounded-full border border-coal-line px-6 py-3 text-xs font-semibold uppercase tracking-widest text-bone/70 transition-colors hover:border-brass hover:text-brass"
        >
          ← Back to shop
        </Link>
      </div>

      {/* KPI row */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="This week"
          value={`${currency}${k.thisWeek.toLocaleString()}`}
          delta={k.weekDelta}
          sub={`${k.thisWeekCuts} cuts · vs last wk`}
        />
        <Kpi
          label="This month"
          value={`${currency}${k.thisMonth.toLocaleString()}`}
          delta={k.monthDelta}
          sub={`${k.thisMonthCuts} cuts · vs last mo`}
        />
        <Kpi label="Avg ticket" value={`${currency}${k.avgTicket}`} sub="incl. tips" />
        <Kpi
          label="Active clients"
          value={`${k.activeClients}`}
          sub={`${k.retention}% retained`}
        />
        <Kpi label="New this month" value={`${k.newThisMonth}`} sub="first-time clients" />
        <Kpi
          label="Revenue at risk"
          value={`${currency}${k.revenueAtRisk.toLocaleString()}`}
          sub="/mo from churn"
          tone="warn"
        />
      </section>

      {/* Trend + client base */}
      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart weekly={d.weekly} monthly={d.monthly} />
        </div>
        <SegmentBar counts={d.segmentCounts} />
      </section>

      {/* Busiest days */}
      <section className="mt-6">
        <BarList title="Busiest Days (last 12 weeks)" rows={d.weekday} />
      </section>

      {/* Client intelligence */}
      <section className="mt-14">
        <h2 className="font-display text-3xl font-bold uppercase tracking-tight">
          Client Intelligence
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-bone/55">
          Who to grow, who to win back, and who you&apos;ve lost — each with the next
          move. Built from visit frequency, spend, and how overdue each client is.
        </p>

        <div className="mt-8 space-y-6">
          <ClientTable
            title="High-Potential Clients"
            caption="Newer or accelerating clients worth investing in now — book them in for the long run."
            accent="green"
            rows={d.highPotential}
            metric="potential"
          />
          <ClientTable
            title="Slipping Away — Win Back Now"
            caption="Regulars who are overdue. A nudge this week likely saves the relationship."
            accent="amber"
            rows={d.atRisk}
            metric="daysSinceLast"
          />
          <ClientTable
            title="Lost Clients"
            caption="No visit in over 10 weeks. Reactivating even a few recovers real monthly revenue."
            accent="red"
            rows={d.lost}
            metric="lostValue"
          />
        </div>
      </section>

      <p className="mt-12 rounded-xl border border-coal-line bg-coal-soft p-5 text-xs leading-relaxed text-bone/45">
        Figures are modeled from a sample appointment history so the dashboard is
        fully populated. Connect the booking endpoint
        (<code className="text-bone/70">/api/barber/booking</code>) to a real
        datastore and the same analytics pipeline
        (<code className="text-bone/70">computeDashboard()</code>) runs on live
        bookings — no UI changes needed.
      </p>
    </main>
  );
}
