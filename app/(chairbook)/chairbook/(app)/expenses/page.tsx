"use client";

import { useState } from "react";
import { ExpensesPanel, categoryLabel } from "@/components/chairbook/ExpensesPanel";
import { useShopFilter } from "@/components/chairbook/Shell";
import { Card, PageTitle, Segmented, Stat } from "@/components/chairbook/ui";
import { eur } from "@/lib/chairbook/format";
import { expensesIn, periodRange, salesIn, sumExpenses, totals, type Period } from "@/lib/chairbook/selectors";
import { useChairbook } from "@/lib/chairbook/store";
import type { ExpenseCategory } from "@/lib/chairbook/types";

export default function ExpensesPage() {
  const { db, me, role } = useChairbook();
  const { shopId } = useShopFilter();
  const [period, setPeriod] = useState<Period>("month");
  const { from, to } = periodRange(period);

  if (me) {
    const expenses = expensesIn(db.expenses, { from, to, barberId: me.id });
    const t = totals(salesIn(db.sales, { from, to, barberId: me.id }));
    const spent = sumExpenses(expenses);
    return (
      <div className="space-y-5">
        <PageTitle title="Your expenses" sub="Products, tools, transport — anything you pay for yourself." action={<PeriodPicker value={period} onChange={setPeriod} />} />
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Income" value={t.barber} tone="info" />
          <Stat label="Expenses" value={spent} tone="bad" />
          <Stat label="Net" value={t.barber - spent} tone={t.barber - spent >= 0 ? "good" : "bad"} />
        </div>
        <ExpensesPanel expenses={expenses} scope={{ shopId: me.shopId, barberId: me.id }} />
      </div>
    );
  }

  if (role !== "owner") return null;
  const expenses = expensesIn(db.expenses, { from, to, shopId, shopOnly: true });
  const barberExpenses = expensesIn(db.expenses, { from, to, shopId }).filter((e) => e.barberId);
  const t = totals(salesIn(db.sales, { from, to, shopId }));
  const spent = sumExpenses(expenses);
  const profit = Math.round((t.shop - spent) * 100) / 100;
  const cats = Array.from(new Set(expenses.map((e) => e.category))) as ExpenseCategory[];

  return (
    <div className="space-y-5">
      <PageTitle
        title="Shop expenses"
        sub={shopId ? db.shops.find((s) => s.id === shopId)?.name : "All shops"}
        action={<PeriodPicker value={period} onChange={setPeriod} />}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Shop net from cuts" value={t.shop} sub={`${t.count} cuts · ${eur(t.gross)} gross`} />
        <Stat label="Shop expenses" value={spent} tone="bad" sub={`${expenses.length} items`} />
        <Stat label="Profit" value={profit} tone={profit >= 0 ? "good" : "bad"} sub={`${t.shop ? Math.round((profit / t.shop) * 100) : 0}% margin on shop net`} />
        <Stat label="Barbers' own costs" value={sumExpenses(barberExpenses)} sub="not yours — for context" />
      </div>
      {!shopId && db.shops.length > 1 && (
        <Card title="Per shop">
          <div className="grid gap-3 sm:grid-cols-2">
            {db.shops.map((s) => {
              const ex = sumExpenses(expenses.filter((e) => e.shopId === s.id));
              const net = totals(salesIn(db.sales, { from, to, shopId: s.id })).shop;
              return (
                <div key={s.id} className="rounded-xl bg-surface-2 p-4">
                  <div className="text-sm font-semibold text-ink">{s.name}</div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-ink-3">
                    <div>
                      Shop net
                      <div className="text-sm font-semibold tabular-nums text-ink">{eur(net)}</div>
                    </div>
                    <div>
                      Expenses
                      <div className="text-sm font-semibold tabular-nums text-bad">{eur(ex)}</div>
                    </div>
                    <div>
                      Profit
                      <div className={`text-sm font-semibold tabular-nums ${net - ex >= 0 ? "text-good" : "text-bad"}`}>{eur(net - ex)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {cats.length > 1 && (
        <Card title="By category">
          {cats
            .map((c) => ({ c, total: sumExpenses(expenses.filter((e) => e.category === c)) }))
            .sort((a, b) => b.total - a.total)
            .map(({ c, total }) => (
              <div key={c} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="w-36 text-ink-2">{categoryLabel(c)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-bad/70" style={{ width: `${(total / (spent || 1)) * 100}%` }} />
                </div>
                <span className="w-20 text-right tabular-nums text-ink">{eur(total)}</span>
              </div>
            ))}
        </Card>
      )}
      <ExpensesPanel expenses={expenses} scope={{ shopId: shopId ?? db.shops[0].id, barberId: null }} />
    </div>
  );
}

function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={[
        { value: "today", label: "Today" },
        { value: "week", label: "Week" },
        { value: "month", label: "Month" },
      ]}
    />
  );
}
