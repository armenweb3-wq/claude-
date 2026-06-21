"use client";

import { useMemo, useState } from "react";
import { useClients } from "@/lib/crm/store";
import { useSession } from "@/lib/crm/session";
import { byStage } from "@/lib/crm/selectors";
import { usd } from "@/lib/crm/format";
import { PIPELINE_STAGES } from "@/lib/crm/types";
import { Avatar, CountryTag, StatusBadge, TierBadge } from "./ui";
import ClientDrawer from "./ClientDrawer";

export default function Pipeline() {
  const clients = useClients();
  const agent = useSession();
  const [mineOnly, setMineOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const stages = useMemo(
    () => byStage(clients, mineOnly ? agent?.id : undefined),
    [clients, mineOnly, agent?.id],
  );
  const active = selected ? clients.find((c) => c.id === selected) ?? null : null;

  if (clients.length === 0) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">Loading pipeline…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Pipeline</h1>
          <p className="mt-1 text-sm text-slate-500">Lead lifecycle across the desk</p>
        </div>
        <div className="flex rounded-lg border border-white/10 p-0.5 text-xs">
          <button onClick={() => setMineOnly(false)} className={`rounded-md px-3 py-1.5 font-medium transition-colors ${!mineOnly ? "bg-white/10 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}>Whole desk</button>
          <button onClick={() => setMineOnly(true)} className={`rounded-md px-3 py-1.5 font-medium transition-colors ${mineOnly ? "bg-white/10 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}>My book</button>
        </div>
      </div>

      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        {PIPELINE_STAGES.map((s) => {
          const col = stages[s.key];
          const value = col.reduce((sum, c) => sum + c.equity, 0);
          return (
            <div key={s.key} className="flex w-72 shrink-0 flex-col rounded-xl border border-white/[0.06] bg-slate-900/20 sm:w-auto sm:flex-1">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-200">{s.label}</h2>
                  <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-400">{col.length}</span>
                </div>
                {value > 0 && <span className="text-[11px] tabular-nums text-emerald-300">{usd(value, { compact: true })}</span>}
              </div>
              <div className="flex-1 space-y-2 p-2.5">
                {col.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    className="w-full rounded-lg border border-white/[0.06] bg-slate-900/40 p-3 text-left transition-colors hover:border-white/15 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar name={c.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-slate-100">{c.name}</p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <CountryTag code={c.country.code} name={c.country.name} />
                          <TierBadge tier={c.tier} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <StatusBadge status={c.status} />
                      {c.equity > 0 && <span className="text-xs font-medium tabular-nums text-slate-300">{usd(c.equity)}</span>}
                    </div>
                  </button>
                ))}
                {col.length === 0 && <p className="px-2 py-6 text-center text-xs text-slate-600">Empty</p>}
              </div>
            </div>
          );
        })}
      </div>

      {active && <ClientDrawer client={active} onClose={() => setSelected(null)} />}
    </div>
  );
}
