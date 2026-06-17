import Link from "next/link";
import { site } from "@/data/site";

export default function MarketplaceFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-bold text-slate-900">{site.name}</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">{site.tagline}</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
          <Link href="/startups" className="hover:text-slate-900">
            Browse startups
          </Link>
          <Link href="/investors" className="hover:text-slate-900">
            Browse investors
          </Link>
          <Link href="/guide" className="hover:text-slate-900">
            How it works
          </Link>
          <Link href="/register" className="hover:text-slate-900">
            Sign up
          </Link>
        </div>
      </div>
      <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {site.name}. A matchmaking platform — we
        make introductions, not investments.
      </div>
    </footer>
  );
}
