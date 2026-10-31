"use client";

import { useState } from "react";
import { eur, fmtDay, dayKey } from "@/lib/chairbook/format";
import { useChairbook } from "@/lib/chairbook/store";
import type { Expense, ExpenseCategory } from "@/lib/chairbook/types";
import { Badge, Button, Card, Empty, Field, Input, Select, Sheet } from "./ui";

export const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "supplies", label: "Shop supplies" },
  { value: "products", label: "Products" },
  { value: "tools", label: "Tools & equipment" },
  { value: "marketing", label: "Marketing" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
];

export const categoryLabel = (c: ExpenseCategory) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

/**
 * Expense list + add form. `scope` fixes who the expense belongs to:
 * a barber logs their own costs, the owner logs shop overheads.
 */
export function ExpensesPanel({
  expenses,
  scope,
  title = "Expenses",
}: {
  expenses: Expense[];
  scope: { shopId: string; barberId: string | null };
  title?: string;
}) {
  const { db, addExpense, deleteExpense } = useChairbook();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>(scope.barberId ? "products" : "supplies");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(dayKey(new Date()));
  const [shopId, setShopId] = useState(scope.shopId);

  const total = expenses.reduce((a, e) => a + e.amount, 0);
  const byCat = CATEGORIES.map((c) => ({
    ...c,
    total: expenses.filter((e) => e.category === c.value).reduce((a, e) => a + e.amount, 0),
  }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <Card
      title={
        <span>
          {title} <span className="ml-1 font-normal text-ink-3">{eur(total)}</span>
        </span>
      }
      action={
        <Button size="sm" onClick={() => setOpen(true)}>
          + Add expense
        </Button>
      }
    >
      {byCat.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {byCat.map((c) => (
            <Badge key={c.value}>
              {c.label} · {eur(c.total)}
            </Badge>
          ))}
        </div>
      )}
      {expenses.length === 0 ? (
        <Empty>No expenses in this period.</Empty>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          {[...expenses].reverse().map((e) => (
            <div key={e.id} className="flex items-center gap-3 border-b border-line py-2 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-ink">{e.note || categoryLabel(e.category)}</div>
                <div className="text-xs text-ink-3">
                  {fmtDay(e.at)} · {categoryLabel(e.category)}
                  {!scope.barberId && db.shops.length > 1 && ` · ${db.shops.find((s) => s.id === e.shopId)?.name}`}
                </div>
              </div>
              <div className="text-sm font-medium tabular-nums text-bad">−{eur(e.amount)}</div>
              <button
                className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-bad"
                aria-label="Delete expense"
                onClick={() => deleteExpense(e.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Add expense">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount (€)">
              <Input type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Date">
              <Input type="date" value={date} max={dayKey(new Date())} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          {!scope.barberId && db.shops.length > 1 && (
            <Field label="Shop">
              <Select value={shopId} onChange={(e) => setShopId(e.target.value)}>
                {db.shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Note">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Clipper blades" />
          </Field>
          <Button
            size="lg"
            className="w-full"
            disabled={!(Number(amount) > 0)}
            onClick={() => {
              addExpense({
                shopId: scope.barberId ? scope.shopId : shopId,
                barberId: scope.barberId,
                category,
                amount: Number(amount),
                note: note.trim(),
                at: new Date(date + "T12:00:00").toISOString(),
              });
              setAmount("");
              setNote("");
              setOpen(false);
            }}
          >
            Save expense
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}
