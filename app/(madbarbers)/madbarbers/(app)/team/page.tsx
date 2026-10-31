"use client";

import { useState } from "react";
import { Badge, Button, Card, Field, Input, PageTitle, Select, Sheet, cx } from "@/components/chairbook/ui";
import { describeRule, settle } from "@/lib/chairbook/deals";
import { eur } from "@/lib/chairbook/format";
import { periodRange, salesIn, totals } from "@/lib/chairbook/selectors";
import { useChairbook } from "@/lib/chairbook/store";
import type { Barber, Deal, DealRule } from "@/lib/chairbook/types";

const COLORS = ["#2563eb", "#7c3aed", "#0d9488", "#ea580c", "#db2777", "#65a30d"];

export default function TeamPage() {
  const { db, role, updateDeal, addBarber, addShop } = useChairbook();
  const [editing, setEditing] = useState<Barber | null>(null);
  const [addingBarber, setAddingBarber] = useState(false);
  const [addingShop, setAddingShop] = useState(false);

  if (role !== "owner") {
    return <p className="text-sm text-ink-3">Only the owner can manage the team.</p>;
  }

  const { from, to } = periodRange("month");

  return (
    <div className="space-y-6">
      <PageTitle
        title="Team & deals"
        sub="Each barber has one deal for the clients they bring and one for walk-ins."
        action={<Button onClick={() => setAddingBarber(true)}>+ Add barber</Button>}
      />

      {db.shops.map((shop) => (
        <div key={shop.id} className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            {shop.name}
            <span className="font-normal text-ink-3">
              {shop.area} · {shop.terminalId} · {shop.openHour}:00–{shop.closeHour}:00
            </span>
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {db.barbers
              .filter((b) => b.shopId === shop.id)
              .map((b) => {
                const t = totals(salesIn(db.sales, { from, to, barberId: b.id }));
                return (
                  <Card key={b.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-base font-semibold text-ink">
                          <span className="h-3 w-3 rounded-full" style={{ background: b.color }} />
                          {b.name}
                          {!b.active && <Badge>inactive</Badge>}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-3">
                          login: {db.users.find((u) => u.barberId === b.id)?.username ?? "—"}
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(b)}>
                        Edit deal
                      </Button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <DealTile label="Own clients" rule={b.deal.ownClients} />
                      <DealTile label="Walk-ins" rule={b.deal.walkIns} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs text-ink-3">
                      <div>
                        This month
                        <div className="text-sm font-semibold tabular-nums text-ink">{t.count} cuts</div>
                      </div>
                      <div>
                        Shop earned
                        <div className="text-sm font-semibold tabular-nums text-good">{eur(t.shop)}</div>
                      </div>
                      <div>
                        Barber earned
                        <div className="text-sm font-semibold tabular-nums text-ink">{eur(t.barber)}</div>
                      </div>
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      ))}

      <Card
        title="Shops"
        action={
          <Button size="sm" variant="secondary" onClick={() => setAddingShop(true)}>
            + Add shop
          </Button>
        }
      >
        <p className="text-xs text-ink-3">
          Buying a third location? Add it here, give it its JCC terminal ID, and move or hire barbers into it.
        </p>
      </Card>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={`${editing?.name}'s deal`}>
        {editing && (
          <DealEditor
            initial={editing.deal}
            onSave={(d) => {
              updateDeal(editing.id, d);
              setEditing(null);
            }}
          />
        )}
      </Sheet>

      <Sheet open={addingBarber} onClose={() => setAddingBarber(false)} title="Add barber">
        <AddBarber
          onSave={(b, username, pin) => {
            addBarber(b, username, pin);
            setAddingBarber(false);
          }}
        />
      </Sheet>

      <Sheet open={addingShop} onClose={() => setAddingShop(false)} title="Add shop">
        <AddShop
          onSave={(s) => {
            addShop(s);
            setAddingShop(false);
          }}
        />
      </Sheet>
    </div>
  );
}

function DealTile({ label, rule }: { label: string; rule: DealRule }) {
  const ex = settle(20, rule);
  return (
    <div className="rounded-xl bg-canvas p-3">
      <div className="text-[11px] uppercase tracking-wider text-ink-3">{label}</div>
      <div className="mt-0.5 font-medium text-ink">{describeRule(rule)}</div>
      <div className="mt-1 text-xs text-ink-3">
        On a €20 cut: shop {eur(ex.shop)} · barber {eur(ex.barber)}
      </div>
    </div>
  );
}

function RuleEditor({ label, rule, onChange }: { label: string; rule: DealRule; onChange: (r: DealRule) => void }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-2 text-sm font-medium text-ink">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange({ kind: "flat", shopTakes: rule.kind === "flat" ? rule.shopTakes : 5 })}
          className={cx(
            "rounded-lg border px-3 py-2 text-sm",
            rule.kind === "flat" ? "border-ink bg-ink text-canvas" : "border-line-2",
          )}
        >
          Flat fee to shop
        </button>
        <button
          type="button"
          onClick={() => onChange({ kind: "percent", shopPct: rule.kind === "percent" ? rule.shopPct : 50 })}
          className={cx(
            "rounded-lg border px-3 py-2 text-sm",
            rule.kind === "percent" ? "border-ink bg-ink text-canvas" : "border-line-2",
          )}
        >
          Percentage split
        </button>
      </div>
      <div className="mt-2">
        {rule.kind === "flat" ? (
          <Field label="Shop takes per cut (€)">
            <Input
              type="number"
              min={0}
              value={rule.shopTakes}
              onChange={(e) => onChange({ kind: "flat", shopTakes: Number(e.target.value) || 0 })}
            />
          </Field>
        ) : (
          <Field label={`Shop ${rule.shopPct}% · Barber ${100 - rule.shopPct}%`}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={rule.shopPct}
              onChange={(e) => onChange({ kind: "percent", shopPct: Number(e.target.value) })}
              className="w-full accent-ink"
            />
          </Field>
        )}
      </div>
    </div>
  );
}

function DealEditor({ initial, onSave }: { initial: Deal; onSave: (d: Deal) => void }) {
  const [deal, setDeal] = useState<Deal>(initial);
  return (
    <div className="space-y-3">
      <RuleEditor label="Clients the barber brings" rule={deal.ownClients} onChange={(r) => setDeal({ ...deal, ownClients: r })} />
      <RuleEditor label="Walk-ins / shop clients" rule={deal.walkIns} onChange={(r) => setDeal({ ...deal, walkIns: r })} />
      <p className="text-xs text-ink-3">
        Changes apply to new payments only. Past payments keep the split they were recorded with.
      </p>
      <Button size="lg" className="w-full" onClick={() => onSave(deal)}>
        Save deal
      </Button>
    </div>
  );
}

function AddBarber({ onSave }: { onSave: (b: Omit<Barber, "id">, username: string, pin: string) => void }) {
  const { db } = useChairbook();
  const [name, setName] = useState("");
  const [shopId, setShopId] = useState(db.shops[0]?.id ?? "");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("1111");
  const [deal, setDeal] = useState<Deal>({
    ownClients: { kind: "flat", shopTakes: 5 },
    walkIns: { kind: "percent", shopPct: 50 },
  });
  const ok = name.trim().length > 1 && username.trim().length > 1 && pin.length >= 4;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Shop">
          <Select value={shopId} onChange={(e) => setShopId(e.target.value)}>
            {db.shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} />
        </Field>
        <Field label="PIN">
          <Input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" />
        </Field>
      </div>
      <RuleEditor label="Own clients" rule={deal.ownClients} onChange={(r) => setDeal({ ...deal, ownClients: r })} />
      <RuleEditor label="Walk-ins" rule={deal.walkIns} onChange={(r) => setDeal({ ...deal, walkIns: r })} />
      <Button
        size="lg"
        className="w-full"
        disabled={!ok}
        onClick={() =>
          onSave(
            { name: name.trim(), shopId, deal, active: true, color: COLORS[db.barbers.length % COLORS.length] },
            username.trim(),
            pin,
          )
        }
      >
        Add barber
      </Button>
    </div>
  );
}

function AddShop({ onSave }: { onSave: (s: { name: string; area: string; terminalId: string; openHour: number; closeHour: number; closedDays: number[] }) => void }) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [terminalId, setTerminalId] = useState("JCC-");
  return (
    <div className="space-y-3">
      <Field label="Shop name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Area / street">
        <Input value={area} onChange={(e) => setArea(e.target.value)} />
      </Field>
      <Field label="JCC terminal ID" hint="Printed on the card machine receipt header.">
        <Input value={terminalId} onChange={(e) => setTerminalId(e.target.value)} />
      </Field>
      <Button
        size="lg"
        className="w-full"
        disabled={name.trim().length < 2}
        onClick={() =>
          onSave({ name: name.trim(), area: area.trim(), terminalId: terminalId.trim(), openHour: 9, closeHour: 19, closedDays: [0] })
        }
      >
        Add shop
      </Button>
    </div>
  );
}
