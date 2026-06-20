"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { shop } from "@/data/barber";
import type { Dashboard } from "@/data/barber-analytics";
import OverviewView from "./OverviewView";
import BookingsView from "./BookingsView";
import ClientsView from "./ClientsView";

// Demo passcode — replace with real auth before going live.
const DEMO_CODE = "hustle";
const TABS = [
  { key: "overview", label: "Overview", icon: GridIcon },
  { key: "bookings", label: "Bookings", icon: CalendarIcon },
  { key: "clients", label: "Clients", icon: UsersIcon },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function AdminShell({ d, asOf }: { d: Dashboard; asOf: string }) {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<TabKey>("overview");

  useEffect(() => {
    try {
      setAuthed(sessionStorage.getItem("hb-admin") === "1");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  function unlock() {
    try {
      sessionStorage.setItem("hb-admin", "1");
    } catch {
      /* ignore */
    }
    setAuthed(true);
  }
  function lock() {
    try {
      sessionStorage.removeItem("hb-admin");
    } catch {
      /* ignore */
    }
    setAuthed(false);
  }

  if (!ready) return null;
  if (!authed) return <Gate onUnlock={unlock} />;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-coal-line bg-coal-soft/40 p-5 lg:flex">
        <Link href="/barber" className="flex items-center gap-2">
          <span className="font-display text-xl font-bold uppercase tracking-widest">
            {shop.name}
          </span>
        </Link>
        <p className="mt-1 text-[11px] uppercase tracking-widest text-bone/40">Owner panel</p>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-brass/10 text-brass"
                  : "text-bone/60 hover:bg-coal-line/40 hover:text-bone"
              }`}
            >
              <t.icon />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-1 border-t border-coal-line pt-4 text-sm">
          <Link
            href="/barber"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-bone/55 transition-colors hover:text-bone"
          >
            ← Back to site
          </Link>
          <button
            onClick={lock}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-bone/55 transition-colors hover:text-bone"
          >
            Lock panel
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0">
        <header className="sticky top-0 z-10 border-b border-coal-line bg-coal-deep/85 px-5 py-4 backdrop-blur lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
                {TABS.find((t) => t.key === tab)?.label}
              </h1>
              <p className="text-xs text-bone/45">
                {d.barberName} · {asOf}
              </p>
            </div>
            <Link
              href="/barber"
              className="rounded-full border border-coal-line px-4 py-2 text-xs font-semibold uppercase tracking-widest text-bone/65 transition-colors hover:border-brass hover:text-brass lg:hidden"
            >
              Site
            </Link>
          </div>

          {/* Mobile tabs */}
          <nav className="mt-4 flex gap-2 lg:hidden">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  tab === t.key ? "bg-brass text-coal-deep" : "border border-coal-line text-bone/55"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="px-5 py-6 lg:px-8 lg:py-8">
          {tab === "overview" && <OverviewView d={d} />}
          {tab === "bookings" && <BookingsView d={d} />}
          {tab === "clients" && <ClientsView d={d} />}
        </main>
      </div>
    </div>
  );
}

function Gate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().toLowerCase() === DEMO_CODE) onUnlock();
    else setErr(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-coal-line bg-coal-soft p-8 text-center"
      >
        <span className="font-display text-2xl font-bold uppercase tracking-widest">
          {shop.name}
        </span>
        <p className="mt-1 text-xs uppercase tracking-widest text-bone/45">Owner panel</p>
        <p className="mt-6 text-sm text-bone/60">Enter your passcode to view the tracker.</p>
        <input
          autoFocus
          type="password"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setErr(false);
          }}
          placeholder="Passcode"
          className={`mt-4 w-full rounded-lg border bg-coal-deep px-4 py-3 text-center text-sm text-bone placeholder:text-bone/30 focus:outline-none ${
            err ? "border-red-500/70" : "border-coal-line focus:border-brass"
          }`}
        />
        {err && <p className="mt-2 text-xs text-red-400">Wrong passcode.</p>}
        <button
          type="submit"
          className="shine mt-4 w-full rounded-full bg-brass py-3 text-sm font-semibold uppercase tracking-widest text-coal-deep transition-colors hover:bg-brass-soft"
        >
          Unlock
        </button>
        <p className="mt-4 text-[11px] text-bone/35">
          Demo code: <span className="text-bone/60">hustle</span> · wire to real auth before launch
        </p>
      </form>
    </div>
  );
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
    </svg>
  );
}
