"use client";

import { useMemo, useState } from "react";
import { ClientDetail, STATUS_LABEL, StatusBadge } from "@/components/chairbook/ClientDetail";
import { useShopFilter } from "@/components/chairbook/Shell";
import { Badge, Button, Card, Field, Input, PageTitle, Select, Sheet, cx } from "@/components/chairbook/ui";
import { eur, fmtDay } from "@/lib/chairbook/format";
import { clientInsights, type ClientInsight, type ClientStatus } from "@/lib/chairbook/selectors";
import { useChairbook } from "@/lib/chairbook/store";

type Scope = "mine" | "served" | "shop";
type StatusFilter = "all" | ClientStatus;

export default function ClientsPage() {
  const { db, role, me, addClient, assignClient } = useChairbook();
  const { shopId } = useShopFilter();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>(me ? "mine" : "shop");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [barberFilter, setBarberFilter] = useState<string>("");
  const [detail, setDetail] = useState<ClientInsight | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [owner, setOwner] = useState<string>(me?.id ?? "");
  const [newShop, setNewShop] = useState(me?.shopId ?? shopId ?? db.shops[0]?.id ?? "");

  const insights = useMemo(() => {
    if (me) {
      // A barber sees exactly two groups: their own list, and shop clients
      // they have personally served. Never another barber's clients.
      if (scope === "mine") return clientInsights(db, { barberId: me.id });
      return clientInsights(db, { barberId: me.id, servedByBarber: true }).filter((i) => i.client.ownerBarberId !== me.id);
    }
    return clientInsights(db, { shopId });
  }, [db, me, scope, shopId]);

  const list = insights
    .filter((i) => status === "all" || i.status === status)
    .filter((i) => !barberFilter || i.client.ownerBarberId === barberFilter || (barberFilter === "shop" && !i.client.ownerBarberId))
    .filter((i) => !q || i.client.name.toLowerCase().includes(q.toLowerCase()) || i.client.phone.includes(q))
    .sort((a, b) => {
      const order: ClientStatus[] = ["slipping", "lost", "regular", "new", "occasional"];
      if (status === "all" && a.status !== b.status) return order.indexOf(a.status) - order.indexOf(b.status);
      return b.lastVisit.localeCompare(a.lastVisit);
    });

  const counts = (["regular", "new", "occasional", "slipping", "lost"] as ClientStatus[]).map((s) => ({
    s,
    n: insights.filter((i) => i.status === s).length,
  }));
  const unknownWalkIns = db.sales.filter((s) => !s.clientId && (me ? s.barberId === me.id : !shopId || s.shopId === shopId)).length;

  return (
    <div className="space-y-5">
      <PageTitle
        title={me ? "Your clients" : "Clients"}
        sub={`${insights.length} people · ${unknownWalkIns} unregistered walk-in visits`}
        action={<Button onClick={() => setAdding(true)}>+ New client</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        {me ? (
          <div className="inline-flex rounded-xl bg-surface-2 p-1">
            {(
              [
                ["mine", "My clients"],
                ["served", "Walk-ins I've served"],
              ] as [Scope, string][]
            ).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setScope(v)}
                className={cx("rounded-lg px-3 py-1.5 text-xs font-medium sm:text-sm", scope === v ? "bg-surface text-ink shadow-sm" : "text-ink-3")}
              >
                {l}
              </button>
            ))}
          </div>
        ) : (
          <Select value={barberFilter} onChange={(e) => setBarberFilter(e.target.value)} className="max-w-[12rem]">
            <option value="">Everyone</option>
            <option value="shop">Shop clients only</option>
            {db.barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}&apos;s clients
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={status === "all"} onClick={() => setStatus("all")}>
          All · {insights.length}
        </FilterChip>
        {counts.map(({ s, n }) => (
          <FilterChip key={s} active={status === s} onClick={() => setStatus(s)} tone={s}>
            {STATUS_LABEL[s]} · {n}
          </FilterChip>
        ))}
      </div>

      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-2 py-2 font-medium">Status</th>
                {!me && <th className="px-2 py-2 font-medium">Belongs to</th>}
                <th className="px-2 py-2 text-right font-medium">Visits</th>
                <th className="px-2 py-2 text-right font-medium">Every</th>
                <th className="px-2 py-2 text-right font-medium">Spent</th>
                <th className="px-2 py-2 font-medium">Last visit</th>
                <th className="px-2 py-2 text-right font-medium">No-shows</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const c = i.client;
                const ownerB = c.ownerBarberId ? db.barbers.find((b) => b.id === c.ownerBarberId) : null;
                return (
                  <tr key={c.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2" onClick={() => setDetail(i)}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-ink">{c.name}</div>
                      <div className="text-xs text-ink-3">{c.phone}</div>
                    </td>
                    <td className="px-2 py-2.5">
                      <StatusBadge status={i.status} />
                      {i.hasUpcoming && <Badge tone="info">booked</Badge>}
                    </td>
                    {!me && (
                      <td className="px-2 py-2.5">
                        {ownerB ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: ownerB.color }} />
                            {ownerB.name}
                          </span>
                        ) : (
                          <Badge>shop</Badge>
                        )}
                      </td>
                    )}
                    <td className="px-2 py-2.5 text-right tabular-nums">{i.visits}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-ink-3">{i.gapDays ? `${i.gapDays}d` : "—"}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{eur(i.spend)}</td>
                    <td className="px-2 py-2.5 text-ink-3">
                      {i.visits ? (
                        <>
                          {fmtDay(i.lastVisit)}{" "}
                          <span className={cx("text-xs", i.status === "slipping" && "text-warn", i.status === "lost" && "text-bad")}>
                            ({i.daysSince}d)
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={cx("px-2 py-2.5 text-right tabular-nums", i.noShows > 0 && "text-bad")}>{i.noShows || ""}</td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {me && c.ownerBarberId !== me.id && (
                        <Button size="sm" variant="secondary" onClick={() => assignClient(c.id, me.id)}>
                          Make mine
                        </Button>
                      )}
                      {role === "owner" && (
                        <Select
                          value={c.ownerBarberId ?? ""}
                          onChange={(e) => assignClient(c.id, e.target.value || null)}
                          className="h-8 w-32 text-xs"
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
                  <td colSpan={9} className="px-4 py-6 text-center text-ink-3">
                    No clients match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ClientDetail insight={detail} onClose={() => setDetail(null)} />

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

function FilterChip({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone?: ClientStatus;
  children: React.ReactNode;
}) {
  const dot = tone === "regular" ? "bg-good" : tone === "slipping" ? "bg-warn" : tone === "lost" ? "bg-bad" : tone === "new" ? "bg-info" : "bg-ink-3";
  return (
    <button
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        active ? "border-ink bg-ink text-canvas" : "border-line-2 bg-surface text-ink-2 hover:border-ink",
      )}
    >
      {tone && <span className={cx("h-2 w-2 rounded-full", active ? "bg-canvas" : dot)} />}
      {children}
    </button>
  );
}
