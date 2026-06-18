"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AGENT_NAME } from "@/lib/crm/types";
import { avatarTone, initials } from "@/lib/crm/format";
import CallReminder from "./CallReminder";

const NAV = [
  { href: "/crm", label: "Dashboard", icon: GridIcon },
  { href: "/crm/call", label: "Call Station", icon: PhoneIcon },
  { href: "/crm/clients", label: "Clients", icon: UsersIcon },
];

export default function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/crm" ? pathname === "/crm" : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/5 bg-slate-900/40 px-4 py-6 lg:flex">
        <Brand />
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-lg bg-white/5 px-3 py-3">
          <div
            className={`grid h-9 w-9 place-items-center rounded-full text-xs font-semibold ${avatarTone(
              AGENT_NAME,
            )}`}
          >
            {initials(AGENT_NAME)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-100">
              {AGENT_NAME}
            </p>
            <p className="truncate text-xs text-slate-500">Sales Desk · Online</p>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — mobile */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-slate-950/80 px-4 py-3 backdrop-blur lg:hidden">
          <Brand compact />
          <div
            className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold ${avatarTone(
              AGENT_NAME,
            )}`}
          >
            {initials(AGENT_NAME)}
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Bottom tab bar — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/10 bg-slate-950/90 backdrop-blur lg:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
              isActive(item.href) ? "text-emerald-300" : "text-slate-500"
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Auto "who to call next" pop-up on first load */}
      <CallReminder />
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/crm" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 font-bold text-slate-950">
        V
      </span>
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-wide text-slate-100">
            Vantage CRM
          </span>
          <span className="text-[11px] text-slate-500">Trading Desk</span>
        </span>
      )}
      {compact && (
        <span className="text-sm font-semibold tracking-wide text-slate-100">
          Vantage CRM
        </span>
      )}
    </Link>
  );
}

// ---- icons (inline, no dependency) ----------------------------------------

function GridIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function PhoneIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 5.5C2.5 4 3.5 3 5 3h1.6c.6 0 1.1.4 1.3 1l1 3c.2.5 0 1.1-.4 1.4l-1.3 1a12 12 0 0 0 5.7 5.7l1-1.3c.3-.4.9-.6 1.4-.4l3 1c.6.2 1 .7 1 1.3V19c0 1.5-1 2.5-2.5 2.5C10.5 21.5 2.5 13.5 2.5 5.5Z"
      />
    </svg>
  );
}

function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path strokeLinecap="round" d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path strokeLinecap="round" d="M16 5.2A3.2 3.2 0 0 1 16 11M17 19a5.5 5.5 0 0 0-2.5-4.6" />
    </svg>
  );
}
