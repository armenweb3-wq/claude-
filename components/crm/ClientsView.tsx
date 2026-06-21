"use client";

import { useMemo, useState } from "react";
import { resetDemo, useClients } from "@/lib/crm/store";
import { useSession } from "@/lib/crm/session";
import { isOverdue } from "@/lib/crm/selectors";
import { clock, pct, relative, usd } from "@/lib/crm/format";
import { type LeadStatus } from "@/lib/crm/types";
import { Avatar, CountryTag, Icon, KycBadge, Sparkline, StatusBadge, TierBadge } from "./ui";
import ClientDrawer from "./ClientDrawer";

type Filter = "all" | "mine" | "queue" | "funded" | LeadStatus;
type SortKey = "name" | "equity" | "pnl" | "next";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "My book" },
  { key: "queue", label: "In queue" },
  { key: "funded", label: "Funded" },
  { key: "new", label: "New" },
  { key: "qualified", label: "Qualified" },
  { key: "deposited", label: "Deposited" },
  { key: "not_interested", label: "Lost" },
];

export default function ClientsView() {
  const clients = useClients();
  const agent = useSession();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "equity", dir: -1 });

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "name" ? 1 : -1 }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = clients.filter((c) => {
      if (filter === "mine" && c.ownerId !== agent?.id) return false;
      if (filter === "queue" && !["new", "no_answer", "callback", "qualified", "dormant"].includes(c.status)) return false;
      if (filter === "funded" && !["active", "deposited", "dormant"].includes(c.status)) return false;
      if (["new", "qualified", "deposited", "not_interested"].includes(filter) && c.status !== filter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.country.name.toLowerCase().includes(q) ||
        c.phone.includes(q)
      );
    });
    const cmp = (a: typeof rows[number], b: typeof rows[number]) => {
      switch (sort.key) {
        case "name": return a.name.localeCompare(b.name) * sort.dir;
        case "equity": return (a.equity - b.equity) * sort.dir;
        case "pnl": return (a.pnlPct - b.pnlPct) * sort.dir;
        case "next": return ((a.nextFollowUp ? +new Date(a.nextFollowUp) : Infinity) - (b.nextFollowUp ? +new Date(b.nextFollowUp) : Infinity)) * sort.dir;
      }
    };
    return rows.sort(cmp);
  }, [clients, query, filter, agent?.id, sort]);

  const active = selected ? clients.find((c) => c.id === selected) ?? null : null;

  if (clients.length === 0) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">Loading clients…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">{filtered.length} of {clients.length} accounts</p>
        </div>
        <button
          onClick={() => { if (confirm("Reset the book to the original sample data?")) resetDemo(); }}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
        >
          Reset data
        </button>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Icon.search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, country, phone…"
            className="w-full rounded-lg border border-white/10 bg-slate-900/30 py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500/50"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                filter === f.key ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" : "bg-white/[0.03] text-slate-400 ring-white/10 hover:text-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table (desktop) */}
      <div className="hidden overflow-hidden rounded-xl border border-white/[0.06] md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/5 bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <Th label="Client" k="name" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-2.5 font-medium">Status</th>
              <Th label="Equity" k="equity" sort={sort} onSort={toggleSort} />
              <Th label="P/L" k="pnl" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-2.5 font-medium">KYC</th>
              <Th label="Next call" k="next" sort={sort} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((c) => (
              <tr key={c.id} onClick={() => setSelected(c.id)} className="cursor-pointer bg-slate-900/20 transition-colors hover:bg-white/[0.04]">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={c.name} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-medium text-slate-100">{c.name}</p>
                        <TierBadge tier={c.tier} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <CountryTag code={c.country.code} name={c.country.name} />
                        <span className="text-[11px] text-slate-500">{c.source}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-2.5 font-medium tabular-nums text-slate-200">{c.equity ? usd(c.equity) : "—"}</td>
                <td className="px-4 py-2.5">
                  {c.equity ? (
                    <div className="flex items-center gap-2">
                      <Sparkline data={c.equityCurve} positive={c.pnlPct >= 0} className="h-5 w-14" />
                      <span className={`tabular-nums text-xs ${c.pnlPct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{pct(c.pnlPct)}</span>
                    </div>
                  ) : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-2.5"><KycBadge kyc={c.kyc} /></td>
                <td className={`px-4 py-2.5 text-xs ${isOverdue(c) ? "text-amber-300" : "text-slate-400"}`}>{clock(c.nextFollowUp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="bg-slate-900/20 px-4 py-10 text-center text-sm text-slate-500">No clients match.</p>}
      </div>

      {/* Cards (mobile) */}
      <div className="space-y-2 md:hidden">
        {filtered.map((c) => (
          <button key={c.id} onClick={() => setSelected(c.id)} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-slate-900/30 px-4 py-3 text-left">
            <Avatar name={c.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-medium text-slate-100">{c.name}</p>
                <TierBadge tier={c.tier} />
              </div>
              <div className="mt-1"><StatusBadge status={c.status} /></div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-medium tabular-nums text-slate-200">{c.equity ? usd(c.equity) : "—"}</p>
              <p className={`text-[11px] ${isOverdue(c) ? "text-amber-300" : "text-slate-500"}`}>{relative(c.nextFollowUp)}</p>
            </div>
          </button>
        ))}
        {filtered.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No clients match.</p>}
      </div>

      {active && <ClientDrawer client={active} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Th({ label, k, sort, onSort }: { label: string; k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void }) {
  const on = sort.key === k;
  return (
    <th className="px-4 py-2.5 font-medium">
      <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 transition-colors hover:text-slate-300 ${on ? "text-slate-300" : ""}`}>
        {label}
        <span className={`text-[9px] ${on ? "opacity-100" : "opacity-30"}`}>{on && sort.dir === 1 ? "▲" : "▼"}</span>
      </button>
    </th>
  );
}
