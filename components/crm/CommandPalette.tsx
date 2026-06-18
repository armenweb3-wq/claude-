"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClients } from "@/lib/crm/store";
import { usd } from "@/lib/crm/format";
import type { Client } from "@/lib/crm/types";
import { Avatar, CountryTag, Icon, StatusBadge } from "./ui";
import ClientDrawer from "./ClientDrawer";

const PAGES = [
  { label: "Dashboard", href: "/crm", icon: Icon.dashboard },
  { label: "Call Station", href: "/crm/call", icon: Icon.phone },
  { label: "Clients", href: "/crm/clients", icon: Icon.users },
  { label: "Pipeline", href: "/crm/pipeline", icon: Icon.board },
  { label: "Day Summary", href: "/crm/summary", icon: Icon.report },
];

export default function CommandPalette() {
  const clients = useClients();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [focused, setFocused] = useState<Client | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const openEvt = () => setOpen(true);
    window.addEventListener("keydown", h);
    window.addEventListener("crm:command", openEvt);
    return () => { window.removeEventListener("keydown", h); window.removeEventListener("crm:command", openEvt); };
  }, []);

  useEffect(() => {
    if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 20); }
  }, [open]);

  const pages = useMemo(() => {
    const s = q.trim().toLowerCase();
    return PAGES.filter((p) => !s || p.label.toLowerCase().includes(s));
  }, [q]);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return clients.slice(0, 6);
    return clients
      .filter((c) => c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s) || c.country.name.toLowerCase().includes(s) || c.phone.includes(s))
      .slice(0, 7);
  }, [clients, q]);

  const flat = useMemo(
    () => [
      ...pages.map((p) => ({ type: "page" as const, p })),
      ...matches.map((c) => ({ type: "client" as const, c })),
    ],
    [pages, matches],
  );

  useEffect(() => { if (sel >= flat.length) setSel(0); }, [flat.length, sel]);

  const choose = (i: number) => {
    const item = flat[i];
    if (!item) return;
    if (item.type === "page") { setOpen(false); router.push(item.p.href); }
    else { setOpen(false); setFocused(item.c); }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(flat.length - 1, s + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    if (e.key === "Enter") { e.preventDefault(); choose(sel); }
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/70 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-white/5 px-4">
              <Icon.search className="h-4 w-4 text-slate-500" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setSel(0); }}
                onKeyDown={onKey}
                placeholder="Search clients or jump to a page…"
                className="w-full bg-transparent py-3.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              />
              <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">esc</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto py-2">
              {pages.length > 0 && <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Go to</p>}
              {pages.map((p, i) => (
                <Row key={p.href} active={sel === i} onMouseEnter={() => setSel(i)} onClick={() => choose(i)}>
                  <p.icon className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-200">{p.label}</span>
                </Row>
              ))}
              {matches.length > 0 && <p className="px-4 py-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Clients</p>}
              {matches.map((c, j) => {
                const i = pages.length + j;
                return (
                  <Row key={c.id} active={sel === i} onMouseEnter={() => setSel(i)} onClick={() => choose(i)}>
                    <Avatar name={c.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm text-slate-100">{c.name}</span>
                        <CountryTag code={c.country.code} name={c.country.name} />
                      </div>
                      <p className="truncate text-[11px] text-slate-500">{c.email}</p>
                    </div>
                    <StatusBadge status={c.status} />
                    {c.equity > 0 && <span className="text-xs tabular-nums text-slate-400">{usd(c.equity, { compact: true })}</span>}
                  </Row>
                );
              })}
              {flat.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No matches.</p>}
            </div>
          </div>
        </div>
      )}
      {focused && <ClientDrawer client={clients.find((c) => c.id === focused.id) ?? focused} onClose={() => setFocused(null)} />}
    </>
  );
}

function Row({ active, children, onClick, onMouseEnter }: { active: boolean; children: React.ReactNode; onClick: () => void; onMouseEnter: () => void }) {
  return (
    <button onClick={onClick} onMouseEnter={onMouseEnter} className={`flex w-full items-center gap-3 px-4 py-2 text-left ${active ? "bg-white/[0.06]" : ""}`}>
      {children}
    </button>
  );
}
