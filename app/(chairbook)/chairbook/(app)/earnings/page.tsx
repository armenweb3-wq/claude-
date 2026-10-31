"use client";

import { useState } from "react";
import { SERIES, ShareBar } from "@/components/chairbook/charts";
import { Card, Empty, Money, PageTitle, Row, Segmented, Stat } from "@/components/chairbook/ui";
import { describeRule } from "@/lib/chairbook/deals";
import { eur, fmtDay, fmtTime } from "@/lib/chairbook/format";
import { clientLabel, periodRange, salesIn, settlement, type Period } from "@/lib/chairbook/selectors";
import { useChairbook } from "@/lib/chairbook/store";

export default function EarningsPage() {
  const { db, me } = useChairbook();
  const [period, setPeriod] = useState<Period>("today");
  if (!me) return <p className="text-sm text-slate-500">Earnings are only shown to barbers.</p>;

  const { from, to } = periodRange(period);
  const sales = salesIn(db.sales, { from, to, barberId: me.id });
  const st = settlement(sales);
  const own = sales.filter((s) => s.clientType === "own");
  const walk = sales.filter((s) => s.clientType === "walkin");
  const sum = (xs: typeof sales, k: "amount" | "barberShare" | "shopShare") => xs.reduce((a, s) => a + s[k], 0);

  return (
    <div className="space-y-5">
      <PageTitle
        title="Your earnings"
        sub={`${describeRule(me.deal.ownClients)} on your clients · ${describeRule(me.deal.walkIns)} on walk-ins`}
        action={
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: "today", label: "Today" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="You keep" value={st.barber} tone="info" sub={`${st.count} cuts`} />
        <Stat label="You charged" value={st.gross} />
        <Stat label="Shop's share" value={st.shop} />
        <Stat label="Cash in your pocket" value={st.cashCollected} sub={`${eur(st.card)} went by card`} />
      </div>

      <Card title="Settlement with the shop">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Your share <strong className="tabular-nums text-slate-900">{eur(st.barber)}</strong> minus cash you already
            hold <strong className="tabular-nums text-slate-900">{eur(st.cashCollected)}</strong>
          </div>
          <div
            className={
              "rounded-xl px-4 py-2 text-sm font-semibold tabular-nums " +
              (st.net > 0 ? "bg-blue-50 text-blue-800" : st.net < 0 ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700")
            }
          >
            {st.net > 0 ? `Shop pays you ${eur(st.net)}` : st.net < 0 ? `You hand over ${eur(-st.net)}` : "All square"}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Your clients vs walk-ins">
          <ShareBar
            parts={[
              { label: "Your clients", value: sum(own, "barberShare"), color: SERIES.booked },
              { label: "Walk-ins", value: sum(walk, "barberShare"), color: SERIES.walkIn },
            ]}
          />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
            <div>
              {own.length} own-client cuts · charged {eur(sum(own, "amount"))}
              <div className="text-slate-900">you kept {eur(sum(own, "barberShare"))}</div>
            </div>
            <div>
              {walk.length} walk-in cuts · charged {eur(sum(walk, "amount"))}
              <div className="text-slate-900">you kept {eur(sum(walk, "barberShare"))}</div>
            </div>
          </div>
        </Card>
        <Card title="Cash vs card">
          <ShareBar
            parts={[
              { label: "Cash", value: st.cash, color: SERIES.walkIn },
              { label: "Card", value: st.card, color: SERIES.booked },
            ]}
          />
        </Card>
      </div>

      <Card title="Every cut">
        {sales.length === 0 ? (
          <Empty>No payments in this period.</Empty>
        ) : (
          [...sales].reverse().map((s) => (
            <Row
              key={s.id}
              left={
                <>
                  {clientLabel(db, s)}
                  <span className="ml-2 text-xs text-slate-400">{db.services.find((x) => x.id === s.serviceId)?.name}</span>
                </>
              }
              sub={`${period === "today" ? fmtTime(s.at) : `${fmtDay(s.at)} ${fmtTime(s.at)}`} · ${s.method} · ${s.clientType === "own" ? "your client" : "walk-in"}`}
              right={
                <>
                  <Money value={s.barberShare} className="font-medium text-blue-700" />
                  <div className="text-xs text-slate-400">of {eur(s.amount)}</div>
                </>
              }
            />
          ))
        )}
      </Card>
    </div>
  );
}
