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
  title: "Mad Barbers — bookings, till Mad Barbers — barbershop ledger & bookings barber deals",
  description:
    "Bookings, cash & card payments, barber deals and shop insights for multi-location barbershops.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f18" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function MadBarbersLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("chairbook.theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
        <ChairbookProvider>{children}</ChairbookProvider>
      </body>
    </html>
  );
}
