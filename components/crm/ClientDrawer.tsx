"use client";

import { useState } from "react";
import Link from "next/link";
import { addNote, updateClient } from "@/lib/crm/store";
import { useSession } from "@/lib/crm/session";
import { clock, pct, relative, usd } from "@/lib/crm/format";
import { STATUS_META, type Client } from "@/lib/crm/types";
import { AGENTS } from "@/lib/crm/seed";
import { Avatar, CountryTag, Icon, KycBadge, RiskDot, Sparkline, StatusBadge, TierBadge } from "./ui";

type Tab = "overview" | "trading" | "activity";

export default function ClientDrawer({ client, onClose }: { client: Client; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [draft, setDraft] = useState("");
  const agent = useSession();

  const submitNote = () => {
    if (!draft.trim() || !agent) return;
    addNote(client.id, draft, agent.id);
    setDraft("");
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-white/10 bg-slate-900 shadow-2xl sm:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-white/5 px-5 pb-4 pt-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Avatar name={client.name} size="lg" />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-slate-100">{client.name}</h2>
                <div className="mt-1 flex items-center gap-1.5">
                  <CountryTag code={client.country.code} name={client.country.name} />
                  <span className="font-mono text-xs text-slate-400">{client.phone}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="Close">
              <Icon.x className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={client.status} />
            <TierBadge tier={client.tier} />
            <KycBadge kyc={client.kyc} />
            <RiskDot risk={client.risk} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/5 px-3">
          {(["overview", "trading", "activity"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-3 py-2.5 text-sm font-medium capitalize transition-colors ${tab === t ? "text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
            >
              {t}
              {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-400" />}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "overview" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Working note</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">{client.note}</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Cell label="Lead score" value={`${client.score}/100`} />
                <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Owner</p>
                  <select
                    value={client.ownerId}
                    onChange={(e) => updateClient(client.id, { ownerId: e.target.value })}
                    className="mt-0.5 w-full bg-transparent text-sm text-slate-200 outline-none"
                  >
                    {AGENTS.map((a) => <option key={a.id} value={a.id} className="bg-slate-900">{a.name}</option>)}
                  </select>
                </div>
                <Cell label="Source" value={client.source} />
                <Cell label="Email" value={client.email} mono />
                <Cell label="Next call" value={clock(client.nextFollowUp)} />
                <Cell label="Last contact" value={relative(client.lastContact)} />
                <Cell label="Last login" value={relative(client.lastLogin)} />
                <Cell label="Client since" value={relative(client.createdAt)} />
              </div>
            </div>
          )}

          {tab === "trading" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Account equity</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">{usd(client.equity)}</p>
                    <p className={`text-xs tabular-nums ${client.pnlPct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{pct(client.pnlPct)} open P/L</p>
                  </div>
                  <Sparkline data={client.equityCurve} positive={client.pnlPct >= 0} className="h-12 w-32" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Cell label="Cash balance" value={usd(client.balance)} />
                <Cell label="Lifetime deposits" value={usd(client.deposits)} />
                <Cell label="Withdrawals" value={usd(client.withdrawals)} />
                <Cell label="Net" value={usd(client.deposits - client.withdrawals)} />
              </div>
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Open positions</p>
                {client.positions.length === 0 ? (
                  <p className="text-sm text-slate-500">No open trades.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-white/5">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                        <tr><th className="px-3 py-1.5 font-medium">Symbol</th><th className="px-3 py-1.5 font-medium">Side</th><th className="px-3 py-1.5 font-medium">Size</th><th className="px-3 py-1.5 text-right font-medium">P/L</th></tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {client.positions.map((p) => (
                          <tr key={p.id}>
                            <td className="px-3 py-1.5 font-medium text-slate-200">{p.symbol}</td>
                            <td className={`px-3 py-1.5 font-medium uppercase ${p.side === "buy" ? "text-emerald-300" : "text-rose-300"}`}>{p.side}</td>
                            <td className="px-3 py-1.5 tabular-nums text-slate-400">{p.size}</td>
                            <td className={`px-3 py-1.5 text-right tabular-nums ${p.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{usd(p.pnl, { sign: true })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Deposit history</p>
                <ul className="space-y-1.5">
                  {client.depositHistory.length === 0 && <li className="text-sm text-slate-500">No deposits yet.</li>}
                  {[...client.depositHistory].reverse().map((d, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
                      <span className="text-slate-400">{new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span className="text-slate-500">{d.method}</span>
                      <span className="font-medium tabular-nums text-emerald-300">{usd(d.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {tab === "activity" && (
            <>
            <div className="mb-4 rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder="Add a note — it updates the working note and the hit list…"
                className="w-full resize-none rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500/50"
              />
              <div className="mt-2 flex justify-end">
                <button onClick={submitNote} disabled={!draft.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-50">
                  <Icon.plus className="h-3.5 w-3.5" /> Add note
                </button>
              </div>
            </div>
            <ul className="space-y-3">
              {client.activity.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.outcome ? STATUS_META[a.outcome].dot : "bg-emerald-400"}`} />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">
                      <span className="capitalize text-slate-300">{a.outcome ? STATUS_META[a.outcome].label : a.kind}</span> · {relative(a.at)}
                    </p>
                    <p className="text-sm text-slate-400">{a.body}</p>
                  </div>
                </li>
              ))}
              {client.activity.length === 0 && <li className="text-sm text-slate-500">No activity logged.</li>}
            </ul>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 p-4">
          <Link
            href="/crm/call"
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
          >
            <Icon.phone className="h-4 w-4" /> Go to Call Station
          </Link>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate text-sm text-slate-200 ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}
