"use client";

import { useMemo, useState } from "react";
import { useShopFilter } from "@/components/chairbook/Shell";
import { Badge, Button, Card, Field, Input, PageTitle, Select, Sheet, Segmented } from "@/components/chairbook/ui";
import { eur, fmtDay } from "@/lib/chairbook/format";
import { useChairbook } from "@/lib/chairbook/store";

type Filter = "all" | "mine" | "shop";

export default function ClientsPage() {
  const { db, role, me, addClient, assignClient } = useChairbook();
  const { shopId } = useShopFilter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>(me ? "mine" : "all");
  const [barberFilter, setBarberFilter] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [owner, setOwner] = useState<string>(me?.id ?? "");
  const [newShop, setNewShop] = useState(me?.shopId ?? shopId ?? db.shops[0]?.id ?? "");

  const stats = useMemo(() => {
    const m = new Map<string, { visits: number; gross: number; last: string }>();
    for (const s of db.sales) {
      if (!s.clientId) continue;
      const cur = m.get(s.clientId) ?? { visits: 0, gross: 0, last: "" };
      cur.visits++;
      cur.gross += s.amount;
      if (s.at > cur.last) cur.last = s.at;
      m.set(s.clientId, cur);
    }
    return m;
  }, [db.sales]);

  const list = db.clients
    .filter((c) => !shopId || c.shopId === shopId || c.ownerBarberId === me?.id)
    .filter((c) => {
      if (filter === "mine") return c.ownerBarberId === me?.id;
      if (filter === "shop") return c.ownerBarberId === null;
      return true;
    })
    .filter((c) => !barberFilter || c.ownerBarberId === barberFilter)
    .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q))
    .sort((a, b) => (stats.get(b.id)?.last ?? "").localeCompare(stats.get(a.id)?.last ?? ""));

  const unknownWalkIns = db.sales.filter((s) => !s.clientId && (!shopId || s.shopId === shopId)).length;

  return (
    <div className="space-y-5">
      <PageTitle
        title="Clients"
        sub={`${list.length} shown · ${unknownWalkIns} unregistered walk-in visits on record`}
        action={<Button onClick={() => setAdding(true)}>+ New client</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        {me ? (
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "mine", label: "My clients" },
              { value: "shop", label: "Shop clients" },
              { value: "all", label: "All" },
            ]}
          />
        ) : (
          <Select value={barberFilter} onChange={(e) => setBarberFilter(e.target.value)} className="max-w-[12rem]">
            <option value="">Every barber</option>
            {db.barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}&apos;s clients
              </option>
            ))}
          </Select>
        )}
      </div>

      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-2 py-2 font-medium">Belongs to</th>
                <th className="px-2 py-2 text-right font-medium">Visits</th>
                <th className="px-2 py-2 text-right font-medium">Lifetime</th>
                <th className="px-2 py-2 font-medium">Last visit</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const s = stats.get(c.id);
                const ownerB = c.ownerBarberId ? db.barbers.find((b) => b.id === c.ownerBarberId) : null;
                return (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.phone}</div>
                    </td>
                    <td className="px-2 py-2.5">
                      {ownerB ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: ownerB.color }} />
                          {ownerB.name}
                        </span>
                      ) : (
                        <Badge>shop · walk-in deal</Badge>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{s?.visits ?? 0}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{eur(s?.gross ?? 0)}</td>
                    <td className="px-2 py-2.5 text-slate-500">{s?.last ? fmtDay(s.last) : "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      {me && c.ownerBarberId !== me.id && (
                        <Button size="sm" variant="secondary" onClick={() => assignClient(c.id, me.id)}>
                          Make mine
                        </Button>
                      )}
                      {role === "owner" && (
                        <Select
                          value={c.ownerBarberId ?? ""}
                          onChange={(e) => assignClient(c.id, e.target.value || null)}
                          className="h-8 w-36 text-xs"
                        >
                          <option value="">Shop client</option>
                          {db.barbers.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </Select>
                      )}
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    No clients match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Sheet open={adding} onClose={() => setAdding(false)} title="New client">
        <div className="space-y-3">
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </Field>
          {role === "owner" && db.shops.length > 1 && (
            <Field label="Shop">
              <Select value={newShop} onChange={(e) => setNewShop(e.target.value)}>
                {db.shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Belongs to" hint="Decides which deal applies when they pay.">
            <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Shop client (walk-in deal)</option>
              {db.barbers
                .filter((b) => (me ? b.id === me.id : true))
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}&apos;s client (own deal)
                  </option>
                ))}
            </Select>
          </Field>
          <Button
            className="w-full"
            size="lg"
            disabled={name.trim().length < 2}
            onClick={() => {
              addClient({ name: name.trim(), phone: phone.trim(), shopId: newShop, ownerBarberId: owner || null });
              setName("");
              setPhone("");
              setAdding(false);
            }}
          >
            Save client
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
