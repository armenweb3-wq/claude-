import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AppFrame from "@/components/crm/AppFrame";
import "../globals.css";

const sans = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vantage CRM — Trading Desk",
  description:
    "A focused calling CRM for trading desks. Work your book one client at a time with Save & Next.",
};

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased [color-scheme:dark]">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
