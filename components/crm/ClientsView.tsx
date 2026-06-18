"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { resetDemo, useClients } from "@/lib/crm/store";
import { isOverdue } from "@/lib/crm/selectors";
import { clock, currency, relative } from "@/lib/crm/format";
import {
  STATUS_META,
  type Client,
  type ClientStatus,
} from "@/lib/crm/types";
import { Avatar, PriorityBadge, StatusBadge } from "./ui";

type Filter = "all" | ClientStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "callback", label: "Callback" },
  { key: "interested", label: "Interested" },
  { key: "no_answer", label: "No Answer" },
  { key: "deposited", label: "Deposited" },
  { key: "not_interested", label: "Lost" },
];

export default function ClientsView() {
  const clients = useClients();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.phone.includes(q)
      );
    });
  }, [clients, query, filter]);

  const active = selected ? clients.find((c) => c.id === selected) ?? null : null;

  if (clients.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Loading clients…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Clients</h1>
          <p className="text-sm text-slate-500">{clients.length} in your book</p>
        </div>
        <button
          onClick={() => {
            if (confirm("Reset the demo book to its original sample clients?")) resetDemo();
          }}
          className="self-start rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
        >
          Reset demo data
        </button>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, country, phone…"
          className="w-full rounded-lg border border-white/10 bg-slate-900/40 px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500/50"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                filter === f.key
                  ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                  : "bg-white/5 text-slate-400 ring-white/10 hover:text-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table (desktop) */}
      <div className="hidden overflow-hidden rounded-2xl border border-white/5 md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Balance</th>
              <th className="px-4 py-3 font-medium">Next call</th>
              <th className="px-4 py-3 font-medium">Last contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelected(c.id)}
                className="cursor-pointer bg-slate-900/40 transition-colors hover:bg-white/5"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.name} flag={c.flag} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-100">{c.name}</p>
                      <p className="truncate text-xs text-slate-500">{c.country}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3 text-slate-300">{currency(c.balance)}</td>
                <td className={`px-4 py-3 ${isOverdue(c) ? "text-amber-300" : "text-slate-400"}`}>
                  {clock(c.nextFollowUp)}
                </td>
                <td className="px-4 py-3 text-slate-500">{relative(c.lastContact)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="bg-slate-900/40 px-4 py-10 text-center text-sm text-slate-500">
            No clients match.
          </p>
        )}
      </div>

      {/* Cards (mobile) */}
      <div className="space-y-2 md:hidden">
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-slate-900/40 px-4 py-3 text-left"
          >
            <Avatar name={c.name} flag={c.flag} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-100">{c.name}</p>
              <div className="mt-1"><StatusBadge status={c.status} /></div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm text-slate-300">{currency(c.balance)}</p>
              <p className={`text-xs ${isOverdue(c) ? "text-amber-300" : "text-slate-500"}`}>
                {relative(c.nextFollowUp)}
              </p>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500">No clients match.</p>
        )}
      </div>

      {active && <ClientDetail client={active} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ClientDetail({ client, onClose }: { client: Client; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-slate-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-white/5 bg-slate-900/95 px-5 py-4 backdrop-blur">
          <h2 className="text-base font-semibold text-slate-100">Client details</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="flex items-start gap-4">
            <Avatar name={client.name} flag={client.flag} size="lg" />
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-100">{client.name}</h3>
              <p className="text-sm text-slate-500">{client.country} · {client.source}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={client.status} />
                <PriorityBadge priority={client.priority} />
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Field label="Phone" value={client.phone} />
            <Field label="Email" value={client.email} />
            <Field label="Balance" value={currency(client.balance)} />
            <Field label="Deposits" value={currency(client.deposits)} />
            <Field label="Next call" value={clock(client.nextFollowUp)} />
            <Field label="Last contact" value={relative(client.lastContact)} />
          </div>

          {client.note && (
            <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Note</p>
              <p className="mt-1 text-sm text-slate-300">{client.note}</p>
            </div>
          )}

          <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Call history
          </h4>
          <ul className="mt-3 space-y-3">
            {client.history.map((h) => (
              <li key={h.id} className="flex gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_META[h.outcome].dot}`} />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">
                    <span className="text-slate-300">{STATUS_META[h.outcome].label}</span> · {relative(h.at)}
                  </p>
                  <p className="text-sm text-slate-400">{h.note}</p>
                </div>
              </li>
            ))}
            {client.history.length === 0 && (
              <li className="text-sm text-slate-500">No calls logged yet.</li>
            )}
          </ul>

          <Link
            href="/crm/call"
            className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
          >
            Go to Call Station →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-slate-200">{value}</p>
    </div>
  );
}
