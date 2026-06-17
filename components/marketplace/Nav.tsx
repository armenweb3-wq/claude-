import Link from "next/link";
import { site } from "@/data/site";
import type { Role } from "@/lib/types";
import { logoutAction } from "@/app/(marketplace)/auth/actions";

export default function MarketplaceNav({
  signedIn,
  role,
  name,
}: {
  signedIn: boolean;
  role: Role | null;
  name: string | null;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">
            {site.name.charAt(0)}
          </span>
          <span className="tracking-tight">{site.name}</span>
        </Link>

        <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <Link href="/startups" className="hover:text-slate-900">
            Startups
          </Link>
          <Link href="/investors" className="hover:text-slate-900">
            Investors
          </Link>
          <Link href="/guide" className="hover:text-slate-900">
            How it works
          </Link>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {signedIn ? (
            <>
              {role === "admin" && (
                <Link
                  href="/admin"
                  className="hidden rounded-md px-3 py-1.5 font-medium text-amber-700 hover:bg-amber-50 sm:block"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
              >
                {name ? name.split(" ")[0] : "Dashboard"}
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-md px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-indigo-600 px-4 py-1.5 font-medium text-white hover:bg-indigo-700"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
