"use client";

import { useMemo, useState } from "react";
import { describeRule, ruleFor, settle } from "@/lib/chairbook/deals";
import { eur, fmtTime } from "@/lib/chairbook/format";
import { useChairbook } from "@/lib/chairbook/store";
import type { PayMethod } from "@/lib/chairbook/types";
import { Badge, Button, Field, Input, Segmented, Select, cx } from "./ui";

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

type ClientMode = "walkin" | "existing" | "new";

export function SaleForm({ prefill = {}, onDone }: { prefill?: SalePrefill; onDone: () => void }) {
  const { db, role, me, addSale, addClient } = useChairbook();

  const [barberId, setBarberId] = useState(prefill.barberId ?? me?.id ?? db.barbers[0]?.id ?? "");
  const barber = db.barbers.find((b) => b.id === barberId);
  const shopId = barber?.shopId ?? prefill.shopId ?? db.shops[0]?.id ?? "";
  const shop = db.shops.find((s) => s.id === shopId);

  const [clientMode, setClientMode] = useState<ClientMode>(prefill.clientId ? "existing" : "walkin");
  const [clientId, setClientId] = useState<string>(prefill.clientId ?? "");
  const [clientQuery, setClientQuery] = useState("");
  const [newName, setNewName] = useState(prefill.clientName ?? "");
  const [newPhone, setNewPhone] = useState("");
  const [newOwner, setNewOwner] = useState<string>(barberId); // who the new client belongs to

  const [serviceId, setServiceId] = useState(prefill.serviceId ?? db.services[0]?.id ?? "");
  const [amount, setAmount] = useState<string>(
    String(prefill.amount ?? db.services.find((s) => s.id === (prefill.serviceId ?? db.services[0]?.id))?.price ?? ""),
  );
  const [method, setMethod] = useState<PayMethod>(prefill.method ?? "cash");
  const [cardEventId, setCardEventId] = useState<string | undefined>(prefill.cardEventId);

  const amountNum = Number(amount) || 0;

  const client = clientId ? db.clients.find((c) => c.id === clientId) : null;
  const clientType: "own" | "walkin" =
    clientMode === "new"
      ? newOwner === barberId
        ? "own"
        : "walkin"
      : client && client.ownerBarberId === barberId
        ? "own"
        : "walkin";
  const rule = barber ? ruleFor(barber.deal, clientType) : null;
  const split = rule ? settle(amountNum, rule) : { shop: 0, barber: 0 };

  const clientOptions = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    return db.clients
      .filter((c) => c.ownerBarberId === barberId || (c.shopId === shopId && (role === "owner" || c.ownerBarberId === null)))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q))
      .sort((a, b) => {
        // Barber's own clients first.
        const ao = a.ownerBarberId === barberId ? 0 : 1;
        const bo = b.ownerBarberId === barberId ? 0 : 1;
        return ao - bo || a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [db.clients, clientQuery, shopId, barberId, role]);

  const unmatched = db.cardEvents
    .filter((e) => e.status === "unmatched" && e.shopId === shopId)
    .sort((a, b) => b.at.localeCompare(a.at));

  const canSubmit =
    !!barber &&
    amountNum > 0 &&
    (clientMode !== "existing" || !!clientId) &&
    (clientMode !== "new" || newName.trim().length > 1);

  const submit = () => {
    if (!barber || !canSubmit) return;
    let finalClientId: string | null = null;
    if (clientMode === "existing") finalClientId = clientId;
    if (clientMode === "new") {
      finalClientId = addClient({
        name: newName.trim(),
        phone: newPhone.trim(),
        shopId,
        ownerBarberId: newOwner || null,
      });
    }
    addSale({
      shopId,
      barberId,
      clientId: finalClientId,
      serviceId,
      amount: amountNum,
      method,
      source: prefill.source ?? (prefill.appointmentId ? "booked" : "walk-in"),
      cardEventId: method === "card" ? cardEventId : undefined,
      appointmentId: prefill.appointmentId,
    });
    onDone();
  };

  return (
    <div className="space-y-4">
      {role === "owner" && (
        <Field label="Barber">
          <Select value={barberId} onChange={(e) => setBarberId(e.target.value)}>
            {db.barbers
              .filter((b) => b.active)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {db.shops.find((s) => s.id === b.shopId)?.name}
                </option>
              ))}
          </Select>
        </Field>
      )}

      <div>
        <span className="mb-1 block text-xs font-medium text-ink-2">Client</span>
        <Segmented
          className="w-full"
          value={clientMode}
          onChange={(v) => {
            setClientMode(v);
            if (v !== "existing") setClientId("");
          }}
          options={[
            { value: "walkin", label: "Walk-in" },
            { value: "existing", label: "Client list" },
            { value: "new", label: "New client" },
          ]}
        />
        {clientMode === "walkin" && (
          <p className="mt-2 text-xs text-ink-3">
            Unknown person off the street. Counts under the walk-in deal.
          </p>
        )}
        {clientMode === "existing" && (
          <div className="mt-2 space-y-2">
            <Input
              placeholder="Search name or phone"
              value={clientQuery}
              onChange={(e) => setClientQuery(e.target.value)}
            />
            <div className="max-h-44 overflow-y-auto rounded-xl border border-line">
              {clientOptions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClientId(c.id)}
                  className={cx(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2",
                    clientId === c.id && "bg-ink text-canvas hover:bg-ink",
                  )}
                >
                  <span>
                    {c.name}
                    <span className={cx("ml-2 text-xs", clientId === c.id ? "text-canvas/70" : "text-ink-3")}>
                      {c.phone}
                    </span>
                  </span>
                  <span className={cx("text-xs", clientId === c.id ? "text-canvas/70" : "text-ink-3")}>
                    {c.ownerBarberId === barberId
                      ? "own client"
                      : c.ownerBarberId
                        ? `${db.barbers.find((b) => b.id === c.ownerBarberId)?.name}'s`
                        : "shop client"}
                  </span>
                </button>
              ))}
              {clientOptions.length === 0 && (
                <div className="px-3 py-3 text-xs text-ink-3">No match — add as new client.</div>
              )}
            </div>
          </div>
        )}
        {clientMode === "new" && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Input placeholder="Full name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            <div className="sm:col-span-2">
              <Select value={newOwner} onChange={(e) => setNewOwner(e.target.value)}>
                <option value={barberId}>{barber?.name}&apos;s client (own deal)</option>
                <option value="">Shop client (walk-in deal)</option>
              </Select>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Service">
          <Select
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              const s = db.services.find((x) => x.id === e.target.value);
              if (s) setAmount(String(s.price));
            }}
          >
            {db.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {eur(s.price)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Charged (€)">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-ink-2">Paid by</span>
        <div className="grid grid-cols-2 gap-2">
          {(["cash", "card"] as PayMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={cx(
                "h-12 rounded-xl border text-sm font-medium",
                method === m
                  ? "border-ink bg-ink text-canvas"
                  : "border-line-2 bg-surface text-ink-2",
              )}
            >
              {m === "cash" ? "💶 Cash" : "💳 Card (JCC)"}
            </button>
          ))}
        </div>
        {method === "card" && (
          <div className="mt-2 rounded-xl border border-line bg-canvas p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-ink-2">
              <span>Match to terminal {shop?.terminalId}</span>
              <Badge tone={unmatched.length ? "warn" : "neutral"}>
                {unmatched.length} unmatched
              </Badge>
            </div>
            <div className="space-y-1">
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
                    cardEventId === e.id
                      ? "border-ink bg-surface"
                      : "border-line bg-surface hover:border-ink-3",
                  )}
                >
                  <span className="tabular-nums">
                    {fmtTime(e.at)} · •••• {e.last4}
                  </span>
                  <span className="font-semibold tabular-nums">{eur(e.amount)}</span>
                </button>
              ))}
              {unmatched.length === 0 && (
                <p className="text-xs text-ink-3">No pending terminal payments. Recorded as a manual card entry.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {barber && rule && (
        <div className="rounded-xl bg-ink p-4 text-canvas">
          <div className="flex items-center justify-between text-xs text-canvas/70">
            <span>
              {clientType === "own" ? `${barber.name}'s client` : "Walk-in deal"} · {describeRule(rule)}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-3">Charged</div>
              <div className="text-lg font-semibold tabular-nums">{eur(amountNum)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-3">Shop</div>
              <div className="text-lg font-semibold tabular-nums text-good">{eur(split.shop)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-3">{barber.name}</div>
              <div className="text-lg font-semibold tabular-nums text-info">{eur(split.barber)}</div>
            </div>
          </div>
        </div>
      )}

      <Button size="lg" className="w-full" disabled={!canSubmit} onClick={submit}>
        Record {method === "cash" ? "cash" : "card"} payment · {eur(amountNum)}
      </Button>
    </div>
  );
}
