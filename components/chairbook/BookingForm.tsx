"use client";

import { useMemo, useState } from "react";
import { addDays, dayKey, fmtDay, fromDayKey, fmtTime } from "@/lib/chairbook/format";
import { appointmentsOn } from "@/lib/chairbook/selectors";
import { useChairbook } from "@/lib/chairbook/store";
import { Button, Field, Input, Select, cx } from "./ui";

export interface BookingPrefill {
  shopId?: string;
  barberId?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  clientId?: string | null;
}

export function BookingForm({ prefill = {}, onDone }: { prefill?: BookingPrefill; onDone: () => void }) {
  const { db, role, me, meClient, addAppointment } = useChairbook();

  const [shopId, setShopId] = useState(prefill.shopId ?? me?.shopId ?? meClient?.shopId ?? db.shops[0]?.id ?? "");
  const shop = db.shops.find((s) => s.id === shopId);
  const barbers = db.barbers.filter((b) => b.active && b.shopId === shopId);
  const [barberId, setBarberId] = useState(prefill.barberId ?? me?.id ?? meClient?.ownerBarberId ?? "");
  const effectiveBarberId = barbers.some((b) => b.id === barberId) ? barberId : barbers[0]?.id ?? "";

  const [serviceId, setServiceId] = useState(db.services[0]?.id ?? "");
  const service = db.services.find((s) => s.id === serviceId);
  const [date, setDate] = useState(prefill.date ?? dayKey(new Date()));
  const [time, setTime] = useState(prefill.time ?? "");

  // Who is the booking for?
  const [clientId, setClientId] = useState<string>(prefill.clientId ?? meClient?.id ?? "");
  const [clientName, setClientName] = useState("");
  const [query, setQuery] = useState("");

  const clientOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return db.clients.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 6);
  }, [db.clients, query]);

  const day = fromDayKey(date);
  const closed = shop ? shop.closedDays.includes(day.getDay()) : false;
  const existing = appointmentsOn(
    db.appointments.filter((a) => a.status === "booked" || a.status === "done"),
    day,
    effectiveBarberId,
  );

  const slots = useMemo(() => {
    if (!shop) return [];
    const out: { time: string; free: boolean; past: boolean }[] = [];
    const now = new Date();
    for (let m = shop.openHour * 60; m < shop.closeHour * 60; m += 30) {
      const start = new Date(day);
      start.setMinutes(m);
      const end = new Date(start.getTime() + (service?.minutes ?? 30) * 60_000);
      const clash = existing.some((a) => {
        const aStart = new Date(a.startsAt);
        const aEnd = new Date(aStart.getTime() + a.minutes * 60_000);
        return start < aEnd && end > aStart;
      });
      out.push({ time: fmtTime(start), free: !clash && end.getHours() * 60 + end.getMinutes() <= shop.closeHour * 60, past: start < now });
    }
    return out;
  }, [shop, day, existing, service]);

  const selectedClient = clientId ? db.clients.find((c) => c.id === clientId) : null;
  const canSubmit =
    !!shop && !!effectiveBarberId && !!time && !closed && (role === "client" ? !!meClient : !!selectedClient || clientName.trim().length > 1);

  const submit = () => {
    if (!canSubmit || !role) return;
    const [h, mi] = time.split(":").map(Number);
    const startsAt = new Date(day);
    startsAt.setHours(h, mi, 0, 0);
    addAppointment({
      shopId,
      barberId: effectiveBarberId,
      clientId: selectedClient?.id ?? null,
      clientName: selectedClient ? undefined : clientName.trim() || undefined,
      serviceId,
      startsAt: startsAt.toISOString(),
      bookedBy: role,
    });
    onDone();
  };

  return (
    <div className="space-y-4">
      {role !== "barber" && db.shops.length > 1 && (
        <Field label="Shop">
          <Select value={shopId} onChange={(e) => setShopId(e.target.value)}>
            {db.shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.area}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {role !== "barber" && (
        <div>
          <span className="mb-1 block text-xs font-medium text-ink-2">Barber</span>
          <div className="flex flex-wrap gap-2">
            {barbers.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBarberId(b.id)}
                className={cx(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                  effectiveBarberId === b.id ? "border-ink bg-ink text-canvas" : "border-line-2 bg-surface",
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {role !== "client" && (
        <div>
          <span className="mb-1 block text-xs font-medium text-ink-2">Client</span>
          {selectedClient ? (
            <div className="flex items-center justify-between rounded-xl border border-ink bg-ink px-3 py-2 text-sm text-canvas">
              <span>
                {selectedClient.name} <span className="text-canvas/70">{selectedClient.phone}</span>
              </span>
              <button className="text-xs text-canvas/70 underline" onClick={() => setClientId("")}>
                change
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input placeholder="Search client list…" value={query} onChange={(e) => setQuery(e.target.value)} />
              {clientOptions.length > 0 && (
                <div className="rounded-xl border border-line">
                  {clientOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setClientId(c.id);
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
              <Input
                placeholder="…or type a name for someone new"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Service">
          <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {db.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.minutes} min
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input
            type="date"
            value={date}
            min={dayKey(new Date())}
            max={dayKey(addDays(new Date(), 60))}
            onChange={(e) => {
              setDate(e.target.value);
              setTime("");
            }}
          />
        </Field>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-ink-2">
          Time · {fmtDay(day)}
          {closed && <span className="ml-2 text-bad">closed</span>}
        </span>
        {!closed && (
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
            {slots.map((s) => (
              <button
                key={s.time}
                type="button"
                disabled={!s.free || s.past}
                onClick={() => setTime(s.time)}
                className={cx(
                  "h-9 rounded-lg border text-xs font-medium tabular-nums",
                  time === s.time
                    ? "border-ink bg-ink text-canvas"
                    : s.free && !s.past
                      ? "border-line-2 bg-surface text-ink hover:border-ink"
                      : "border-line bg-canvas text-canvas/70 line-through",
                )}
              >
                {s.time}
              </button>
            ))}
          </div>
        )}
      </div>

      <Button size="lg" className="w-full" disabled={!canSubmit} onClick={submit}>
        Confirm booking{time ? ` · ${fmtDay(day)} ${time}` : ""}
      </Button>
    </div>
  );
}
