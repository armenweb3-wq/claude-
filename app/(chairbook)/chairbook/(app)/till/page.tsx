"use client";

import { useState } from "react";
import { SaleForm, type SalePrefill } from "@/components/chairbook/SaleForm";
import { useShopFilter } from "@/components/chairbook/Shell";
import { Badge, Button, Card, Empty, Money, PageTitle, Row, Sheet, Stat } from "@/components/chairbook/ui";
import { eur, fmtTime, startOfDay, addDays } from "@/lib/chairbook/format";
import { clientLabel, salesIn, settlement, totals } from "@/lib/chairbook/selectors";
import { useChairbook } from "@/lib/chairbook/store";

export default function TillPage() {
  const { db, role, me, ignoreCardEvent } = useChairbook();
  const { shopId } = useShopFilter();
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<SalePrefill>({});

  const today = startOfDay(new Date());
  const sales = salesIn(db.sales, {
    from: today,
    to: addDays(today, 1),
    shopId,
    barberId: me?.id ?? null,
  }).reverse();
  const t = totals(sales);
  const unmatched = db.cardEvents
    .filter((e) => e.status === "unmatched" && (!shopId || e.shopId === shopId))
    .sort((a, b) => b.at.localeCompare(a.at));
  const mine = me ? settlement(sales) : null;

  const openWith = (p: SalePrefill) => {
    setPrefill(p);
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageTitle
        title="Till"
        sub="Record every cut as it's paid — cash or card."
        action={
          <Button size="lg" onClick={() => openWith({})}>
            + Record payment
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Today gross" value={t.gross} sub={`${t.count} cuts`} />
        <Stat label="Cash taken" value={t.cash} />
        <Stat label="Card (JCC)" value={t.card} />
        {mine ? (
          <Stat
            label="Your share today"
            value={mine.barber}
            tone="info"
            sub={
              mine.net > 0
                ? `shop pays you ${eur(mine.net)} at close`
                : mine.net < 0
                  ? `hand ${eur(-mine.net)} cash to shop at close`
                  : "settled"
            }
          />
        ) : (
          <Stat label="Shop net today" value={t.shop} tone="good" />
        )}
      </div>

      <Card
        title={
          <span className="inline-flex items-center gap-2">
            JCC terminal inbox <Badge tone={unmatched.length ? "warn" : "good"}>{unmatched.length} unmatched</Badge>
          </span>
        }
      >
        <p className="mb-3 text-xs text-ink-3">
          Card payments the terminal reported that aren&apos;t tied to a client yet. Assign each one so the barber gets
          credited and the client&apos;s history stays right.
        </p>
        {unmatched.length === 0 ? (
          <Empty>All card payments are matched.</Empty>
        ) : (
          unmatched.map((e) => (
            <div key={e.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-ink">
                  <span className="font-semibold tabular-nums">{eur(e.amount)}</span>{" "}
                  <span className="text-ink-3">•••• {e.last4}</span>
                </div>
                <div className="text-xs text-ink-3">
                  {fmtTime(e.at)} · {e.terminalId} · {db.shops.find((s) => s.id === e.shopId)?.name}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => ignoreCardEvent(e.id)}>
                Ignore
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  openWith({
                    shopId: e.shopId,
                    barberId: me?.id ?? db.barbers.find((b) => b.shopId === e.shopId)?.id,
                    amount: e.amount,
                    method: "card",
                    cardEventId: e.id,
                  })
                }
              >
                Assign
              </Button>
            </div>
          ))
        )}
      </Card>

      <Card title={role === "barber" ? "Your payments today" : "Today's ledger"}>
        {sales.length === 0 ? (
          <Empty>No payments yet today.</Empty>
        ) : (
          sales.map((s) => (
            <Row
              key={s.id}
              dot={db.barbers.find((b) => b.id === s.barberId)?.color}
              left={
                <>
                  {clientLabel(db, s)}
                  <span className="ml-2 text-xs text-ink-3">{db.services.find((x) => x.id === s.serviceId)?.name}</span>
                </>
              }
              sub={`${fmtTime(s.at)} · ${db.barbers.find((b) => b.id === s.barberId)?.name} · ${s.clientType === "own" ? "own client" : "walk-in deal"} · ${s.source}`}
              right={
                <>
                  <Money value={s.amount} className="font-medium" />
                  <div className="text-xs text-ink-3">
                    <Badge tone={s.method === "cash" ? "warn" : "info"}>{s.method}</Badge> shop {eur(s.shopShare)} ·{" "}
                    {role === "barber" ? "you" : "barber"} {eur(s.barberShare)}
                  </div>
                </>
              }
            />
          ))
        )}
      </Card>

      <Sheet open={open} onClose={() => setOpen(false)} title="Record payment">
        <SaleForm prefill={prefill} onDone={() => setOpen(false)} />
      </Sheet>
    </div>
  );
}
