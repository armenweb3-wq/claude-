"use client";

import { Badge, Card, Empty, PageTitle, Row } from "@/components/chairbook/ui";
import { eur, fmtDay, fmtTime } from "@/lib/chairbook/format";
import { useChairbook } from "@/lib/chairbook/store";

import { UpcomingList } from "@/components/chairbook/UpcomingList";

export default function VisitsPage() {
  const { db, meClient } = useChairbook();
  if (!meClient) return <p className="text-sm text-ink-3">Sign in as a client to see your visits.</p>;
  const past = db.sales
    .filter((s) => s.clientId === meClient.id)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 20);
  const spent = past.reduce((a, s) => a + s.amount, 0);
  return (
    <div className="space-y-5">
      <PageTitle title="My visits" sub={`${past.length} visits · ${eur(spent)} spent`} />
      <UpcomingList />
      <Card title="History">
        {past.length === 0 ? (
          <Empty>No visits yet.</Empty>
        ) : (
          past.map((s) => (
            <Row
              key={s.id}
              dot={db.barbers.find((b) => b.id === s.barberId)?.color}
              left={`${fmtDay(s.at)} · ${db.services.find((x) => x.id === s.serviceId)?.name}`}
              sub={`${db.barbers.find((b) => b.id === s.barberId)?.name} · ${db.shops.find((x) => x.id === s.shopId)?.name}`}
              right={
                <>
                  {eur(s.amount)} <Badge tone={s.method === "cash" ? "warn" : "info"}>{s.method}</Badge>
                </>
              }
            />
          ))
        )}
      </Card>
    </div>
  );
}
