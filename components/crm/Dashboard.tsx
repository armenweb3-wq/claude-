"use client";

import Link from "next/link";
import { useClients } from "@/lib/crm/store";
import {
  callQueue,
  dueNow,
  isOverdue,
  metrics,
  recentActivity,
} from "@/lib/crm/selectors";
import { clock, currency, greeting, longDate, relative } from "@/lib/crm/format";
import { AGENT_NAME, OPEN_STATUSES, STATUS_META, type ClientStatus } from "@/lib/crm/types";
import { Avatar, StatusBadge } from "./ui";

export default function Dashboard() {
  const clients = useClients();

  if (clients.length === 0) return <Loading />;

  const m = metrics(clients);
  const queue = callQueue(clients);
  const due = dueNow(clients);
  const upNext = queue.slice(0, 5);
  const activity = recentActivity(clients);

  // Pipeline distribution across the open statuses.
  const pipeline = OPEN_STATUSES.map((s) => ({
    status: s,
    count: clients.filter((c) => c.status === s).length,
  }));
  const pipelineTotal = pipeline.reduce((sum, p) => sum + p.count, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">{longDate()}</p>
          <h1 className="mt-0.5 text-2xl font-semibold text-slate-100">
            {greeting()}, {AGENT_NAME.split(" ")[0]}
          </h1>
        </div>
        <Link
          href="/crm/call"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
        >
          Start calling
          {due.length > 0 && (
            <span className="rounded-full bg-slate-950/20 px-2 py-0.5 text-xs">
              {due.length} due
            </span>
          )}
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Due now" value={m.dueNow} accent="text-emerald-300" hint="ready to call" />
        <Stat label="Overdue" value={m.overdue} accent="text-amber-300" hint="past follow-up" />
        <Stat label="New leads" value={m.newLeads} accent="text-sky-300" hint="never contacted" />
        <Stat label="AUM" value={currency(m.aum)} accent="text-slate-100" hint={`${m.funded} funded`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Up next */}
        <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-slate-900/40">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-200">Up next</h2>
            <Link href="/crm/call" className="text-xs font-medium text-emerald-300 hover:text-emerald-200">
              Open Call Station →
            </Link>
          </div>
          <ul className="divide-y divide-white/5">
            {upNext.map((c) => {
              const overdue = isOverdue(c);
              return (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={c.name} flag={c.flag} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-100">{c.name}</p>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{c.note}</p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className={`text-xs font-medium ${overdue ? "text-amber-300" : "text-slate-400"}`}>
                      {c.nextFollowUp ? relative(c.nextFollowUp) : "new"}
                    </p>
                    <p className="text-[11px] text-slate-600">{clock(c.nextFollowUp)}</p>
                  </div>
                </li>
              );
            })}
            {upNext.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-slate-500">
                Queue is clear — nice work. 🎉
              </li>
            )}
          </ul>
        </div>

        {/* Pipeline */}
        <div className="rounded-2xl border border-white/5 bg-slate-900/40">
          <div className="border-b border-white/5 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-200">Pipeline</h2>
          </div>
          <div className="space-y-3 px-5 py-4">
            {pipeline.map((p) => (
              <div key={p.status}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-400">{STATUS_META[p.status].label}</span>
                  <span className="font-medium text-slate-300">{p.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${barColor(p.status)}`}
                    style={{ width: `${(p.count / pipelineTotal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs">
              <span className="text-slate-500">Lifetime deposits</span>
              <span className="font-semibold text-emerald-300">{currency(m.deposited)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-2xl border border-white/5 bg-slate-900/40">
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-200">Recent activity</h2>
        </div>
        <ul className="divide-y divide-white/5">
          {activity.map(({ client, log }) => (
            <li key={log.id} className="flex items-start gap-3 px-5 py-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_META[log.outcome].dot}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-300">
                  <span className="font-medium text-slate-100">{client.name}</span>{" "}
                  marked <span className="text-slate-400">{STATUS_META[log.outcome].label}</span>
                </p>
                <p className="truncate text-xs text-slate-500">{log.note}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-600">{relative(log.at)}</span>
            </li>
          ))}
          {activity.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-slate-500">No calls logged yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string | number;
  accent: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/40 px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-600">{hint}</p>
    </div>
  );
}

function barColor(status: ClientStatus): string {
  return {
    new: "bg-sky-400",
    no_answer: "bg-zinc-400",
    callback: "bg-amber-400",
    interested: "bg-violet-400",
    deposited: "bg-emerald-400",
    not_interested: "bg-rose-400",
  }[status];
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
