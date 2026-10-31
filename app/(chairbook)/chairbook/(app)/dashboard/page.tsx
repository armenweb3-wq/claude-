"use client";

import Link from "next/link";
import { useState } from "react";
import { DailyBars, SERIES, ShareBar } from "@/components/chairbook/charts";
import { useShopFilter } from "@/components/chairbook/Shell";
import { Badge, Card, Empty, Money, PageTitle, Row, Segmented, Stat } from "@/components/chairbook/ui";
import { eur, fmtDayLong, fmtTime, WEEKDAYS } from "@/lib/chairbook/format";
import {
  byBarber,
  clientInsights,
  clientLabel,
  dailySeries,
  expensesIn,
  noShowsIn,
  periodRange,
  salesIn,
  settlement,
  sumExpenses,
  topClients,
  totals,
  type Period,
} from "@/lib/chairbook/selectors";
import { useChairbook } from "@/lib/chairbook/store";

export default function DashboardPage() {
  const { db } = useChairbook();
  const { shopId } = useShopFilter();
  const [period, setPeriod] = useState<Period>("today");
  const { from, to } = periodRange(period);
  const sales = salesIn(db.sales, { from, to, shopId });
  const t = totals(sales);
  const rows = byBarber(db, sales).filter((r) => !shopId || r.who.shopId === shopId);
  const unmatched = db.cardEvents.filter((e) => e.status === "unmatched" && (!shopId || e.shopId === shopId));
  const series = dailySeries(salesIn(db.sales, { shopId }), 14);
  const recent = [...sales].reverse().slice(0, 8);
  const expenses = sumExpenses(expensesIn(db.expenses, { from, to, shopId, shopOnly: true }));
  const profit = Math.round((t.shop - expenses) * 100) / 100;
  const noShows = noShowsIn(db, { from, to, shopId }).length;
  const insights = clientInsights(db, { shopId });
  const slipping = insights.filter((i) => i.status === "slipping").length;
  const lost = insights.filter((i) => i.status === "lost").length;
  const newClients = db.clients.filter((c) => (!shopId || c.shopId === shopId) && c.createdAt >= from.toISOString()).length;

  return (
    <div className="space-y-5">
      <PageTitle
        title={shopId ? db.shops.find((s) => s.id === shopId)?.name ?? "" : "All shops"}
        sub={fmtDayLong(new Date())}
        action={
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: "today", label: "Today" },
              { value: "week", label: "This week" },
              { value: "month", label: "This month" },
            ]}
          />
        }
      />

      {unmatched.length > 0 && (
        <Link
          href="/chairbook/till"
          className="flex items-center justify-between rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn"
        >
          <span>
            <strong>{unmatched.length} card payment{unmatched.length > 1 ? "s" : ""}</strong> from the JCC
            terminal not yet assigned to a client
          </span>
          <span className="font-medium">Assign →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Gross takings" value={t.gross} sub={`${t.count} cuts · ${t.walkIns} walk-ins (${Math.round((t.walkIns / (t.count || 1)) * 100)}%)`} />
        <Stat label="Shop net" value={t.shop} sub={`${Math.round((t.shop / (t.gross || 1)) * 100)}% of gross · barbers keep ${eur(t.barber)}`} />
        <Stat label="Shop expenses" value={expenses} tone={expenses ? "bad" : "neutral"} sub="rent, utilities, supplies" />
        <Stat label="Profit" value={profit} tone={profit >= 0 ? "good" : "bad"} sub="shop net minus expenses" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cash in drawers" value={t.cash} sub={`${eur(t.card)} by card`} />
        <Stat label="No-shows" value={`${noShows}`} money={false} tone={noShows ? "warn" : "neutral"} sub="missed bookings this period" />
        <Link href="/chairbook/clients" className="block">
          <Stat label="Clients slipping away" value={`${slipping}`} money={false} tone={slipping ? "warn" : "neutral"} sub={`${lost} already lost · tap to see who`} />
        </Link>
        <Stat label="New clients" value={`${newClients}`} money={false} tone="info" sub={`${insights.filter((i) => i.status === "regular").length} regulars overall`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Cash vs card" className="lg:col-span-1">
          <ShareBar
            parts={[
              { label: "Cash", value: t.cash, color: SERIES.walkIn },
              { label: "Card", value: t.card, color: SERIES.booked },
            ]}
          />
          <p className="mt-3 text-xs text-ink-3">
            Card money lands in the shop account; cash is settled with each barber at close.
          </p>
        </Card>
        <Card title="Last 14 days" className="lg:col-span-2">
          <DailyBars
            points={series.map((p) => ({
              label: WEEKDAYS[p.day.getDay()],
              value: p.gross,
              sub: p.shop,
            }))}
          />
          <div className="mt-1 flex gap-4 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.muted }} /> Gross
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.single }} /> Shop net
            </span>
          </div>
        </Card>
      </div>

      <Card title="By barber" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">Barber</th>
                <th className="px-2 py-2 text-right font-medium">Cuts</th>
                <th className="px-2 py-2 text-right font-medium">Gross</th>
                <th className="px-2 py-2 text-right font-medium">Shop</th>
                <th className="px-2 py-2 text-right font-medium">Barber</th>
                <th className="px-2 py-2 text-right font-medium">Cash</th>
                <th className="px-4 py-2 text-right font-medium">Settle</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = settlement(sales.filter((s) => s.barberId === r.who.id));
                return (
                  <tr key={r.who.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.who.color }} />
                        {r.who.name}
                        <span className="text-xs text-ink-3">
                          {db.shops.find((s) => s.id === r.who.shopId)?.name}
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.count}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{eur(r.gross)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-medium text-good">{eur(r.shop)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{eur(r.barber)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-ink-3">{eur(r.cash)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {st.net === 0 ? (
                        <Badge>even</Badge>
                      ) : st.net > 0 ? (
                        <Badge tone="info">pay {eur(st.net)}</Badge>
                      ) : (
                        <Badge tone="good">collect {eur(-st.net)}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-ink-3">
                    No sales in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-xs text-ink-3">
          <strong>Settle</strong> assumes the barber keeps the cash they took: <em>pay</em> = shop owes the barber,{" "}
          <em>collect</em> = barber hands cash to the shop.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Latest payments">
          {recent.length === 0 ? (
            <Empty>Nothing recorded yet.</Empty>
          ) : (
            recent.map((s) => (
              <Row
                key={s.id}
                dot={db.barbers.find((b) => b.id === s.barberId)?.color}
                left={
                  <>
                    {clientLabel(db, s)}{" "}
                    <span className="text-xs text-ink-3">· {db.services.find((x) => x.id === s.serviceId)?.name}</span>
                  </>
                }
                sub={`${fmtTime(s.at)} · ${db.barbers.find((b) => b.id === s.barberId)?.name} · ${s.method} · ${s.clientType === "own" ? "own client" : "walk-in deal"}`}
                right={
                  <>
                    <Money value={s.amount} />
                    <div className="text-xs text-good">shop {eur(s.shopShare)}</div>
                  </>
                }
              />
            ))
          )}
        </Card>
        <Card title="Top clients (this period)">
          {topClients(db, sales).map((r) => (
            <Row
              key={r.client.id}
              left={r.client.name}
              sub={
                r.client.ownerBarberId
                  ? `${db.barbers.find((b) => b.id === r.client.ownerBarberId)?.name}'s client`
                  : "Shop client"
              }
              right={
                <>
                  <Money value={r.gross} />
                  <div className="text-xs text-ink-3">{r.count} visits</div>
                </>
              }
            />
          ))}
          {topClients(db, sales).length === 0 && <Empty>No named clients yet.</Empty>}
        </Card>
      </div>
    </div>
  );
}
