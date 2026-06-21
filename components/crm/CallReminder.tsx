"use client";

// Surfaces, once per session, who to call next — driven by each client's note
// and follow-up time. This is the "open the CRM and it tells me who's next" flow.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClients } from "@/lib/crm/store";
import { useSession } from "@/lib/crm/session";
import { dueNow, nextUp } from "@/lib/crm/selectors";
import { clock, greeting } from "@/lib/crm/format";
import { Avatar, CountryTag, Icon, StatusBadge, TierBadge } from "./ui";

const SESSION_KEY = "vantage-crm:reminder-shown";

export default function CallReminder() {
  const clients = useClients();
  const agent = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (clients.length === 0 || !agent) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    setOpen(true);
  }, [clients.length, agent]);

  if (!open || !agent) return null;
  const next = nextUp(clients, agent.id);
  if (!next) return null;
  const count = dueNow(clients, agent.id).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="animate-fade-up w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="border-b border-white/5 bg-gradient-to-br from-emerald-500/[0.12] to-transparent px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            {greeting()}, {agent.name.split(" ")[0]}
          </p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-100">
            {count} {count === 1 ? "call" : "calls"} ready to work
          </h2>
          <p className="mt-1 text-sm text-slate-400">First in your queue:</p>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-start gap-3">
            <Avatar name={next.name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-slate-100">{next.name}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <CountryTag code={next.country.code} name={next.country.name} />
                <span className="truncate font-mono text-xs text-slate-400">{next.phone}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={next.status} />
                <TierBadge tier={next.tier} />
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Icon.clock className="h-3 w-3" /> {clock(next.nextFollowUp)}
                </span>
              </div>
            </div>
          </div>

          {next.note && (
            <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Your note</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{next.note}</p>
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <button onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5">
              Later
            </button>
            <button
              onClick={() => { setOpen(false); router.push("/crm/call"); }}
              className="flex flex-[2] items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              Start calling <Icon.arrow className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
