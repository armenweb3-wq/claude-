import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import SmoothScroll from "@/components/SmoothScroll";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mkhitaryan Developers — Luxury Property in Paphos, Cyprus",
  description:
    "Mkhitaryan Developers craft a curated portfolio of luxury residences along the Paphos coastline. A fully turnkey path to Mediterranean living — sourcing, legal, residency, financing, furnishing and management, handled.",
  metadataBase: new URL("https://mkhitaryan-developers.example"),
  openGraph: {
    title: "Mkhitaryan Developers — Luxury Property in Paphos, Cyprus",
    description:
      "A curated portfolio of luxury residences along the Paphos coastline. Turnkey ownership, handled end to end.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <a
          href="#contact"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-gold focus:px-5 focus:py-2 focus:text-sm focus:text-ink"
        >
          Skip to enquiry
        </a>
        <SmoothScroll>
          <Nav />
          <main>{children}</main>
          <Footer />
        </SmoothScroll>
      </body>
    </html>
  );
}
