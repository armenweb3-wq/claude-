import type { Metadata } from "next";
import { shop } from "@/data/barber";
import { computeDashboard } from "@/data/barber-analytics";
import AdminShell from "@/components/barber/dashboard/AdminShell";

export const metadata: Metadata = {
  title: `${shop.name} — Owner Panel`,
  description: "Bookings, revenue and client tracker for the shop.",
  robots: { index: false },
};

export default function DashboardPage() {
  const d = computeDashboard();
  const asOf = d.now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return <AdminShell d={d} asOf={asOf} />;
}
