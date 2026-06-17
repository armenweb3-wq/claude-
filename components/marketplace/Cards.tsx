import Link from "next/link";
import type { Investor, Startup } from "@/lib/types";

function formatMoney(n: number | null) {
  if (!n) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

export function StartupCard({ startup }: { startup: Startup }) {
  return (
    <Link
      href={`/startups/${startup.id}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-100 font-bold text-indigo-700">
          {startup.name.charAt(0)}
        </span>
        {startup.stage && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {startup.stage}
          </span>
        )}
      </div>
      <h3 className="mt-4 font-semibold text-slate-900 group-hover:text-indigo-700">
        {startup.name}
      </h3>
      {startup.tagline && (
        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{startup.tagline}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {startup.sector && (
          <span className="rounded-md bg-slate-50 px-2 py-1">{startup.sector}</span>
        )}
        {startup.location && <span>· {startup.location}</span>}
        {formatMoney(startup.funding_goal) && (
          <span className="ml-auto font-medium text-emerald-600">
            Raising {formatMoney(startup.funding_goal)}
          </span>
        )}
      </div>
    </Link>
  );
}

export function InvestorCard({ investor }: { investor: Investor }) {
  const range =
    formatMoney(investor.check_min) && formatMoney(investor.check_max)
      ? `${formatMoney(investor.check_min)}–${formatMoney(investor.check_max)}`
      : formatMoney(investor.check_min) ?? formatMoney(investor.check_max);
  return (
    <Link
      href={`/investors/${investor.id}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 font-bold text-emerald-700">
          {investor.name.charAt(0)}
        </span>
        {range && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            {range} checks
          </span>
        )}
      </div>
      <h3 className="mt-4 font-semibold text-slate-900 group-hover:text-emerald-700">
        {investor.name}
      </h3>
      {investor.thesis && (
        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{investor.thesis}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        {(investor.sectors ?? []).slice(0, 3).map((s) => (
          <span key={s} className="rounded-md bg-slate-50 px-2 py-1">
            {s}
          </span>
        ))}
        {investor.location && <span className="ml-auto">{investor.location}</span>}
      </div>
    </Link>
  );
}
