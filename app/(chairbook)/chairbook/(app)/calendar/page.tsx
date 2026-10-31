"use client";

import { useState } from "react";
import { BookingForm, type BookingPrefill } from "@/components/chairbook/BookingForm";
import { SaleForm, type SalePrefill } from "@/components/chairbook/SaleForm";
import { useShopFilter } from "@/components/chairbook/Shell";
import { Badge, Button, Card, Empty, PageTitle, Sheet, cx } from "@/components/chairbook/ui";
import { addDays, dayKey, fmtDayLong, fmtTime, startOfDay } from "@/lib/chairbook/format";
import { appointmentsOn, salesIn, totals, weekdayProfile } from "@/lib/chairbook/selectors";
import { useChairbook } from "@/lib/chairbook/store";
import type { Appointment } from "@/lib/chairbook/types";

export default function CalendarPage() {
  const { db, role, me, setAppointmentStatus } = useChairbook();
  const { shopId } = useShopFilter();
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [booking, setBooking] = useState<BookingPrefill | null>(null);
  const [paying, setPaying] = useState<SalePrefill | null>(null);

  const barbers = db.barbers.filter(
    (b) => b.active && (me ? b.id === me.id : !shopId || b.shopId === shopId),
  );
  const isToday = dayKey(day) === dayKey(new Date());
  const profile = weekdayProfile(salesIn(db.sales, { shopId }));
  const dowRow = profile.find((r) => r.dow === day.getDay());
  const busyWalkIns = dowRow && dowRow.walkInShare >= 40;

  const dayTotals = totals(salesIn(db.sales, { from: day, to: addDays(day, 1), shopId, barberId: me?.id }));

  return (
    <div className="space-y-5">
      <PageTitle
        title={role === "barber" ? "Your day" : "Calendar"}
        sub={fmtDayLong(day)}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day">
              ‹
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDay(startOfDay(new Date()))}>
              Today
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDay(addDays(day, 1))} aria-label="Next day">
              ›
            </Button>
            <Button size="sm" onClick={() => setBooking({ date: dayKey(day), shopId: shopId ?? undefined })}>
              + Book
            </Button>
          </div>
        }
      />

      {busyWalkIns && role !== "client" && (
        <div className="rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          <strong>Heavy walk-in day.</strong> {dowRow?.walkInShare}% of visits on this weekday are walk-ins (avg{" "}
          {dowRow?.avgWalkIns} per day). Keep slots free rather than filling the diary.
        </div>
      )}

      {isToday && (
        <div className="text-sm text-ink-3">
          So far today: <span className="font-medium text-ink">{dayTotals.count} cuts</span> ·{" "}
          {dayTotals.walkIns} walk-ins · {dayTotals.booked} booked
        </div>
      )}

      <div className={cx("grid gap-4", barbers.length > 1 && "md:grid-cols-2", barbers.length > 2 && "xl:grid-cols-4")}>
        {barbers.map((b) => {
          const appts = appointmentsOn(db.appointments, day, b.id).filter((a) => a.status !== "cancelled");
          const walkIns = salesIn(db.sales, { from: day, to: addDays(day, 1), barberId: b.id }).filter(
            (s) => s.source === "walk-in",
          );
          return (
            <Card
              key={b.id}
              title={
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                  {b.name}
                  <span className="font-normal text-ink-3">{db.shops.find((s) => s.id === b.shopId)?.name}</span>
                </span>
              }
              action={
                <span className="text-xs text-ink-3">
                  {appts.length} booked · {walkIns.length} walk-in
                </span>
              }
            >
              {appts.length === 0 ? (
                <Empty>
                  No bookings.{" "}
                  <button
                    className="font-medium text-ink underline"
                    onClick={() => setBooking({ date: dayKey(day), barberId: b.id, shopId: b.shopId })}
                  >
                    Book one
                  </button>
                </Empty>
              ) : (
                appts.map((a) => (
                  <ApptRow
                    key={a.id}
                    a={a}
                    onPay={() =>
                      setPaying({
                        shopId: a.shopId,
                        barberId: a.barberId,
                        clientId: a.clientId,
                        clientName: a.clientName,
                        serviceId: a.serviceId,
                        appointmentId: a.id,
                        source: "booked",
                      })
                    }
                    onStatus={(s) => setAppointmentStatus(a.id, s)}
                  />
                ))
              )}
              <button
                className="mt-3 w-full rounded-xl border border-dashed border-line-2 py-2 text-xs font-medium text-ink-3 hover:border-ink hover:text-ink"
                onClick={() => setBooking({ date: dayKey(day), barberId: b.id, shopId: b.shopId })}
              >
                + Book for {b.name}
              </button>
            </Card>
          );
        })}
      </div>

      <Sheet open={booking !== null} onClose={() => setBooking(null)} title="New booking">
        {booking && <BookingForm prefill={booking} onDone={() => setBooking(null)} />}
      </Sheet>
      <Sheet open={paying !== null} onClose={() => setPaying(null)} title="Take payment">
        {paying && <SaleForm prefill={paying} onDone={() => setPaying(null)} />}
      </Sheet>
    </div>
  );
}

function ApptRow({
  a,
  onPay,
  onStatus,
}: {
  a: Appointment;
  onPay: () => void;
  onStatus: (s: Appointment["status"]) => void;
}) {
  const { db } = useChairbook();
  const client = a.clientId ? db.clients.find((c) => c.id === a.clientId) : null;
  const name = client?.name ?? a.clientName ?? "Walk-in";
  const own = client && client.ownerBarberId === a.barberId;
  const sale = a.saleId ? db.sales.find((s) => s.id === a.saleId) : null;
  return (
    <div className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
      <div className="w-12 shrink-0 text-sm font-semibold tabular-nums text-ink">{fmtTime(a.startsAt)}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-ink">
          {name} {own && <Badge tone="info">own</Badge>}
        </div>
        <div className="truncate text-xs text-ink-3">
          {db.services.find((s) => s.id === a.serviceId)?.name} · {a.minutes} min · booked by {a.bookedBy}
        </div>
      </div>
      {a.status === "booked" && (
        <div className="flex shrink-0 gap-1">
          <Button size="sm" onClick={onPay}>
            Pay
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onStatus("no-show")} title="No-show">
            ✕
          </Button>
        </div>
      )}
      {a.status === "done" && (
        <Badge tone="good">
          paid {sale ? `€${sale.amount} ${sale.method}` : ""}
        </Badge>
      )}
      {a.status === "no-show" && <Badge tone="bad">no-show</Badge>}
    </div>
  );
}
