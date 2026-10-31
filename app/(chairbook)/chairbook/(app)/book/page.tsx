"use client";

import { useState } from "react";
import { BookingForm } from "@/components/chairbook/BookingForm";
import { Card, PageTitle } from "@/components/chairbook/ui";
import { useChairbook } from "@/lib/chairbook/store";
import { UpcomingList } from "@/components/chairbook/UpcomingList";

export default function BookPage() {
  const { meClient, db } = useChairbook();
  const [done, setDone] = useState(false);
  const barber = meClient?.ownerBarberId ? db.barbers.find((b) => b.id === meClient.ownerBarberId) : null;
  return (
    <div className="space-y-5">
      <PageTitle
        title={`Hi ${meClient?.name.split(" ")[0] ?? "there"}`}
        sub={barber ? `Your barber is ${barber.name} at ${db.shops.find((s) => s.id === barber.shopId)?.name}.` : "Pick a shop, a barber and a time."}
      />
      {done && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Booked. We&apos;ll see you then — it&apos;s in your visits below.
        </div>
      )}
      <Card title="Book an appointment">
        <BookingForm key={String(done)} onDone={() => setDone(true)} />
      </Card>
      <UpcomingList />
    </div>
  );
}
