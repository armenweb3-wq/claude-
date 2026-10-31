"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { useChairbook } from "@/lib/chairbook/store";
import type { Role } from "@/lib/chairbook/types";
import { cx } from "./ui";

interface ShopFilter {
  shopId: string | null;
  setShopId: (id: string | null) => void;
}
const ShopCtx = createContext<ShopFilter>({ shopId: null, setShopId: () => {} });
export const useShopFilter = () => useContext(ShopCtx);

const NAV: Record<Role, { href: string; label: string; icon: keyof typeof ICONS }[]> = {
  owner: [
    { href: "/chairbook/dashboard", label: "Home", icon: "home" },
    { href: "/chairbook/calendar", label: "Calendar", icon: "calendar" },
    { href: "/chairbook/till", label: "Till", icon: "till" },
    { href: "/chairbook/clients", label: "Clients", icon: "people" },
    { href: "/chairbook/team", label: "Team", icon: "team" },
    { href: "/chairbook/insights", label: "Insights", icon: "chart" },
  ],
  barber: [
    { href: "/chairbook/calendar", label: "Today", icon: "calendar" },
    { href: "/chairbook/till", label: "Till", icon: "till" },
    { href: "/chairbook/clients", label: "Clients", icon: "people" },
    { href: "/chairbook/earnings", label: "Earnings", icon: "chart" },
  ],
  client: [
    { href: "/chairbook/book", label: "Book", icon: "calendar" },
    { href: "/chairbook/visits", label: "My visits", icon: "people" },
  ],
};

const ICONS = {
  home: <path d="M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-6H9v6H5a2 2 0 01-2-2z" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  till: (
    <>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 11h20M6 15h3" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0113 0M16 4a3.5 3.5 0 010 7M21.5 20a6.5 6.5 0 00-4.5-6.2" />
    </>
  ),
  team: (
    <>
      <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6L7.1 18.2l.9-5.5-4-3.9L9.5 8z" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
};

export function Icon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, user, role, db, logout, me } = useChairbook();
  const router = useRouter();
  const pathname = usePathname();
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/chairbook");
  }, [ready, user, router]);

  // Barbers only ever see their own shop.
  useEffect(() => {
    if (me) setShopId(me.shopId);
  }, [me]);

  if (!ready || !user || !role) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Loading…</div>
    );
  }

  const nav = NAV[role];
  const home = nav[0].href;

  return (
    <ShopCtx.Provider value={{ shopId, setShopId }}>
      <div className="min-h-screen bg-slate-50 pb-20 sm:pb-0">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
            <Link href={home} className="flex items-center gap-2 font-semibold tracking-tight text-slate-900">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                C
              </span>
              Chairbook
            </Link>
            <nav className="ml-6 hidden items-center gap-1 sm:flex">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cx(
                    "rounded-lg px-3 py-1.5 text-sm font-medium",
                    pathname.startsWith(n.href)
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-500 hover:text-slate-900",
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              {role === "owner" && (
                <select
                  value={shopId ?? ""}
                  onChange={(e) => setShopId(e.target.value || null)}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
                  aria-label="Shop"
                >
                  <option value="">All shops</option>
                  {db.shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
              {role === "barber" && me && (
                <span className="hidden rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600 sm:inline">
                  {db.shops.find((s) => s.id === me.shopId)?.name}
                </span>
              )}
              <span className="hidden text-sm text-slate-600 sm:inline">{user.name}</span>
              <button
                onClick={() => {
                  logout();
                  router.replace("/chairbook");
                }}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                Log out
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-5 sm:py-8">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden">
          <div className="flex">
            {nav.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cx(
                    "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                    active ? "text-slate-900" : "text-slate-400",
                  )}
                >
                  <Icon name={n.icon} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </ShopCtx.Provider>
  );
}
