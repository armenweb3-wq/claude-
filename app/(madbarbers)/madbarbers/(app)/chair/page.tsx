"use client";

import { useState } from "react";
import { DailyBars, SERIES, ShareBar, StackedBars, Legend } from "@/components/chairbook/charts";
import { ClientDetail, StatusBadge } from "@/components/chairbook/ClientDetail";
import { ClientListSheet } from "@/components/chairbook/ClientList";
import { ExpensesPanel } from "@/components/chairbook/ExpensesPanel";
import { Badge, Card, Empty, Money, PageTitle, Row, Segmented, Stat } from "@/components/chairbook/ui";
import { describeRule } from "@/lib/chairbook/deals";
import { eur, fmtDay, fmtTime, WEEKDAYS, addDays, startOfDay } from "@/lib/chairbook/format";
import {
  clientInsights,
  expensesIn,
  noShowsIn,
  periodRange,
  salesIn,
  settlement,
  sumExpenses,
  weeklySeries,
  weekdayProfile,
  type ClientInsight,
  type Period,
} from "@/lib/chairbook/selectors";
import { useChairbook } from "@/lib/chairbook/store";

export default function ChairPage() {
  const { db, me } = useChairbook();
  const [period, setPeriod] = useState<Period>("month");
  const [detail, setDetail] = useState<ClientInsight | null>(null);
  const [list, setList] = useState<{ title: string; sub?: string; items: ClientInsight[] } | null>(null);
  if (!me) return <p className="text-sm text-ink-3">Sign in as a barber to see your chair.</p>;

  const { from, to } = periodRange(period);
  const sales = salesIn(db.sales, { from, to, barberId: me.id });
  const st = settlement(sales);
  const expenses = expensesIn(db.expenses, { from, to, barberId: me.id });
  const spent = sumExpenses(expenses);
  const net = Math.round((st.barber + st.tips - spent) * 100) / 100;
  const own = sales.filter((s) => s.clientType === "own");
  const walk = sales.filter((s) => s.clientType === "walkin");
  const sum = (xs: typeof sales, k: "amount" | "barberShare") => xs.reduce((a, s) => a + s[k], 0);

  // Clients: everyone this barber has served, plus own clients not yet seen.
  const insights = clientInsights(db, { barberId: me.id, servedByBarber: true });
  const mine = insights.filter((i) => i.client.ownerBarberId === me.id);
  const newClients = db.clients.filter((c) => c.ownerBarberId === me.id && c.createdAt >= from.toISOString() && c.createdAt < to.toISOString());
  const periodClientIds = new Set(sales.map((s) => s.clientId).filter(Boolean));
  const unknownWalkIns = walk.filter((s) => !s.clientId).length;
  const slipping = insights.filter((i) => i.status === "slipping").sort((a, b) => b.visits - a.visits);
  const lost = insights.filter((i) => i.status === "lost").sort((a, b) => b.spend - a.spend);
  const regulars = mine.filter((i) => i.status === "regular");
  const top = [...insights].sort((a, b) => b.spend - a.spend).slice(0, 6);
  const noShows = noShowsIn(db, { from, to, barberId: me.id });
  const noShowByClient = new Map<string, number>();
  for (const a of noShows) if (a.clientId) noShowByClient.set(a.clientId, (noShowByClient.get(a.clientId) ?? 0) + 1);
  const rebooked = mine.filter((i) => i.hasUpcoming);
  const served = insights.filter((i) => periodClientIds.has(i.client.id));
  const walkInsServed = insights.filter((i) => i.client.ownerBarberId !== me.id);
  const activeList = insights.filter((i) => i.daysSince <= 30 && i.visits > 0);
  const noShowClients = insights.filter((i) => noShowByClient.has(i.client.id));

  const weeks = weeklySeries(salesIn(db.sales, { barberId: me.id }), 8);
  const profile = weekdayProfile(db.sales.filter((s) => s.barberId === me.id)).filter((r) => r.days > 0);
  const bestDay = [...profile].sort((a, b) => b.avgGross - a.avgGross)[0];
  const last30 = salesIn(db.sales, { from: addDays(startOfDay(new Date()), -30), barberId: me.id });
  const returning = new Set(last30.filter((s) => s.clientId).map((s) => s.clientId)).size;

  return (
    <div className="space-y-5">
      <PageTitle
        title="My chair"
        sub={`${me.name} · ${db.shops.find((s) => s.id === me.shopId)?.name} · ${describeRule(me.deal.ownClients)} on your clients, ${describeRule(me.deal.walkIns)} on walk-ins`}
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
        <Stat label="Income (your share)" value={st.barber + st.tips} tone="info" sub={`${st.count} cuts · ${eur(st.tips)} tips · charged ${eur(st.gross)}`} />
        <Stat label="Your expenses" value={spent} tone={spent ? "bad" : "neutral"} sub={`${expenses.length} items`} />
        <Stat label="Net in your pocket" value={net} tone={net >= 0 ? "good" : "bad"} sub="income minus expenses" />
        <Stat
          label="Settle with shop"
          value={Math.abs(st.net)}
          sub={st.net > 0 ? "shop pays you" : st.net < 0 ? "you hand over cash" : "all square"}
        />
      </div>

      <p className="-mb-2 text-[11px] text-ink-3">Tap a number to see the names behind it.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tap onClick={() => setList({ title: `Clients served (${period})`, sub: `${unknownWalkIns} more were walk-ins you didn't register — add them from the Done screen next time.`, items: served })}>
          <Stat label="Clients served" value={`${periodClientIds.size}`} money={false} sub={`+ ${unknownWalkIns} unregistered walk-ins ›`} />
        </Tap>
        <Tap onClick={() => setList({ title: "Your client list", sub: "People on your own deal.", items: [...mine].sort((a, b) => b.lastVisit.localeCompare(a.lastVisit)) })}>
          <Stat label="Your client list" value={`${mine.length}`} money={false} sub={`${regulars.length} regulars · ${newClients.length} new ›`} />
        </Tap>
        <Tap onClick={() => setList({ title: "Active in the last 30 days", items: activeList.sort((a, b) => b.lastVisit.localeCompare(a.lastVisit)) })}>
          <Stat label="Active last 30 days" value={`${returning}`} money={false} sub={`${rebooked.length} have a booking coming ›`} />
        </Tap>
        <Tap onClick={() => setList({ title: `No-shows (${period})`, items: noShowClients.sort((a, b) => b.noShows - a.noShows) })}>
          <Stat label="No-shows" value={`${noShows.length}`} money={false} tone={noShows.length ? "warn" : "neutral"} sub={`${slipping.length} slipping · ${lost.length} lost ›`} />
        </Tap>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip onClick={() => setList({ title: "Walk-ins & shop clients you've served", sub: "Not on your list. Tap one to make them your client.", items: walkInsServed.sort((a, b) => b.visits - a.visits) })}>
          Walk-ins I&apos;ve served · {walkInsServed.length}
        </Chip>
        <Chip onClick={() => setList({ title: "Your regulars", sub: "3+ visits, usually within 3 weeks.", items: regulars })}>Regulars · {regulars.length}</Chip>
        <Chip onClick={() => setList({ title: "Booked in", sub: "Your clients with an upcoming appointment.", items: rebooked })}>Booked in · {rebooked.length}</Chip>
        <Chip onClick={() => setList({ title: "Slipping away", items: slipping })}>Slipping · {slipping.length}</Chip>
        <Chip onClick={() => setList({ title: "Lost", items: lost })}>Lost · {lost.length}</Chip>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Weekly income (your share, 8 weeks)" className="lg:col-span-2">
          <DailyBars
            points={weeks.map((w) => ({ label: fmtDay(w.start).slice(4), value: w.gross, sub: w.barber }))}
          />
          <div className="mt-1 flex gap-4 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.muted }} /> Charged
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.single }} /> Your share
            </span>
          </div>
        </Card>
        <Card title="Where your money comes from">
          <ShareBar
            parts={[
              { label: "Your clients", value: sum(own, "barberShare"), color: SERIES.booked },
              { label: "Walk-ins", value: sum(walk, "barberShare"), color: SERIES.walkIn },
            ]}
          />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-3">
            <div>
              {own.length} cuts · {eur(sum(own, "amount"))} charged
              <div className="text-ink">avg {own.length ? eur(sum(own, "barberShare") / own.length) : "—"} kept / cut</div>
            </div>
            <div>
              {walk.length} cuts · {eur(sum(walk, "amount"))} charged
              <div className="text-ink">avg {walk.length ? eur(sum(walk, "barberShare") / walk.length) : "—"} kept / cut</div>
            </div>
          </div>
          <div className="mt-4">
            <ShareBar
              parts={[
                { label: "Cash", value: st.cash, color: SERIES.walkIn },
                { label: "Card", value: st.card, color: SERIES.booked },
              ]}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title={
            <span className="inline-flex items-center gap-2">
              Slipping away <Badge tone="warn">{slipping.length}</Badge>
            </span>
          }
        >
          <p className="mb-2 text-xs text-ink-3">
            Regulars overdue by more than 1.5× their usual gap (at least two weeks) with no booking. Message them before they&apos;re gone.
          </p>
          {slipping.length === 0 ? (
            <Empty>Nobody is overdue. Nice.</Empty>
          ) : (
            slipping.slice(0, 8).map((i) => <InsightRow key={i.client.id} i={i} onClick={() => setDetail(i)} />)
          )}
        </Card>
        <Card
          title={
            <span className="inline-flex items-center gap-2">
              Lost clients <Badge tone="bad">{lost.length}</Badge>
            </span>
          }
        >
          <p className="mb-2 text-xs text-ink-3">
            More than 2.5× their usual gap (at least four weeks), or over 60 days with no visit. Sorted by how much they used to spend.
          </p>
          {lost.length === 0 ? (
            <Empty>No lost clients in your list.</Empty>
          ) : (
            lost.slice(0, 8).map((i) => <InsightRow key={i.client.id} i={i} onClick={() => setDetail(i)} />)
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Top clients (all time)">
          {top.map((i) => (
            <button key={i.client.id} className="block w-full text-left" onClick={() => setDetail(i)}>
              <Row
                left={
                  <>
                    {i.client.name} <StatusBadge status={i.status} />
                  </>
                }
                sub={`${i.visits} visits · every ${i.gapDays ?? "?"} days · last ${fmtDay(i.lastVisit)}${i.client.ownerBarberId === me.id ? "" : " · shop client"}`}
                right={
                  <>
                    <Money value={i.spend} className="font-medium" />
                    <div className="text-xs text-ink-3">{eur(i.spend / i.visits)} / visit</div>
                  </>
                }
              />
            </button>
          ))}
          {top.length === 0 && <Empty>No named clients yet.</Empty>}
        </Card>
        <Card title={`No-shows (${period})`}>
          {noShows.length === 0 ? (
            <Empty>No missed appointments.</Empty>
          ) : (
            [...noShows].reverse().map((a) => {
              const i = insights.find((x) => x.client.id === a.clientId);
              return (
                <button key={a.id} className="block w-full text-left" onClick={() => i && setDetail(i)}>
                  <Row
                    left={
                      <>
                        {i?.client.name ?? a.clientName ?? "Unknown"}{" "}
                        {(noShowByClient.get(a.clientId ?? "") ?? 0) > 1 && (
                          <Badge tone="bad">{noShowByClient.get(a.clientId ?? "")}× this period</Badge>
                        )}
                      </>
                    }
                    sub={`${fmtDay(a.startsAt)} ${fmtTime(a.startsAt)} · ${db.services.find((s) => s.id === a.serviceId)?.name}`}
                    right={<span className="text-xs text-ink-3">lost {eur(db.services.find((s) => s.id === a.serviceId)?.price ?? 0)}</span>}
                  />
                </button>
              );
            })
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Your week pattern (avg per day, 8 weeks)"
          action={<Legend items={[{ label: "Booked", color: SERIES.booked }, { label: "Walk-ins", color: SERIES.walkIn }]} />}
        >
          <StackedBars
            rows={profile.map((r) => ({
              label: WEEKDAYS[r.dow],
              parts: [
                { key: "Booked", value: r.avgBooked, color: SERIES.booked },
                { key: "Walk-ins", value: r.avgWalkIns, color: SERIES.walkIn },
              ],
              note: `avg ${eur(r.avgGross)} charged`,
            }))}
            format={(v) => String(Math.round(v * 10) / 10)}
          />
          {bestDay && (
            <p className="mt-2 text-xs text-ink-3">
              Your best day is <strong className="text-ink">{WEEKDAYS[bestDay.dow]}</strong> at {eur(bestDay.avgGross)} charged on
              average.
            </p>
          )}
        </Card>
        <ExpensesPanel expenses={expenses} scope={{ shopId: me.shopId, barberId: me.id }} title={`Your expenses (${period})`} />
      </div>

      <Card title={`Every cut (${period})`}>
        {sales.length === 0 ? (
          <Empty>No payments in this period.</Empty>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {[...sales].reverse().map((s) => (
              <Row
                key={s.id}
                left={
                  <>
                    {s.clientId ? db.clients.find((c) => c.id === s.clientId)?.name : "Walk-in"}
                    <span className="ml-2 text-xs text-ink-3">{db.services.find((x) => x.id === s.serviceId)?.name}</span>
                  </>
                }
                sub={`${period === "today" ? fmtTime(s.at) : `${fmtDay(s.at)} ${fmtTime(s.at)}`} · ${s.method} · ${s.clientType === "own" ? "your client" : "walk-in deal"}`}
                right={
                  <>
                    <Money value={s.barberShare} className="font-medium text-info" />
                    <div className="text-xs text-ink-3">of {eur(s.amount)}</div>
                  </>
                }
              />
            ))}
          </div>
        )}
      </Card>

      {list && !detail && (
        <ClientListSheet
          title={list.title}
          sub={list.sub}
          items={list.items}
          onClose={() => setList(null)}
          onPick={(i) => setDetail(i)}
        />
      )}
      <ClientDetail insight={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function Tap({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full text-left [&>div]:transition-colors [&>div]:hover:border-ink">
      {children}
    </button>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-line-2 bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 hover:border-ink hover:text-ink"
    >
      {children}
    </button>
  );
}

function InsightRow({ i, onClick }: { i: ClientInsight; onClick: () => void }) {
  return (
    <button className="block w-full text-left" onClick={onClick}>
      <Row
        left={i.client.name}
        sub={`${i.visits} visits · usually every ${i.gapDays ?? "?"} days · last ${fmtDay(i.lastVisit)}`}
        right={
          <>
            <span className={i.status === "lost" ? "text-bad" : "text-warn"}>{i.daysSince} days ago</span>
            <div className="text-xs text-ink-3">{eur(i.spend)} lifetime</div>
          </>
        }
      />
    </button>
  );
}
