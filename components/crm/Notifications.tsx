"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClients } from "@/lib/crm/store";
import { useSession } from "@/lib/crm/session";
import { dueNow, isOverdue } from "@/lib/crm/selectors";
import { clock } from "@/lib/crm/format";
import { Avatar, Icon } from "./ui";

export default function Notifications() {
  const clients = useClients();
  const agent = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const due = dueNow(clients, agent?.id);
  const overdue = due.filter((c) => isOverdue(c)).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100"
        aria-label="Reminders"
      >
        <Icon.bell className="h-[18px] w-[18px]" />
        {due.length > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold text-slate-950 ${overdue ? "bg-rose-400" : "bg-emerald-400"}`}>
            {due.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <p className="text-sm font-semibold text-slate-100">Reminders</p>
              <span className="text-xs text-slate-500">{due.length} due</span>
            </div>
            <ul className="max-h-80 divide-y divide-white/5 overflow-y-auto">
              {due.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => { setOpen(false); router.push("/crm/call"); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                  >
                    <Avatar name={c.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-slate-100">{c.name}</p>
                      <p className="truncate text-[11px] text-slate-500">{c.note}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] ${isOverdue(c) ? "text-rose-300" : "text-slate-500"}`}>
                      {clock(c.nextFollowUp)}
                    </span>
                  </button>
                </li>
              ))}
              {due.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-slate-500">Nothing due. You&apos;re clear.</li>
              )}
            </ul>
            <button
              onClick={() => { setOpen(false); router.push("/crm/call"); }}
              className="w-full border-t border-white/5 bg-white/[0.02] px-4 py-2.5 text-center text-xs font-medium text-emerald-300 hover:bg-white/5"
            >
              Open Call Station
            </button>
          </div>
        </>
      )}
    </div>
  );
}
