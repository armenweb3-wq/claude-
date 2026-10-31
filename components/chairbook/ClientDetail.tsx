"use client";

import { eur, fmtDay, fmtTime } from "@/lib/chairbook/format";
import type { ClientInsight, ClientStatus } from "@/lib/chairbook/selectors";
import { useChairbook } from "@/lib/chairbook/store";
import { Badge, Button, Row, Sheet } from "./ui";

export const STATUS_LABEL: Record<ClientStatus, string> = {
  new: "New",
  regular: "Regular",
  occasional: "Occasional",
  slipping: "Slipping away",
  lost: "Lost",
};

export function StatusBadge({ status }: { status: ClientStatus }) {
  const tone = status === "regular" ? "good" : status === "slipping" ? "warn" : status === "lost" ? "bad" : status === "new" ? "info" : "neutral";
  return <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>;
}

export function ClientDetail({ insight, onClose }: { insight: ClientInsight | null; onClose: () => void }) {
  const { db, me, assignClient, setAppointmentStatus } = useChairbook();
  if (!insight) return null;
  const c = insight.client;
  const history = db.sales
    .filter((s) => s.clientId === c.id)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);
  const appts = db.appointments
    .filter((a) => a.clientId === c.id && a.status !== "done")
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 6);
  const owner = c.ownerBarberId ? db.barbers.find((b) => b.id === c.ownerBarberId) : null;
  const barbersSeen = Array.from(new Set(db.sales.filter((s) => s.clientId === c.id).map((s) => s.barberId))).map(
    (id) => db.barbers.find((b) => b.id === id)?.name,
  );

  return (
    <Sheet open onClose={onClose} title={c.name}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <StatusBadge status={insight.status} />
          <span className="select-all tabular-nums">{c.phone}</span>
          <span>·</span>
          <span>{owner ? `${owner.name}'s client` : "Shop client"}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Tile label="Visits" value={String(insight.visits)} />
          <Tile label="Spent" value={eur(insight.spend)} />
          <Tile label="Avg ticket" value={insight.visits ? eur(insight.spend / insight.visits) : "—"} />
          <Tile label="Usual gap" value={insight.gapDays ? `${insight.gapDays} days` : "—"} />
          <Tile label="Last visit" value={insight.visits ? `${insight.daysSince}d ago` : "never"} />
          <Tile label="No-shows" value={String(insight.noShows)} tone={insight.noShows ? "bad" : undefined} />
        </div>

        {(insight.status === "slipping" || insight.status === "lost") && (
          <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
            Usually comes every {insight.gapDays ?? "~30"} days, last seen {fmtDay(insight.lastVisit)} ({insight.daysSince} days
            ago). Worth a message.
          </div>
        )}

        {barbersSeen.length > 1 && (
          <p className="text-xs text-ink-3">Has been cut by {barbersSeen.join(", ")}.</p>
        )}

        {me && c.ownerBarberId !== me.id && (
          <Button variant="secondary" className="w-full" onClick={() => assignClient(c.id, me.id)}>
            Make this my client
          </Button>
        )}

        {appts.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-3">Bookings</h3>
            {appts.map((a) => (
              <Row
                key={a.id}
                left={`${fmtDay(a.startsAt)} · ${fmtTime(a.startsAt)}`}
                sub={`${db.services.find((s) => s.id === a.serviceId)?.name} · ${db.barbers.find((b) => b.id === a.barberId)?.name}`}
                right={
                  a.status === "booked" ? (
                    <Button size="sm" variant="ghost" onClick={() => setAppointmentStatus(a.id, "cancelled")}>
                      Cancel
                    </Button>
                  ) : (
                    <Badge tone={a.status === "no-show" ? "bad" : "neutral"}>{a.status}</Badge>
                  )
                }
              />
            ))}
          </div>
        )}

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-3">Visit history</h3>
          {history.length === 0 ? (
            <p className="text-sm text-ink-3">No visits recorded.</p>
          ) : (
            history.map((s) => (
              <Row
                key={s.id}
                dot={db.barbers.find((b) => b.id === s.barberId)?.color}
                left={`${fmtDay(s.at)} · ${db.services.find((x) => x.id === s.serviceId)?.name}`}
                sub={`${db.barbers.find((b) => b.id === s.barberId)?.name} · ${s.method} · ${s.source}`}
                right={eur(s.amount)}
              />
            ))
          )}
        </div>
      </div>
    </Sheet>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="rounded-xl bg-surface-2 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-ink-3">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${tone === "bad" ? "text-bad" : "text-ink"}`}>{value}</div>
    </div>
  );
}
