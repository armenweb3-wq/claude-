"use client";

import { Button, Card, Empty, Row } from "./ui";
import { fmtDay, fmtTime } from "@/lib/chairbook/format";
import { useChairbook } from "@/lib/chairbook/store";

export function UpcomingList() {
  const { db, meClient, setAppointmentStatus } = useChairbook();
  if (!meClient) return null;
  const now = new Date().toISOString();
  const upcoming = db.appointments
    .filter((a) => a.clientId === meClient.id && a.status === "booked" && a.startsAt >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <Card title="Upcoming">
      {upcoming.length === 0 ? (
        <Empty>No upcoming appointments.</Empty>
      ) : (
        upcoming.map((a) => (
          <Row
            key={a.id}
            dot={db.barbers.find((b) => b.id === a.barberId)?.color}
            left={`${fmtDay(a.startsAt)} · ${fmtTime(a.startsAt)}`}
            sub={`${db.services.find((s) => s.id === a.serviceId)?.name} with ${db.barbers.find((b) => b.id === a.barberId)?.name} · ${db.shops.find((s) => s.id === a.shopId)?.name}`}
            right={
              <Button size="sm" variant="ghost" onClick={() => setAppointmentStatus(a.id, "cancelled")}>
                Cancel
              </Button>
            }
          />
        ))
      )}
    </Card>
  );
}

