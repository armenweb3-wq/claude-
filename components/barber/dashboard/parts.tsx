import { currency } from "@/data/barber";
import type { ClientStat, Segment } from "@/data/barber-analytics";

const SEGMENT_META: Record<Segment, { label: string; dot: string; text: string }> = {
  vip: { label: "VIP", dot: "bg-brass", text: "text-brass" },
  "high-potential": { label: "High potential", dot: "bg-green-400", text: "text-green-400" },
  regular: { label: "Regular", dot: "bg-bone/50", text: "text-bone/60" },
  "at-risk": { label: "At risk", dot: "bg-amber-400", text: "text-amber-400" },
  lost: { label: "Lost", dot: "bg-red-400", text: "text-red-400" },
};

export function SegmentBadge({ segment }: { segment: Segment }) {
  const m = SEGMENT_META[segment];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs ${m.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function Kpi({
  label,
  value,
  sub,
  delta,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={`rounded-2xl border bg-coal-soft p-5 ${
        tone === "warn" ? "border-amber-400/30" : "border-coal-line"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-bone/45">{label}</p>
      <p
        className={`mt-2 font-display text-3xl font-bold sm:text-4xl ${
          tone === "warn" ? "text-amber-400" : "text-bone"
        }`}
      >
        {value}
      </p>
      <div className="mt-1.5 flex items-center gap-2 text-xs">
        {typeof delta === "number" && (
          <span
            className={`inline-flex items-center gap-0.5 font-semibold ${
              delta >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
        {sub && <span className="text-bone/45">{sub}</span>}
      </div>
    </div>
  );
}

export function SegmentBar({
  counts,
}: {
  counts: { segment: Segment; count: number }[];
}) {
  const total = counts.reduce((s, c) => s + c.count, 0) || 1;
  return (
    <div className="rounded-2xl border border-coal-line bg-coal-soft p-6">
      <h3 className="font-display text-2xl font-semibold uppercase tracking-wide">
        Client Base
      </h3>
      <p className="mt-1 text-sm text-bone/50">{total} clients tracked</p>
      <div className="mt-5 flex h-3 overflow-hidden rounded-full">
        {counts.map((c) => (
          <div
            key={c.segment}
            className={SEGMENT_META[c.segment].dot}
            style={{ width: `${(c.count / total) * 100}%` }}
            title={`${SEGMENT_META[c.segment].label}: ${c.count}`}
          />
        ))}
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {counts.map((c) => (
          <li key={c.segment} className="flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${SEGMENT_META[c.segment].dot}`} />
            <span className="text-bone/60">{SEGMENT_META[c.segment].label}</span>
            <span className="font-semibold text-bone">{c.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BarList({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; revenue: number; count: number }[];
}) {
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return (
    <div className="rounded-2xl border border-coal-line bg-coal-soft p-6">
      <h3 className="font-display text-2xl font-semibold uppercase tracking-wide">{title}</h3>
      <ul className="mt-5 space-y-4">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-bone/80">{r.name}</span>
              <span className="font-display text-base text-bone">
                {currency}
                {r.revenue.toLocaleString()}
                <span className="ml-2 text-xs text-bone/40">{r.count}×</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-coal-deep">
              <div
                className="h-full rounded-full bg-brass/70"
                style={{ width: `${(r.revenue / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ClientTable({
  title,
  caption,
  accent,
  rows,
  metric,
}: {
  title: string;
  caption: string;
  accent: "green" | "amber" | "red";
  rows: ClientStat[];
  // Which headline number to surface per row.
  metric: "potential" | "daysSinceLast" | "lostValue";
}) {
  const accentMap = {
    green: "text-green-400 border-green-400/30",
    amber: "text-amber-400 border-amber-400/30",
    red: "text-red-400 border-red-400/30",
  } as const;

  return (
    <div className={`rounded-2xl border bg-coal-soft ${accentMap[accent].split(" ")[1]}`}>
      <div className="border-b border-coal-line p-6">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-2xl font-semibold uppercase tracking-wide">
            {title}
          </h3>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${accentMap[accent]}`}
          >
            {rows.length}
          </span>
        </div>
        <p className="mt-1 text-sm text-bone/50">{caption}</p>
      </div>

      <ul className="divide-y divide-coal-line">
        {rows.length === 0 && (
          <li className="p-6 text-sm text-bone/40">No clients in this group — nice.</li>
        )}
        {rows.map((c) => (
          <li key={c.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-coal-deep font-display text-sm font-bold text-bone/70">
                {c.name.split(" ").map((n) => n[0]).join("")}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-bone">{c.name}</p>
                <p className="truncate text-xs text-bone/45">
                  {c.visits} visits · {currency}
                  {c.lifetimeValue.toLocaleString()} lifetime
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              <div className="text-right">
                {metric === "potential" && (
                  <>
                    <p className={`font-display text-xl font-bold ${accentMap[accent].split(" ")[0]}`}>
                      {c.potential}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-bone/40">
                      potential
                    </p>
                  </>
                )}
                {metric === "daysSinceLast" && (
                  <>
                    <p className={`font-display text-xl font-bold ${accentMap[accent].split(" ")[0]}`}>
                      {c.daysSinceLast}d
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-bone/40">
                      since visit
                    </p>
                  </>
                )}
                {metric === "lostValue" && (
                  <>
                    <p className={`font-display text-xl font-bold ${accentMap[accent].split(" ")[0]}`}>
                      {currency}
                      {Math.round(c.monthlyValue)}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-bone/40">
                      /mo lost
                    </p>
                  </>
                )}
              </div>
            </div>

            <p className="rounded-lg bg-coal-deep px-3 py-2 text-xs text-bone/60 sm:max-w-[15rem]">
              {c.action}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
