import type { Metadata, Viewport } from "next";
import { Oswald, Inter } from "next/font/google";
import { shop } from "@/data/barber";
import "../globals.css";

const display = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${shop.name} — ${shop.tagline}`,
  description: shop.blurb,
  metadataBase: new URL("https://hustleblends.cc"),
  openGraph: {
    title: `${shop.name} — Book your chair`,
    description: shop.blurb,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0C",
};

export default function BarberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="bg-coal-deep text-bone font-sans antialiased">
        <a
          href="#book"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-brass focus:px-5 focus:py-2 focus:text-sm focus:font-semibold focus:text-coal-deep"
        >
          Skip to booking
        </a>
        {children}
      </body>
    </html>
  );
}
