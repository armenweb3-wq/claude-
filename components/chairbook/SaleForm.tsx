"use client";

import { useMemo, useState } from "react";
import { describeRule, ruleFor, settle } from "@/lib/chairbook/deals";
import { eur, fmtTime } from "@/lib/chairbook/format";
import { useChairbook } from "@/lib/chairbook/store";
import type { ClientType, PayMethod } from "@/lib/chairbook/types";
import { Badge, Button, Input, Select, cx } from "./ui";

export interface SalePrefill {
  shopId?: string;
  barberId?: string;
  clientId?: string | null;
  clientName?: string;
  serviceId?: string;
  amount?: number;
  method?: PayMethod;
  cardEventId?: string;
  appointmentId?: string;
  source?: "booked" | "walk-in";
}

type Who = "own" | "walkin" | "shop";
const QUICK_AMOUNTS = [15, 17, 18, 20, 25, 30, 40, 50];
const QUICK_TIPS = [0, 1, 2, 5];

/**
 * The "Done" flow. Built for a barber on a phone between two clients:
 * who was it → how much → tip → cash or card → Done. Everything else is
 * optional. The split is shown live and saved on the ledger row.
 */
export function SaleForm({ prefill = {}, onDone }: { prefill?: SalePrefill; onDone: () => void }) {
  const { db, role, me, addSale, addClient } = useChairbook();

  const [barberId, setBarberId] = useState(prefill.barberId ?? me?.id ?? db.barbers[0]?.id ?? "");
  const barber = db.barbers.find((b) => b.id === barberId);
  const shopId = barber?.shopId ?? prefill.shopId ?? db.shops[0]?.id ?? "";
  const shop = db.shops.find((s) => s.id === shopId);

  const prefClient = prefill.clientId ? db.clients.find((c) => c.id === prefill.clientId) : null;
  const [who, setWho] = useState<Who>(
    prefClient ? (prefClient.ownerBarberId === barberId ? "own" : "shop") : prefill.clientName ? "walkin" : "walkin",
  );
  const [clientId, setClientId] = useState<string>(prefill.clientId ?? "");
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState(prefill.clientName ?? "");
  const [showPicker, setShowPicker] = useState(false);

  const [serviceId, setServiceId] = useState(prefill.serviceId ?? "cut");
  const [amount, setAmount] = useState<string>(
    String(prefill.amount ?? db.services.find((s) => s.id === (prefill.serviceId ?? "cut"))?.price ?? 20),
  );
  const [tip, setTip] = useState<string>("0");
  const [method, setMethod] = useState<PayMethod>(prefill.method ?? "cash");
  const [cardEventId, setCardEventId] = useState<string | undefined>(prefill.cardEventId);
  const [showTerminal, setShowTerminal] = useState(!!prefill.cardEventId);

  const amountNum = Number(amount) || 0;
  const tipNum = Number(tip) || 0;
  const client = clientId ? db.clients.find((c) => c.id === clientId) : null;
  const clientType: ClientType = who === "own" ? "own" : "walkin";
  const rule = barber ? ruleFor(barber.deal, clientType) : null;
  const split = rule ? settle(amountNum, rule) : { shop: 0, barber: 0 };

  const pool = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.clients
      .filter((c) => (who === "own" ? c.ownerBarberId === barberId : c.shopId === shopId && c.ownerBarberId === null))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [db.clients, query, who, barberId, shopId]);

  const unmatched = db.cardEvents
    .filter((e) => e.status === "unmatched" && e.shopId === shopId)
    .sort((a, b) => b.at.localeCompare(a.at));

  const pickWho = (w: Who) => {
    setWho(w);
    setClientId("");
    setQuery("");
    setShowPicker(w !== "walkin");
  };

  const submit = () => {
    if (!barber || amountNum <= 0) return;
    let finalClientId: string | null = clientId || null;
    if (!finalClientId && newName.trim().length > 1 && who !== "walkin") {
      finalClientId = addClient({
        name: newName.trim(),
        phone: "",
        shopId,
        ownerBarberId: who === "own" ? barberId : null,
      });
    }
    addSale({
      shopId,
      barberId,
      clientId: finalClientId,
      clientType,
      serviceId,
      amount: amountNum,
      tip: tipNum,
      method,
      source: prefill.source ?? (prefill.appointmentId ? "booked" : "walk-in"),
      cardEventId: method === "card" ? cardEventId : undefined,
      appointmentId: prefill.appointmentId,
    });
    onDone();
  };

  const whoLabel = client ? client.name : newName.trim() || (who === "own" ? "My client (no name)" : who === "shop" ? "Shop client (no name)" : "Walk-in");

  return (
    <div className="space-y-4">
      {role === "owner" && (
        <Select value={barberId} onChange={(e) => setBarberId(e.target.value)} aria-label="Barber">
          {db.barbers
            .filter((b) => b.active)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {db.shops.find((s) => s.id === b.shopId)?.name}
              </option>
            ))}
        </Select>
      )}

      {/* WHO */}
      <section>
        <Label>Who was it?</Label>
        <div className="grid grid-cols-3 gap-2">
          <Choice active={who === "own"} onClick={() => pickWho("own")} title="My client" sub={rule && barber ? describeRule(barber.deal.ownClients) : ""} />
          <Choice active={who === "walkin"} onClick={() => pickWho("walkin")} title="Walk-in" sub="unknown person" />
          <Choice active={who === "shop"} onClick={() => pickWho("shop")} title="Shop client" sub={barber ? describeRule(barber.deal.walkIns) : ""} />
        </div>
        {who !== "walkin" && (
          <div className="mt-2">
            {client ? (
              <div className="flex items-center justify-between rounded-xl bg-ink px-3 py-2 text-sm text-canvas">
                <span>{client.name}</span>
                <button
                  className="text-xs text-canvas/70 underline"
                  onClick={() => {
                    setClientId("");
                    setShowPicker(true);
                  }}
                >
                  change
                </button>
              </div>
            ) : showPicker ? (
              <div className="space-y-2">
                <Input
                  autoFocus
                  placeholder={who === "own" ? "Name (optional) — search or type a new one" : "Search shop clients, or type a name"}
                  value={query || newName}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setNewName(e.target.value);
                  }}
                />
                {pool.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-line">
                    {pool.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setClientId(c.id);
                          setNewName("");
                          setQuery("");
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2"
                      >
                        {c.name}
                        <span className="text-xs text-ink-3">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {newName.trim().length > 1 && !pool.some((c) => c.name.toLowerCase() === newName.trim().toLowerCase()) && (
                  <p className="text-xs text-ink-3">
                    &quot;{newName.trim()}&quot; will be added as {who === "own" ? "your" : "a shop"} client.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* WHAT */}
      <section>
        <Label>Service</Label>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {db.services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setServiceId(s.id);
                setAmount(String(s.price));
              }}
              className={cx(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                serviceId === s.id ? "border-ink bg-ink text-canvas" : "border-line-2 bg-surface text-ink-2",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      </section>

      {/* HOW MUCH */}
      <section className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <Label>Charged (€)</Label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-14 text-2xl font-semibold tabular-nums"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {QUICK_AMOUNTS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                className={cx(
                  "rounded-md border px-2 py-1 text-xs tabular-nums",
                  amountNum === v ? "border-ink bg-ink text-canvas" : "border-line-2 text-ink-2",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="w-28">
          <Label>Tip (€)</Label>
          <Input type="number" inputMode="decimal" min={0} value={tip} onChange={(e) => setTip(e.target.value)} className="h-14 text-2xl font-semibold tabular-nums" />
          <div className="mt-1.5 flex gap-1">
            {QUICK_TIPS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTip(String(v))}
                className={cx("flex-1 rounded-md border px-1 py-1 text-xs tabular-nums", tipNum === v ? "border-ink bg-ink text-canvas" : "border-line-2 text-ink-2")}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* HOW PAID */}
      <section>
        <Label>Paid by</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["cash", "card"] as PayMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMethod(m);
                if (m === "card" && unmatched.length) setShowTerminal(true);
              }}
              className={cx(
                "h-14 rounded-xl border text-base font-semibold",
                method === m ? "border-ink bg-ink text-canvas" : "border-line-2 bg-surface text-ink-2",
              )}
            >
              {m === "cash" ? "Cash" : "Card"}
            </button>
          ))}
        </div>
        {method === "card" && (
          <div className="mt-2">
            <button type="button" className="text-xs text-ink-3 underline" onClick={() => setShowTerminal((v) => !v)}>
              {showTerminal ? "Hide" : "Match to"} terminal {shop?.terminalId}
              {unmatched.length > 0 && (
                <Badge tone="warn">
                  {unmatched.length} unmatched
                </Badge>
              )}
            </button>
            {showTerminal && (
              <div className="mt-1 space-y-1">
                {unmatched.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      setCardEventId(cardEventId === e.id ? undefined : e.id);
                      setAmount(String(e.amount));
                    }}
                    className={cx(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm",
                      cardEventId === e.id ? "border-ink bg-surface" : "border-line bg-surface hover:border-ink-3",
                    )}
                  >
                    <span className="tabular-nums">
                      {fmtTime(e.at)} · •••• {e.last4}
                    </span>
                    <span className="font-semibold tabular-nums">{eur(e.amount)}</span>
                  </button>
                ))}
                {unmatched.length === 0 && <p className="text-xs text-ink-3">No pending terminal payments — saved as a manual card entry.</p>}
              </div>
            )}
          </div>
        )}
      </section>

      {/* SUMMARY + DONE */}
      {barber && rule && (
        <div className="rounded-xl border border-line bg-surface-2 p-3 text-sm">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span>{whoLabel}</span>
            <span>{describeRule(rule)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-ink-2">
              {role === "barber" ? "You keep" : `${barber.name} keeps`}{" "}
              <strong className="tabular-nums text-info">{eur(split.barber + tipNum)}</strong>
              {tipNum > 0 && <span className="text-xs text-ink-3"> (incl. €{tipNum} tip)</span>}
            </span>
            <span className="text-ink-2">
              Shop <strong className="tabular-nums text-good">{eur(split.shop)}</strong>
            </span>
          </div>
        </div>
      )}
      <Button size="lg" className="h-14 w-full text-base" disabled={!barber || amountNum <= 0} onClick={submit}>
        Done · {eur(amountNum + tipNum)} {method}
      </Button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{children}</span>;
}

function Choice({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-xl border px-2 py-2.5 text-left",
        active ? "border-ink bg-ink text-canvas" : "border-line-2 bg-surface text-ink",
      )}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className={cx("mt-0.5 truncate text-[10px]", active ? "text-canvas/70" : "text-ink-3")}>{sub}</div>
    </button>
  );
}
