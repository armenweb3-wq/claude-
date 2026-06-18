"use client";

import Link from "next/link";
import { useClients } from "@/lib/crm/store";
import { useSession } from "@/lib/crm/session";
import {
  byStage,
  callQueue,
  isOverdue,
  metrics,
  recentActivity,
} from "@/lib/crm/selectors";
import { clock, greeting, longDate, pct, relative, usd } from "@/lib/crm/format";
import { PIPELINE_STAGES, STATUS_META } from "@/lib/crm/types";
import { Avatar, CountryTag, Icon, Sparkline, StatusBadge, TierBadge } from "./ui";

export default function Dashboard() {
  const clients = useClients();
  const agent = useSession();

  if (clients.length === 0 || !agent) return <Loading />;

  const m = metrics(clients, agent.id);
  const queue = callQueue(clients, agent.id);
  const upNext = queue.slice(0, 6);
  const stages = byStage(clients, agent.id);
  const activity = recentActivity(clients.filter((c) => c.ownerId === agent.id));
  const top = clients
    .filter((c) => c.ownerId === agent.id && c.equity > 0)
    .sort((a, b) => b.equity - a.equity)
    .slice(0, 5);

  const stageMax = Math.max(1, ...PIPELINE_STAGES.map((s) => stages[s.key].length));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">{longDate()}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">
            {greeting()}, {agent.name.split(" ")[0]}
          </h1>
        </div>
        <Link
          href="/crm/call"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
        >
          <Icon.phone className="h-4 w-4" /> Start calling
          {m.dueNow > 0 && <span className="rounded-full bg-slate-950/20 px-2 py-0.5 text-xs">{m.dueNow}</span>}
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Assets under mgmt" value={usd(m.aum, { compact: true })} sub={`${m.funded} funded accounts`} icon={<Icon.trend className="h-4 w-4" />} />
        <Kpi label="Net deposits" value={usd(m.netDeposits, { compact: true })} sub={`${m.ftdToday} FTD today`} accent="text-emerald-300" icon={<Icon.bolt className="h-4 w-4" />} />
        <Kpi label="Calls due" value={String(m.dueNow)} sub={`${m.overdue} overdue`} accent={m.overdue ? "text-amber-300" : undefined} icon={<Icon.clock className="h-4 w-4" />} />
        <Kpi label="Conversion" value={pct(m.conversion, false)} sub={`avg P/L ${pct(m.avgPnl)}`} accent={m.avgPnl >= 0 ? "text-emerald-300" : "text-rose-300"} icon={<Icon.shield className="h-4 w-4" />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Up next */}
        <div className="rounded-xl border border-white/[0.06] bg-slate-900/30 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-200">Your call queue</h2>
            <Link href="/crm/call" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200">
              Call Station <Icon.arrow className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-white/5">
            {upNext.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={c.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-100">{c.name}</p>
                    <CountryTag code={c.country.code} name={c.country.name} />
                    <TierBadge tier={c.tier} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{c.note}</p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <StatusBadge status={c.status} />
                  <p className={`mt-1 text-[11px] ${isOverdue(c) ? "text-amber-300" : "text-slate-500"}`}>{clock(c.nextFollowUp)}</p>
                </div>
              </li>
            ))}
            {upNext.length === 0 && <li className="px-5 py-10 text-center text-sm text-slate-500">Queue clear.</li>}
          </ul>
        </div>

        {/* Pipeline funnel */}
        <div className="rounded-xl border border-white/[0.06] bg-slate-900/30">
          <div className="border-b border-white/5 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-200">Pipeline</h2>
          </div>
          <div className="space-y-3.5 px-5 py-4">
            {PIPELINE_STAGES.map((s) => {
              const count = stages[s.key].length;
              return (
                <div key={s.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{s.label}</span>
                    <span className="font-medium tabular-nums text-slate-200">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400/80 to-teal-400/80" style={{ width: `${(count / stageMax) * 100}%` }} />
                  </div>
                </div>
              );
            })}
            <Link href="/crm/pipeline" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200">
              Open board <Icon.arrow className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Top accounts */}
        <div className="rounded-xl border border-white/[0.06] bg-slate-900/30">
          <div className="border-b border-white/5 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-200">Top accounts by equity</h2>
          </div>
          <ul className="divide-y divide-white/5">
            {top.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={c.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">{c.name}</p>
                  <p className="text-[11px] text-slate-500">{c.country.name}</p>
                </div>
                <Sparkline data={c.equityCurve} positive={c.pnlPct >= 0} />
                <div className="w-24 shrink-0 text-right">
                  <p className="text-sm font-medium tabular-nums text-slate-100">{usd(c.equity)}</p>
                  <p className={`text-[11px] tabular-nums ${c.pnlPct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{pct(c.pnlPct)}</p>
                </div>
              </li>
            ))}
            {top.length === 0 && <li className="px-5 py-10 text-center text-sm text-slate-500">No funded accounts yet.</li>}
          </ul>
        </div>

        {/* Activity */}
        <div className="rounded-xl border border-white/[0.06] bg-slate-900/30">
          <div className="border-b border-white/5 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-200">Recent activity</h2>
          </div>
          <ul className="divide-y divide-white/5">
            {activity.map(({ client, act }) => (
              <li key={act.id} className="flex items-start gap-3 px-5 py-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${act.outcome ? STATUS_META[act.outcome].dot : "bg-emerald-400"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-300"><span className="font-medium text-slate-100">{client.name}</span> · {act.kind === "deposit" ? "deposit" : act.outcome ? STATUS_META[act.outcome].label : act.kind}</p>
                  <p className="truncate text-xs text-slate-500">{act.body}</p>
                </div>
                <span className="shrink-0 text-[11px] text-slate-600">{relative(act.at)}</span>
              </li>
            ))}
            {activity.length === 0 && <li className="px-5 py-10 text-center text-sm text-slate-500">No activity yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, accent = "text-slate-100", icon }: { label: string; value: string; sub: string; accent?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-900/30 px-4 py-3.5">
      <div className="flex items-center justify-between text-slate-500">
        <p className="text-[11px] font-medium uppercase tracking-wider">{label}</p>
        {icon}
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${accent}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
        Loading your book…
      </div>
    </div>
  );
}
