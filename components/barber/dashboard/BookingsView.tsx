import type { BookingRow, Dashboard } from "@/data/barber-analytics";
import { SegmentBadge } from "./parts";

export default function BookingsView({ d }: { d: Dashboard }) {
  // Group the upcoming schedule by day.
  const byDay = new Map<string, BookingRow[]>();
  for (const b of d.upcoming) {
    (byDay.get(b.dateIso) ?? byDay.set(b.dateIso, []).get(b.dateIso)!).push(b);
  }
  const days = Array.from(byDay.entries());
  const todayIso = d.upcoming[0]?.dateIso;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-2xl border border-coal-line bg-coal-soft px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-bone/45">
            Booked today
          </p>
          <p className="mt-1 font-display text-3xl font-bold text-brass">{d.upcomingToday}</p>
        </div>
        <div className="rounded-2xl border border-coal-line bg-coal-soft px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-bone/45">
            Next 12 days
          </p>
          <p className="mt-1 font-display text-3xl font-bold text-bone">{d.upcoming.length}</p>
        </div>
      </div>

      <div className="space-y-5">
        {days.map(([iso, rows]) => {
          const head = rows[0];
          const isToday = iso === todayIso;
          return (
            <div
              key={iso}
              className="overflow-hidden rounded-2xl border border-coal-line bg-coal-soft"
            >
              <div className="flex items-center justify-between border-b border-coal-line px-5 py-3">
                <p className="font-display text-lg font-semibold uppercase tracking-wide">
                  {head.weekday} {head.dayNum} {head.monthShort}
                  {isToday && (
                    <span className="ml-2 rounded-full bg-brass/15 px-2 py-0.5 text-[10px] text-brass">
                      Today
                    </span>
                  )}
                </p>
                <span className="text-xs text-bone/45">{rows.length} booked</span>
              </div>
              <ul className="divide-y divide-coal-line">
                {rows.map((b) => (
                  <li key={b.id} className="flex items-center gap-4 px-5 py-3">
                    <span className="w-14 shrink-0 font-display text-lg text-brass">{b.time}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-bone">{b.name}</p>
                      <a href={`tel:${b.phone.replace(/\s/g, "")}`} className="text-xs text-bone/45 hover:text-brass">
                        {b.phone}
                      </a>
                    </div>
                    <span className="hidden sm:block">
                      <SegmentBadge segment={b.segment} />
                    </span>
                    <span className="hidden text-xs text-bone/45 md:block">
                      Haircut &amp; Fade · 40 min
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
