import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { site } from "@/data/site";
import { getCurrentUser } from "@/lib/auth";
import MarketplaceNav from "@/components/marketplace/Nav";
import MarketplaceFooter from "@/components/marketplace/Footer";
import "../globals.css";

const sans = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${site.name} — ${site.tagline}`,
  description: site.description,
};

export default async function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUser();

  return (
    <html lang="en" className={sans.variable}>
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
        <MarketplaceNav
          signedIn={Boolean(user)}
          role={profile?.role ?? null}
          name={profile?.full_name ?? null}
        />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        <MarketplaceFooter />
      </body>
    </html>
  );
}
