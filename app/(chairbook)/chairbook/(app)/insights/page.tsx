"use client";

import { Legend, SERIES, StackedBars } from "@/components/chairbook/charts";
import { useShopFilter } from "@/components/chairbook/Shell";
import { Badge, Card, PageTitle, Stat } from "@/components/chairbook/ui";
import { eur, WEEKDAYS, WEEKDAYS_LONG, addDays, startOfDay } from "@/lib/chairbook/format";
import { hourProfile, salesIn, totals, weekdayProfile } from "@/lib/chairbook/selectors";
import { useChairbook } from "@/lib/chairbook/store";

export default function InsightsPage() {
  const { db } = useChairbook();
  const { shopId } = useShopFilter();
  const weeks = 8;
  const all = salesIn(db.sales, { shopId, from: addDays(startOfDay(new Date()), -weeks * 7), to: startOfDay(new Date()) });
  const profile = weekdayProfile(db.sales.filter((s) => !shopId || s.shopId === shopId), weeks).filter((r) => r.days > 0);
  const t = totals(all);
  const shop = db.shops.find((s) => s.id === shopId) ?? db.shops[0];
  const hours = hourProfile(all, shop?.openHour ?? 9, shop?.closeHour ?? 19);

  const ranked = [...profile].sort((a, b) => b.avgWalkIns - a.avgWalkIns);
  const walkInDays = ranked.filter((r) => r.walkInShare >= 40);
  const bookingDays = [...profile].sort((a, b) => a.walkInShare - b.walkInShare).slice(0, 3);

  const walkInSales = all.filter((s) => s.source === "walk-in");
  const bookedSales = all.filter((s) => s.source === "booked");
  const avgWalkIn = walkInSales.length ? walkInSales.reduce((a, s) => a + s.amount, 0) / walkInSales.length : 0;
  const avgBooked = bookedSales.length ? bookedSales.reduce((a, s) => a + s.amount, 0) / bookedSales.length : 0;
  const shopWalkIn = walkInSales.reduce((a, s) => a + s.shopShare, 0);
  const shopBooked = bookedSales.reduce((a, s) => a + s.shopShare, 0);

  return (
    <div className="space-y-5">
      <PageTitle title="Insights" sub={`Last ${weeks} weeks · ${shopId ? shop?.name : "all shops"}`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Avg walk-in ticket" value={avgWalkIn} sub={`${walkInSales.length} walk-ins`} />
        <Stat label="Avg booked ticket" value={avgBooked} sub={`${bookedSales.length} booked`} />
        <Stat label="Shop net from walk-ins" value={shopWalkIn} tone="good" sub={`${Math.round((shopWalkIn / (t.shop || 1)) * 100)}% of shop net`} />
        <Stat label="Shop net from bookings" value={shopBooked} sub={`${Math.round((shopBooked / (t.shop || 1)) * 100)}% of shop net`} />
      </div>

      <Card
        title="Visits per weekday (average per day, all barbers)"
        action={<Legend items={[{ label: "Booked", color: SERIES.booked }, { label: "Walk-ins", color: SERIES.walkIn }]} />}
      >
        <StackedBars
          rows={profile.map((r) => ({
            label: WEEKDAYS[r.dow],
            parts: [
              { key: "Booked", value: r.avgBooked, color: SERIES.booked },
              { key: "Walk-ins", value: r.avgWalkIns, color: SERIES.walkIn },
            ],
            note: `${r.walkInShare}% walk-in · avg ${eur(r.avgGross)}/day`,
          }))}
          format={(v) => String(Math.round(v * 10) / 10)}
          highlight={(r) => profile.find((p) => WEEKDAYS[p.dow] === r.label)!.walkInShare >= 40}
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left uppercase tracking-wider text-ink-3">
              <tr className="border-b border-line">
                <th className="py-1.5 font-medium">Day</th>
                <th className="py-1.5 text-right font-medium">Booked</th>
                <th className="py-1.5 text-right font-medium">Walk-ins</th>
                <th className="py-1.5 text-right font-medium">Walk-in share</th>
                <th className="py-1.5 text-right font-medium">Avg gross</th>
                <th className="py-1.5 text-right font-medium">Plan</th>
              </tr>
            </thead>
            <tbody>
              {profile.map((r) => (
                <tr key={r.dow} className="border-b border-line last:border-0">
                  <td className="py-1.5 font-medium text-ink">{WEEKDAYS_LONG[r.dow]}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.avgBooked}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.avgWalkIns}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.walkInShare}%</td>
                  <td className="py-1.5 text-right tabular-nums">{eur(r.avgGross)}</td>
                  <td className="py-1.5 text-right">
                    {r.walkInShare >= 40 ? (
                      <Badge tone="warn">keep slots open</Badge>
                    ) : r.walkInShare <= 25 ? (
                      <Badge tone="info">fill with bookings</Badge>
                    ) : (
                      <Badge>mixed</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Booking policy suggestion">
          <ul className="space-y-2 text-sm text-ink-2">
            {walkInDays.length > 0 && (
              <li className="rounded-xl bg-warn/10 p-3 text-warn">
                <strong>{walkInDays.map((r) => WEEKDAYS_LONG[r.dow]).join(" & ")}</strong>: walk-ins bring{" "}
                {walkInDays.map((r) => `${r.avgWalkIns}`).join(" and ")} walk-ins a day on average. Limit online bookings to
                mornings and leave the afternoon open.
              </li>
            )}
            <li className="rounded-xl bg-info/10 p-3 text-info">
              <strong>{bookingDays.map((r) => WEEKDAYS_LONG[r.dow]).join(", ")}</strong>: few walk-ins — push clients to
              book these days so barbers stay busy.
            </li>
            <li className="text-xs text-ink-3">
              Rules of thumb: a weekday with ≥40% walk-in share is flagged. Based on the last {weeks} weeks of recorded
              payments{shopId ? ` at ${shop?.name}` : " across both shops"}.
            </li>
          </ul>
        </Card>
        <Card
          title="Visits by hour"
          action={<Legend items={[{ label: "Booked", color: SERIES.booked }, { label: "Walk-ins", color: SERIES.walkIn }]} />}
        >
          <StackedBars
            rows={hours.map((h) => ({
              label: `${h.hour}`,
              parts: [
                { key: "Booked", value: h.booked, color: SERIES.booked },
                { key: "Walk-ins", value: h.walkIns, color: SERIES.walkIn },
              ],
            }))}
          />
          <p className="mt-2 text-xs text-ink-3">Total visits per opening hour over the period.</p>
        </Card>
      </div>

      {!shopId && db.shops.length > 1 && (
        <Card title="Shop comparison">
          <div className="grid gap-3 sm:grid-cols-2">
            {db.shops.map((s) => {
              const st = totals(all.filter((x) => x.shopId === s.id));
              return (
                <div key={s.id} className="rounded-xl bg-canvas p-4">
                  <div className="text-sm font-semibold text-ink">{s.name}</div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-ink-3">
                    <div>
                      Gross
                      <div className="text-sm font-semibold tabular-nums text-ink">{eur(st.gross)}</div>
                    </div>
                    <div>
                      Shop net
                      <div className="text-sm font-semibold tabular-nums text-good">{eur(st.shop)}</div>
                    </div>
                    <div>
                      Walk-in share
                      <div className="text-sm font-semibold tabular-nums text-ink">
                        {Math.round((st.walkIns / (st.count || 1)) * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
