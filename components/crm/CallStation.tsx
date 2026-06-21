"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { logCall, useClients } from "@/lib/crm/store";
import { useSession } from "@/lib/crm/session";
import { callQueue, isOverdue } from "@/lib/crm/selectors";
import { clock, pct, relative, usd } from "@/lib/crm/format";
import { STATUS_META, type Client, type LeadStatus, type Priority } from "@/lib/crm/types";
import { Avatar, CountryTag, Icon, KycBadge, RiskDot, Sparkline, StatusBadge, TierBadge } from "./ui";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const METHODS = ["Visa", "Mastercard", "Bank Wire", "Skrill", "Crypto (USDT)"];

const OUTCOMES: { key: string; value: LeadStatus; label: string }[] = [
  { key: "1", value: "no_answer", label: "No Answer" },
  { key: "2", value: "callback", label: "Callback" },
  { key: "3", value: "qualified", label: "Qualified" },
  { key: "4", value: "deposited", label: "Deposited" },
  { key: "5", value: "not_interested", label: "Lost" },
];

type FU = "1h" | "tonight" | "tomorrow" | "3d" | "week" | "none" | "custom";
const FOLLOWUPS: { key: FU; label: string }[] = [
  { key: "1h", label: "In 1 hour" },
  { key: "tonight", label: "This evening" },
  { key: "tomorrow", label: "Tomorrow 9:00" },
  { key: "3d", label: "In 3 days" },
  { key: "week", label: "Next week" },
  { key: "none", label: "No follow-up" },
];

function resolveFU(key: FU, custom: string): string | null {
  const now = new Date();
  switch (key) {
    case "1h": return new Date(Date.now() + HOUR).toISOString();
    case "tonight": { const d = new Date(now); d.setHours(18, 0, 0, 0); if (d.getTime() < Date.now()) d.setTime(Date.now() + HOUR); return d.toISOString(); }
    case "tomorrow": { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString(); }
    case "3d": return new Date(Date.now() + 3 * DAY).toISOString();
    case "week": return new Date(Date.now() + 7 * DAY).toISOString();
    case "none": return null;
    case "custom": return custom ? new Date(custom).toISOString() : null;
  }
}

export default function CallStation() {
  const clients = useClients();
  const agent = useSession();
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ count: 0, deposited: 0 });

  const queue = useMemo(() => callQueue(clients, agent?.id), [clients, agent?.id]);
  const current = queue.find((c) => !handled.has(c.id)) ?? null;
  const remaining = queue.filter((c) => !handled.has(c.id)).length;
  const total = stats.count + remaining;

  if (clients.length === 0 || !agent) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">Loading queue…</div>;
  }

  if (!current) {
    return <AllClear stats={stats} onReset={() => { setHandled(new Set()); setStats({ count: 0, deposited: 0 }); }} />;
  }

  const onSave = (deposit: number) => {
    setHandled((p) => new Set(p).add(current.id));
    setStats((s) => ({ count: s.count + 1, deposited: s.deposited + deposit }));
  };
  const onSkip = () => setHandled((p) => new Set(p).add(current.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">Call Station</h1>
          <p className="text-sm text-slate-500">Call {stats.count + 1} · {remaining} left in queue</p>
        </div>
        <Link href="/crm" className="text-sm text-slate-400 hover:text-slate-200">Exit</Link>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-500" style={{ width: `${total ? (stats.count / total) * 100 : 100}%` }} />
      </div>

      <CallCard key={current.id} client={current} agentId={agent.id} onSave={onSave} onSkip={onSkip} />
    </div>
  );
}

function CallCard({ client, agentId, onSave, onSkip }: { client: Client; agentId: string; onSave: (d: number) => void; onSkip: () => void }) {
  const [outcome, setOutcome] = useState<LeadStatus>(client.status === "new" ? "qualified" : client.status === "dormant" ? "callback" : client.status);
  const [note, setNote] = useState(client.note);
  const [fu, setFu] = useState<FU>("tomorrow");
  const [custom, setCustom] = useState("");
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [priority, setPriority] = useState<Priority>(client.priority);

  useEffect(() => {
    if (outcome === "not_interested") setFu("none");
    else if (outcome === "deposited") setFu("week");
    else if (outcome === "no_answer") setFu("3d");
    else if (outcome === "callback") setFu("tomorrow");
    else setFu("tomorrow");
  }, [outcome]);

  const save = useCallback(() => {
    const amt = outcome === "deposited" ? Number(deposit) || 0 : 0;
    logCall(client.id, { outcome, note, nextFollowUp: resolveFU(fu, custom), priority, agentId, deposit: amt > 0 ? { amount: amt, method } : undefined });
    onSave(amt);
  }, [outcome, deposit, note, fu, custom, priority, agentId, method, client.id, onSave]);

  // keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save(); return; }
      if (typing) return;
      const hit = OUTCOMES.find((o) => o.key === e.key);
      if (hit) { setOutcome(hit.value); return; }
      if (e.key === "Enter") { e.preventDefault(); save(); }
      if (e.key.toLowerCase() === "s") onSkip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save, onSkip]);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* 360 profile */}
      <div className="space-y-3 lg:col-span-2">
        <div className="rounded-xl border border-white/[0.06] bg-slate-900/30 p-5">
          <div className="flex items-start gap-3">
            <Avatar name={client.name} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold tracking-tight text-slate-100">{client.name}</h2>
              <div className="mt-1 flex items-center gap-1.5">
                <CountryTag code={client.country.code} name={client.country.name} />
                <span className="text-xs text-slate-500">{client.source}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <TierBadge tier={client.tier} />
                <KycBadge kyc={client.kyc} />
                <RiskDot risk={client.risk} />
              </div>
            </div>
          </div>

          <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 font-mono text-base font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-500/20 transition-colors hover:bg-emerald-500/20">
            <Icon.phone className="h-4 w-4" /> {client.phone}
          </a>

          {client.equity > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Equity</p>
                <p className="text-lg font-semibold tabular-nums text-slate-100">{usd(client.equity)}</p>
                <p className={`text-[11px] tabular-nums ${client.pnlPct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{pct(client.pnlPct)} · {usd(client.deposits)} deposited</p>
              </div>
              <Sparkline data={client.equityCurve} positive={client.pnlPct >= 0} className="h-10 w-28" />
            </div>
          )}

          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="Due" value={clock(client.nextFollowUp)} cls={isOverdue(client) ? "text-amber-300" : "text-slate-300"} />
            <Row label="Last contact" value={relative(client.lastContact)} />
            <Row label="Last login" value={relative(client.lastLogin)} />
            <Row label="Lead score" value={`${client.score}/100`} />
          </dl>
        </div>

        {client.activity.length > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-slate-900/30 p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recent history</h3>
            <ul className="mt-3 space-y-2.5">
              {client.activity.slice(0, 4).map((a) => (
                <li key={a.id} className="flex gap-2.5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.outcome ? STATUS_META[a.outcome].dot : "bg-emerald-400"}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500"><span className="capitalize text-slate-400">{a.outcome ? STATUS_META[a.outcome].label : a.kind}</span> · {relative(a.at)}</p>
                    <p className="text-[13px] text-slate-400">{a.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Disposition */}
      <div className="rounded-xl border border-white/[0.06] bg-slate-900/30 p-5 lg:col-span-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Log this call</h3>
          <span className="hidden text-[11px] text-slate-600 sm:block">Press <Kbd>1</Kbd>–<Kbd>5</Kbd> · <Kbd>↵</Kbd> save · <Kbd>S</Kbd> skip</span>
        </div>

        <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-slate-500">Outcome</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OUTCOMES.map((o) => (
            <button
              key={o.value}
              onClick={() => setOutcome(o.value)}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium ring-1 ring-inset transition-colors ${
                outcome === o.value ? `${STATUS_META[o.value].bg} ${STATUS_META[o.value].fg} ring-current` : "bg-white/[0.03] text-slate-400 ring-white/10 hover:text-slate-200"
              }`}
            >
              {o.label}
              <Kbd>{o.key}</Kbd>
            </button>
          ))}
        </div>

        {outcome === "deposited" && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Deposit (USD)</label>
              <input type="number" inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="5000" className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm tabular-nums text-slate-100 outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/50">
                {METHODS.map((m) => <option key={m} className="bg-slate-900">{m}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Note / reminder for next call</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What did you discuss? What should you say next time?" className="mt-1.5 w-full resize-none rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm leading-relaxed text-slate-100 outline-none focus:border-emerald-500/50" />
        </div>

        <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-slate-500">Schedule next call</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FOLLOWUPS.map((f) => (
            <button key={f.key} onClick={() => setFu(f.key)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors ${fu === f.key ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" : "bg-white/[0.03] text-slate-400 ring-white/10 hover:text-slate-200"}`}>{f.label}</button>
          ))}
          <input type="datetime-local" value={custom} onChange={(e) => { setCustom(e.target.value); setFu("custom"); }} className={`rounded-lg border bg-slate-950/60 px-3 py-1.5 text-sm text-slate-300 outline-none ${fu === "custom" ? "border-emerald-500/50" : "border-white/10"}`} />
        </div>

        <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-slate-500">Priority</p>
        <div className="mt-2 flex gap-2">
          {(["high", "medium", "low"] as Priority[]).map((p) => (
            <button key={p} onClick={() => setPriority(p)} className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium capitalize ring-1 ring-inset transition-colors ${priority === p ? "bg-white/10 text-slate-100 ring-white/20" : "bg-white/[0.03] text-slate-500 ring-white/10 hover:text-slate-300"}`}>{p}</button>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onSkip} className="rounded-lg border border-white/10 px-4 py-3 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200">Skip</button>
          <button onClick={save} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400">
            Save &amp; Next <Icon.arrow className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, cls = "text-slate-300" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`truncate text-right ${cls}`}>{value}</dd>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{children}</kbd>;
}

function AllClear({ stats, onReset }: { stats: { count: number; deposited: number }; onReset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
        <Icon.check className="h-8 w-8" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-100">Queue cleared</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-400">
        {stats.count} {stats.count === 1 ? "call" : "calls"} worked this session
        {stats.deposited > 0 && <> · <span className="font-semibold text-emerald-300">{usd(stats.deposited)}</span> in new deposits</>}.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/crm" className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400">Back to dashboard</Link>
        <button onClick={onReset} className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5">Run queue again</button>
      </div>
    </div>
  );
}
