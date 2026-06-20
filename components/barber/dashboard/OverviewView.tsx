import { currency } from "@/data/barber";
import type { Dashboard } from "@/data/barber-analytics";
import TrendChart from "./TrendChart";
import { Kpi, SegmentBar, BarList, ClientTable } from "./parts";

export default function OverviewView({ d }: { d: Dashboard }) {
  const k = d.kpis;
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        <Kpi label="Active clients" value={`${k.activeClients}`} sub={`${k.retention}% retained`} />
        <Kpi label="New this month" value={`${k.newThisMonth}`} sub="first-time clients" />
        <Kpi
          label="Revenue at risk"
          value={`${currency}${k.revenueAtRisk.toLocaleString()}`}
          sub="/mo from churn"
          tone="warn"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart weekly={d.weekly} monthly={d.monthly} />
        </div>
        <SegmentBar counts={d.segmentCounts} />
      </section>

      <section>
        <BarList title="Busiest Days (last 12 weeks)" rows={d.weekday} />
      </section>

      <section className="space-y-6">
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
          Client Intelligence
        </h2>
        <ClientTable
          title="High-Potential Clients"
          caption="Newer or accelerating clients worth investing in now."
          accent="green"
          rows={d.highPotential}
          metric="potential"
        />
        <ClientTable
          title="Slipping Away — Win Back Now"
          caption="Regulars who are overdue. A nudge this week likely saves them."
          accent="amber"
          rows={d.atRisk}
          metric="daysSinceLast"
        />
        <ClientTable
          title="Lost Clients"
          caption="No visit in over 10 weeks. Reactivating a few recovers real monthly revenue."
          accent="red"
          rows={d.lost}
          metric="lostValue"
        />
      </section>
    </div>
  );
}
