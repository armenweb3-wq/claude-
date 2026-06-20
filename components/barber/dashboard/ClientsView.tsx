"use client";

import { useMemo, useState } from "react";
import { currency } from "@/data/barber";
import type { ClientRow, Dashboard, Segment } from "@/data/barber-analytics";
import { SegmentBadge } from "./parts";

const FILTERS: { key: Segment | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "vip", label: "VIP" },
  { key: "high-potential", label: "High potential" },
  { key: "regular", label: "Regular" },
  { key: "at-risk", label: "At risk" },
  { key: "lost", label: "Lost" },
];

type SortKey = "value" | "visits" | "recency" | "potential";

export default function ClientsView({ d }: { d: Dashboard }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Segment | "all">("all");
  const [sort, setSort] = useState<SortKey>("value");

  const rows = useMemo(() => {
    let list = d.allClients;
    if (filter !== "all") list = list.filter((c) => c.segment === filter);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((c) => c.name.toLowerCase().includes(needle));
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "visits":
          return b.visits - a.visits;
        case "recency":
          return a.daysSinceLast - b.daysSinceLast;
        case "potential":
          return b.potential - a.potential;
        default:
          return b.lifetimeValue - a.lifetimeValue;
      }
    });
    return sorted;
  }, [d.allClients, filter, q, sort]);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clients…"
          className="w-full rounded-full border border-coal-line bg-coal-soft px-5 py-2.5 text-sm text-bone placeholder:text-bone/35 focus:border-brass focus:outline-none lg:max-w-xs"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-full border border-coal-line bg-coal-soft px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-bone/70 focus:border-brass focus:outline-none"
        >
          <option value="value">Sort: Lifetime value</option>
          <option value="visits">Sort: Visits</option>
          <option value="recency">Sort: Most recent</option>
          <option value="potential">Sort: Potential</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
              filter === f.key
                ? "border-brass bg-brass/10 text-brass"
                : "border-coal-line text-bone/55 hover:text-bone"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-bone/40">{rows.length} clients</p>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-coal-line bg-coal-soft">
        <div className="hidden grid-cols-12 gap-3 border-b border-coal-line px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-bone/40 sm:grid">
          <span className="col-span-4">Client</span>
          <span className="col-span-2">Segment</span>
          <span className="col-span-1 text-right">Visits</span>
          <span className="col-span-2 text-right">Lifetime</span>
          <span className="col-span-1 text-right">Last</span>
          <span className="col-span-2 text-right">Potential</span>
        </div>
        <ul className="divide-y divide-coal-line">
          {rows.map((c) => (
            <ClientLine key={c.id} c={c} />
          ))}
          {rows.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-bone/40">No clients match.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function ClientLine({ c }: { c: ClientRow }) {
  return (
    <li className="grid grid-cols-2 items-center gap-3 px-5 py-3.5 sm:grid-cols-12">
      <div className="col-span-2 flex items-center gap-3 sm:col-span-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coal-deep font-display text-xs font-bold text-bone/70">
          {c.name.split(" ").map((n) => n[0]).join("")}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-bone">{c.name}</p>
          <p className="truncate text-xs text-bone/40">every ~{c.avgIntervalDays}d</p>
        </div>
      </div>
      <div className="sm:col-span-2">
        <SegmentBadge segment={c.segment} />
      </div>
      <span className="hidden text-right text-sm text-bone/70 sm:col-span-1 sm:block">
        {c.visits}
      </span>
      <span className="text-right font-display text-base text-bone sm:col-span-2">
        {currency}
        {c.lifetimeValue.toLocaleString()}
      </span>
      <span className="hidden text-right text-sm text-bone/55 sm:col-span-1 sm:block">
        {c.daysSinceLast}d
      </span>
      <span
        className={`col-span-2 text-right font-display text-base font-bold sm:col-span-2 ${
          c.potential >= 60 ? "text-green-400" : c.potential >= 35 ? "text-bone" : "text-bone/40"
        }`}
      >
        {c.potential}
      </span>
    </li>
  );
}
