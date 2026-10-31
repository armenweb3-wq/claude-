"use client";

import { useState } from "react";
import { BookingForm, type BookingPrefill } from "@/components/chairbook/BookingForm";
import { SaleForm, type SalePrefill } from "@/components/chairbook/SaleForm";
import { useShopFilter } from "@/components/chairbook/Shell";
import { Badge, Button, Card, Empty, PageTitle, Sheet, cx } from "@/components/chairbook/ui";
import { eur, addDays, dayKey, fmtDayLong, fmtTime, startOfDay } from "@/lib/chairbook/format";
import { appointmentsOn, salesIn, totals, weekdayProfile } from "@/lib/chairbook/selectors";
import { useChairbook } from "@/lib/chairbook/store";
import type { Appointment } from "@/lib/chairbook/types";

export default function CalendarPage() {
  const { db, role, me, setAppointmentStatus } = useChairbook();
  const { shopId } = useShopFilter();
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [booking, setBooking] = useState<BookingPrefill | null>(null);
  const [paying, setPaying] = useState<SalePrefill | null>(null);

  const barbers = db.barbers.filter((b) => b.active && (me ? b.id === me.id : !shopId || b.shopId === shopId));
  const isToday = dayKey(day) === dayKey(new Date());
  const profile = weekdayProfile(salesIn(db.sales, { shopId, barberId: me?.id }));
  const dowRow = profile.find((r) => r.dow === day.getDay());
  const busyWalkIns = dowRow && dowRow.walkInShare >= 40;
  const dayTotals = totals(salesIn(db.sales, { from: day, to: addDays(day, 1), shopId, barberId: me?.id }));
  const nextUp = me
    ? appointmentsOn(db.appointments, day, me.id).find((a) => a.status === "booked" && new Date(a.startsAt) >= new Date())
    : null;

  return (
    <div className={cx("space-y-4", me && "pb-20 sm:pb-0")}>
      <PageTitle
        title={me ? (isToday ? "Today" : fmtDayLong(day)) : "Calendar"}
        sub={me ? (isToday ? fmtDayLong(day) : undefined) : fmtDayLong(day)}
        action={
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day">
              ‹
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDay(startOfDay(new Date()))}>
              Today
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDay(addDays(day, 1))} aria-label="Next day">
              ›
            </Button>
            {!me && (
              <Button size="sm" onClick={() => setBooking({ date: dayKey(day), shopId: shopId ?? undefined })}>
                + Book
              </Button>
            )}
          </div>
        }
      />

      {me && isToday && (
        <div className="grid grid-cols-3 gap-2">
          <Mini label="Cuts" value={String(dayTotals.count)} sub={`${dayTotals.walkIns} walk-in`} />
          <Mini label="You keep" value={eur(dayTotals.barber + dayTotals.tips)} sub={dayTotals.tips ? `incl. ${eur(dayTotals.tips)} tips` : "so far"} />
          <Mini label="Next" value={nextUp ? fmtTime(nextUp.startsAt) : "—"} sub={nextUp ? db.clients.find((c) => c.id === nextUp.clientId)?.name?.split(" ")[0] ?? nextUp.clientName ?? "Walk-in" : "nothing booked"} />
        </div>
      )}

      {busyWalkIns && role !== "client" && (
        <div className="rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          <strong>Heavy walk-in day.</strong> {dowRow?.walkInShare}% of visits on this weekday are walk-ins. Keep slots free.
        </div>
      )}

      {!me && isToday && (
        <div className="text-sm text-ink-3">
          So far today: <span className="font-medium text-ink">{dayTotals.count} cuts</span> · {dayTotals.walkIns} walk-ins ·{" "}
          {dayTotals.booked} booked
        </div>
      )}

      <div className={cx("grid gap-4", barbers.length > 1 && "md:grid-cols-2", barbers.length > 2 && "xl:grid-cols-4")}>
        {barbers.map((b) => {
          const appts = appointmentsOn(db.appointments, day, b.id).filter((a) => a.status !== "cancelled");
          const walkIns = salesIn(db.sales, { from: day, to: addDays(day, 1), barberId: b.id }).filter((s) => s.source === "walk-in");
          return (
            <Card
              key={b.id}
              title={
                me ? (
                  "Appointments"
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                    {b.name}
                    <span className="font-normal text-ink-3">{db.shops.find((s) => s.id === b.shopId)?.name}</span>
                  </span>
                )
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
                  <button className="font-medium text-ink underline" onClick={() => setBooking({ date: dayKey(day), barberId: b.id, shopId: b.shopId })}>
                    Book one
                  </button>
                </Empty>
              ) : (
                appts.map((a) => (
                  <ApptRow
                    key={a.id}
                    a={a}
                    isNext={nextUp?.id === a.id}
                    onDone={() =>
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
              {!me && (
                <button
                  className="mt-3 w-full rounded-xl border border-dashed border-line-2 py-2 text-xs font-medium text-ink-3 hover:border-ink hover:text-ink"
                  onClick={() => setBooking({ date: dayKey(day), barberId: b.id, shopId: b.shopId })}
                >
                  + Book for {b.name}
                </button>
              )}
            </Card>
          );
        })}
      </div>

      {me && (
        <div className="fixed inset-x-0 bottom-[3.6rem] z-20 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2">
            <Button size="lg" className="h-12" onClick={() => setPaying({ barberId: me.id, shopId: me.shopId, source: "walk-in" })}>
              Done · walk-in
            </Button>
            <Button size="lg" variant="secondary" className="h-12" onClick={() => setBooking({ date: dayKey(day), barberId: me.id, shopId: me.shopId })}>
              + Book
            </Button>
          </div>
        </div>
      )}

      <Sheet open={booking !== null} onClose={() => setBooking(null)} title="New booking">
        {booking && <BookingForm prefill={booking} onDone={() => setBooking(null)} />}
      </Sheet>
      <Sheet open={paying !== null} onClose={() => setPaying(null)} title="Done">
        {paying && <SaleForm prefill={paying} onDone={() => setPaying(null)} />}
      </Sheet>
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-ink-3">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-ink">{value}</div>
      {sub && <div className="truncate text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}

function ApptRow({
  a,
  isNext,
  onDone,
  onStatus,
}: {
  a: Appointment;
  isNext: boolean;
  onDone: () => void;
  onStatus: (s: Appointment["status"]) => void;
}) {
  const { db } = useChairbook();
  const client = a.clientId ? db.clients.find((c) => c.id === a.clientId) : null;
  const name = client?.name ?? a.clientName ?? "Walk-in";
  const own = client && client.ownerBarberId === a.barberId;
  const sale = a.saleId ? db.sales.find((s) => s.id === a.saleId) : null;
  return (
    <div className={cx("flex items-center gap-3 border-b border-line py-2.5 last:border-0", isNext && "-mx-2 rounded-lg bg-surface-2 px-2")}>
      <div className="w-12 shrink-0 text-sm font-semibold tabular-nums text-ink">{fmtTime(a.startsAt)}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-ink">
          {name} {own && <Badge tone="info">mine</Badge>} {a.bookedBy === "client" && <Badge>online</Badge>}
        </div>
        <div className="truncate text-xs text-ink-3">
          {db.services.find((s) => s.id === a.serviceId)?.name} · {a.minutes} min
        </div>
      </div>
      {a.status === "booked" && (
        <div className="flex shrink-0 gap-1">
          <Button size="sm" className="h-9 px-4" onClick={onDone}>
            Done
          </Button>
          <Button size="sm" variant="ghost" className="h-9" onClick={() => onStatus("no-show")} title="No-show">
            ✕
          </Button>
        </div>
      )}
      {a.status === "done" && (
        <Badge tone="good">
          {sale ? `${eur(sale.amount)} ${sale.method}${sale.tip ? ` +€${sale.tip}` : ""}` : "done"}
        </Badge>
      )}
      {a.status === "no-show" && <Badge tone="bad">no-show</Badge>}
    </div>
  );
}
