"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { logCall, useClients } from "@/lib/crm/store";
import { callQueue, isOverdue } from "@/lib/crm/selectors";
import { clock, currency, relative } from "@/lib/crm/format";
import {
  STATUS_META,
  type ClientStatus,
  type Priority,
} from "@/lib/crm/types";
import { Avatar, PriorityBadge, StatusBadge } from "./ui";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Outcome buttons, in the order an agent thinks about them.
const OUTCOMES: { value: ClientStatus; label: string }[] = [
  { value: "no_answer", label: "No Answer" },
  { value: "callback", label: "Callback" },
  { value: "interested", label: "Interested" },
  { value: "deposited", label: "Deposited 🎉" },
  { value: "not_interested", label: "Not Interested" },
];

type FollowUpKey = "1h" | "tonight" | "tomorrow" | "3d" | "week" | "none" | "custom";

const FOLLOWUPS: { key: FollowUpKey; label: string }[] = [
  { key: "1h", label: "In 1 hour" },
  { key: "tonight", label: "This evening" },
  { key: "tomorrow", label: "Tomorrow 9:00" },
  { key: "3d", label: "In 3 days" },
  { key: "week", label: "Next week" },
  { key: "none", label: "No follow-up" },
];

function computeFollowUp(key: FollowUpKey, custom: string): string | null {
  const now = new Date();
  switch (key) {
    case "1h":
      return new Date(Date.now() + HOUR).toISOString();
    case "tonight": {
      const d = new Date(now);
      d.setHours(18, 0, 0, 0);
      if (d.getTime() < Date.now()) d.setTime(Date.now() + HOUR);
      return d.toISOString();
    }
    case "tomorrow": {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    }
    case "3d":
      return new Date(Date.now() + 3 * DAY).toISOString();
    case "week":
      return new Date(Date.now() + 7 * DAY).toISOString();
    case "none":
      return null;
    case "custom":
      return custom ? new Date(custom).toISOString() : null;
  }
}

export default function CallStation() {
  const clients = useClients();
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [done, setDone] = useState({ count: 0, deposited: 0 });

  const queue = useMemo(() => callQueue(clients), [clients]);
  const current = queue.find((c) => !handled.has(c.id)) ?? null;
  const position = done.count + 1;
  const remaining = queue.filter((c) => !handled.has(c.id)).length;

  if (clients.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
        <span className="ml-3">Loading queue…</span>
      </div>
    );
  }

  if (!current) {
    return <AllClear done={done} onReset={() => { setHandled(new Set()); setDone({ count: 0, deposited: 0 }); }} />;
  }

  const advance = (depositAdded: number) =>
    setDone((d) => ({ count: d.count + 1, deposited: d.deposited + depositAdded }));

  const handleSaved = (depositAdded: number) => {
    setHandled((prev) => new Set(prev).add(current.id));
    advance(depositAdded);
  };

  const handleSkip = () => {
    setHandled((prev) => new Set(prev).add(current.id));
  };

  return (
    <div className="space-y-5">
      {/* Progress strip */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Call Station</h1>
          <p className="text-sm text-slate-500">
            Call {position} · {remaining} {remaining === 1 ? "client" : "clients"} left in queue
          </p>
        </div>
        <Link href="/crm" className="text-sm text-slate-400 hover:text-slate-200">
          Exit
        </Link>
      </div>
      <ProgressBar done={done.count} total={done.count + remaining} />

      <CallCard
        key={current.id}
        client={current}
        onSave={handleSaved}
        onSkip={handleSkip}
      />
    </div>
  );
}

function CallCard({
  client,
  onSave,
  onSkip,
}: {
  client: ReturnType<typeof callQueue>[number];
  onSave: (depositAdded: number) => void;
  onSkip: () => void;
}) {
  const [outcome, setOutcome] = useState<ClientStatus>(
    client.status === "new" ? "interested" : client.status,
  );
  const [note, setNote] = useState(client.note);
  const [followUp, setFollowUp] = useState<FollowUpKey>("tomorrow");
  const [custom, setCustom] = useState("");
  const [deposit, setDeposit] = useState("");
  const [priority, setPriority] = useState<Priority>(client.priority);

  // When a terminal outcome is chosen, default to no follow-up.
  useEffect(() => {
    if (outcome === "not_interested") setFollowUp("none");
    if (outcome === "deposited") setFollowUp("week");
    if (outcome === "no_answer") setFollowUp("3d");
    if (outcome === "callback") setFollowUp("tomorrow");
  }, [outcome]);

  const save = () => {
    const depositNum = outcome === "deposited" ? Number(deposit) || 0 : 0;
    logCall(client.id, {
      outcome,
      note,
      nextFollowUp: computeFollowUp(followUp, custom),
      priority,
      deposit: depositNum,
    });
    onSave(depositNum);
  };

  const overdue = isOverdue(client);

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* Client profile */}
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-5">
          <div className="flex items-start gap-4">
            <Avatar name={client.name} flag={client.flag} size="lg" />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-slate-100">{client.name}</h2>
              <p className="text-sm text-slate-500">{client.country}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={client.status} />
                <PriorityBadge priority={client.priority} />
              </div>
            </div>
          </div>

          <a
            href={`tel:${client.phone.replace(/\s/g, "")}`}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-base font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-500/20 transition-colors hover:bg-emerald-500/20"
          >
            📞 {client.phone}
          </a>

          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Email" value={client.email} />
            <Row label="Source" value={client.source} />
            <Row label="Deposits" value={currency(client.deposits)} />
            <Row
              label="Due"
              value={clock(client.nextFollowUp)}
              valueClass={overdue ? "text-amber-300" : "text-slate-300"}
            />
            <Row label="Last contact" value={relative(client.lastContact)} />
          </dl>
        </div>

        {client.history.length > 0 && (
          <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Call history
            </h3>
            <ul className="mt-3 space-y-3">
              {client.history.slice(0, 4).map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_META[h.outcome].dot}`} />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">
                      <span className="text-slate-300">{STATUS_META[h.outcome].label}</span> ·{" "}
                      {relative(h.at)}
                    </p>
                    <p className="text-sm text-slate-400">{h.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Disposition form */}
      <div className="lg:col-span-3 rounded-2xl border border-white/5 bg-slate-900/40 p-5">
        <h3 className="text-sm font-semibold text-slate-200">Log this call</h3>

        {/* Outcome */}
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">Outcome</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {OUTCOMES.map((o) => (
            <button
              key={o.value}
              onClick={() => setOutcome(o.value)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset transition-colors ${
                outcome === o.value
                  ? `${STATUS_META[o.value].tone} ring-current`
                  : "bg-white/5 text-slate-400 ring-white/10 hover:text-slate-200"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Deposit amount, only for deposited */}
        {outcome === "deposited" && (
          <div className="mt-4">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Deposit amount (USD)
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="5000"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
            />
          </div>
        )}

        {/* Note */}
        <div className="mt-4">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Note / reminder for next time
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What did you discuss? What should you say next time?"
            className="mt-1.5 w-full resize-none rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Follow-up */}
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
          Schedule next call
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {FOLLOWUPS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFollowUp(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors ${
                followUp === f.key
                  ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                  : "bg-white/5 text-slate-400 ring-white/10 hover:text-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
          <input
            type="datetime-local"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setFollowUp("custom");
            }}
            className={`rounded-lg border bg-slate-950/60 px-3 py-1.5 text-sm text-slate-300 outline-none ${
              followUp === "custom" ? "border-emerald-500/50" : "border-white/10"
            }`}
          />
        </div>

        {/* Priority */}
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">Priority</p>
        <div className="mt-2 flex gap-2">
          {(["high", "medium", "low"] as Priority[]).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium capitalize ring-1 ring-inset transition-colors ${
                priority === p
                  ? "bg-white/10 text-slate-100 ring-white/20"
                  : "bg-white/5 text-slate-500 ring-white/10 hover:text-slate-300"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onSkip}
            className="rounded-lg border border-white/10 px-4 py-3 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
          >
            Skip
          </button>
          <button
            onClick={save}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
          >
            Save &amp; Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass = "text-slate-300",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`truncate text-right ${valueClass}`}>{value}</dd>
    </div>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 100 : Math.round((done / total) * 100);
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function AllClear({
  done,
  onReset,
}: {
  done: { count: number; deposited: number };
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-3xl">
        ✅
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-slate-100">Queue cleared</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-400">
        You worked through {done.count} {done.count === 1 ? "call" : "calls"} this session
        {done.deposited > 0 && (
          <>
            {" "}and brought in{" "}
            <span className="font-semibold text-emerald-300">{currency(done.deposited)}</span> in
            deposits
          </>
        )}
        . Nicely done.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/crm"
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
        >
          Back to dashboard
        </Link>
        <button
          onClick={onReset}
          className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5"
        >
          Run queue again
        </button>
      </div>
    </div>
  );
}
