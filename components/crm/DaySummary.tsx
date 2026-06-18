"use client";

import { useClients } from "@/lib/crm/store";
import { useSession } from "@/lib/crm/session";
import { daySummary } from "@/lib/crm/selectors";
import { clock, relative, usd } from "@/lib/crm/format";
import { STATUS_META } from "@/lib/crm/types";
import { Avatar, Icon } from "./ui";

export default function DaySummary() {
  const clients = useClients();
  const agent = useSession();
  if (clients.length === 0 || !agent) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">Loading…</div>;
  }

  const s = daySummary(clients, agent.id);
  const today = new Date(s.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const callMax = Math.max(1, ...s.byOutcome.map((o) => o.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">End-of-day report</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">{today}</h1>
          <p className="mt-1 text-sm text-slate-500">{agent.name} · {agent.desk}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5"
        >
          <Icon.report className="h-4 w-4" /> Export / print
        </button>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Calls made" value={String(s.callsMade)} sub={`${s.reached} reached`} />
        <Stat label="Deals closed" value={String(s.deals.length)} sub="first deposits & top-ups" accent="text-emerald-300" />
        <Stat label="Deposits booked" value={usd(s.depositsTotal)} sub="today" accent="text-emerald-300" />
        <Stat label="Callbacks booked" value={String(s.callbacksBooked)} sub={`${s.notesAdded} notes added`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Outcome breakdown */}
        <div className="rounded-xl border border-white/[0.06] bg-slate-900/30">
          <div className="border-b border-white/5 px-5 py-3.5"><h2 className="text-sm font-semibold text-slate-200">Call outcomes</h2></div>
          <div className="space-y-3 px-5 py-4">
            {s.byOutcome.map((o) => (
              <div key={o.outcome}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-400">{STATUS_META[o.outcome].label}</span>
                  <span className="font-medium tabular-nums text-slate-200">{o.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div className={`h-full rounded-full ${STATUS_META[o.outcome].dot}`} style={{ width: `${(o.count / callMax) * 100}%` }} />
                </div>
              </div>
            ))}
            {s.byOutcome.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No calls logged today yet.</p>}
          </div>
        </div>

        {/* Deals closed */}
        <div className="rounded-xl border border-white/[0.06] bg-slate-900/30 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-200">Deals closed today</h2>
            <span className="text-xs tabular-nums text-emerald-300">{usd(s.depositsTotal)}</span>
          </div>
          <ul className="divide-y divide-white/5">
            {s.deals.map((d, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={d.client.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">{d.client.name}</p>
                  <p className="text-[11px] text-slate-500">{d.method} · {clock(d.at)}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-emerald-300">{usd(d.amount)}</span>
              </li>
            ))}
            {s.deals.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-500">No deals closed yet today.</li>}
          </ul>
        </div>
      </div>

      {/* Call log */}
      <div className="rounded-xl border border-white/[0.06] bg-slate-900/30">
        <div className="border-b border-white/5 px-5 py-3.5"><h2 className="text-sm font-semibold text-slate-200">Today&apos;s call log</h2></div>
        <ul className="divide-y divide-white/5">
          {s.calls.map((c, i) => (
            <li key={i} className="flex items-start gap-3 px-5 py-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c.outcome ? STATUS_META[c.outcome].dot : "bg-slate-400"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-300">
                  <span className="font-medium text-slate-100">{c.client.name}</span>
                  {c.outcome && <span className="text-slate-500"> · {STATUS_META[c.outcome].label}</span>}
                </p>
                <p className="truncate text-xs text-slate-500">{c.body}</p>
              </div>
              <span className="shrink-0 text-[11px] text-slate-600">{relative(c.at)}</span>
            </li>
          ))}
          {s.calls.length === 0 && <li className="px-5 py-10 text-center text-sm text-slate-500">Nothing logged today. Head to the Call Station to get started.</li>}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent = "text-slate-100" }: { label: string; value: string; sub: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-900/30 px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${accent}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}
