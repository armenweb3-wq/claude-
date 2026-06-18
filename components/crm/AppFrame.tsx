"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/crm/session";
import { Avatar, Icon } from "./ui";
import Notifications from "./Notifications";
import CallReminder from "./CallReminder";

const NAV = [
  { href: "/crm", label: "Dashboard", icon: Icon.dashboard },
  { href: "/crm/call", label: "Call Station", icon: Icon.phone },
  { href: "/crm/clients", label: "Clients", icon: Icon.users },
  { href: "/crm/pipeline", label: "Pipeline", icon: Icon.board },
  { href: "/crm/summary", label: "Day Summary", icon: Icon.report },
];

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const agent = useSession();
  const router = useRouter();

  // Client-mount gate: localStorage (session) isn't available during SSR, so we
  // render a loader until the first client commit, then route on the session.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const onLogin = pathname === "/crm/login";

  useEffect(() => {
    if (!mounted) return;
    if (!agent && !onLogin) router.replace("/crm/login");
    if (agent && onLogin) router.replace("/crm");
  }, [mounted, agent, onLogin, router]);

  // Login screen renders bare (its own full-screen layout).
  if (onLogin) return <>{children}</>;

  if (!mounted || !agent) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
          Loading desk…
        </div>
      </div>
    );
  }

  const isActive = (href: string) => (href === "/crm" ? pathname === "/crm" : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/[0.06] bg-slate-900/30 px-3 py-5 lg:flex">
        <Brand />
        <nav className="mt-7 flex flex-col gap-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto">
          <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] px-2.5 py-2.5 ring-1 ring-inset ring-white/[0.06]">
            <Avatar name={agent.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-slate-100">{agent.name}</p>
              <p className="truncate text-[11px] text-slate-500">{agent.desk}</p>
            </div>
            <button onClick={signOut} title="Sign out" className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200">
              <Icon.logout className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-slate-950/70 px-4 py-2.5 backdrop-blur-xl sm:px-6">
          <div className="lg:hidden"><Brand compact /></div>
          <div className="hidden items-center gap-2 text-xs text-slate-500 lg:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Markets open · {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} local
          </div>
          <div className="flex items-center gap-1.5">
            <Notifications />
            <div className="hidden items-center gap-2 rounded-lg px-2 py-1 sm:flex">
              <Avatar name={agent.name} size="sm" />
              <span className="text-[13px] font-medium text-slate-200">{agent.name.split(" ")[0]}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/10 bg-slate-950/90 backdrop-blur-xl lg:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${
              isActive(item.href) ? "text-emerald-300" : "text-slate-500"
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>

      <CallReminder />
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/crm" className="flex items-center gap-2.5 px-1">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-[15px] font-black text-slate-950">V</span>
      <span className="flex flex-col leading-none">
        <span className="text-[13px] font-semibold tracking-tight text-slate-100">VANTAGE</span>
        {!compact && <span className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-500">Trading CRM</span>}
      </span>
    </Link>
  );
}
