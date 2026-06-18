"use client";

// The "turn on your computer and it tells you who to call" pop-up.
// Appears once per browser session, surfacing the single most urgent client.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClients } from "@/lib/crm/store";
import { dueNow, nextUp } from "@/lib/crm/selectors";
import { clock, greeting } from "@/lib/crm/format";
import { AGENT_NAME } from "@/lib/crm/types";
import { Avatar, StatusBadge } from "./ui";

const SESSION_KEY = "trading-crm:reminder-shown";

export default function CallReminder() {
  const clients = useClients();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (clients.length === 0) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    setOpen(true);
  }, [clients.length]);

  if (!open || clients.length === 0) return null;

  const next = nextUp(clients);
  const dueCount = dueNow(clients).length;
  if (!next) return null;

  const close = () => setOpen(false);
  const start = () => {
    close();
    router.push("/crm/call");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="animate-fade-up w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="border-b border-white/5 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-widest text-emerald-300">
            {greeting()}, {AGENT_NAME.split(" ")[0]}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">
            You have {dueCount} {dueCount === 1 ? "call" : "calls"} ready
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            First up — here&apos;s who to call right now.
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center gap-3">
            <Avatar name={next.name} flag={next.flag} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-100">
                {next.name}
              </p>
              <p className="truncate text-sm text-slate-400">
                {next.country} · {next.phone}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <StatusBadge status={next.status} />
                <span className="text-xs text-slate-500">
                  Due {clock(next.nextFollowUp)}
                </span>
              </div>
            </div>
          </div>

          {next.note && (
            <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Your note
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                {next.note}
              </p>
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <button
              onClick={close}
              className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5"
            >
              Later
            </button>
            <button
              onClick={start}
              className="flex-[2] rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              Start calling →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
