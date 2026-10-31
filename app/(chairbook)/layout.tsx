import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ChairbookProvider } from "@/lib/chairbook/store";
import "../globals.css";

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chairbook — barbershop ledger & bookings",
  description:
    "Bookings, cash & card payments, barber deals and shop insights for multi-location barbershops.",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function ChairbookLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <ChairbookProvider>{children}</ChairbookProvider>
      </body>
    </html>
  );
}
