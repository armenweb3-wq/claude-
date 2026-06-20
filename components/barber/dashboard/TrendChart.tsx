"use client";

import { useState } from "react";
import type { Bucket } from "@/data/barber-analytics";

export default function TrendChart({
  weekly,
  monthly,
}: {
  weekly: Bucket[];
  monthly: Bucket[];
}) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const data = mode === "week" ? weekly : monthly;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const total = data.reduce((s, d) => s + d.revenue, 0);
  const avg = Math.round(total / data.length);

  return (
    <div className="rounded-2xl border border-coal-line bg-coal-soft p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl font-semibold uppercase tracking-wide">
            Revenue Trend
          </h3>
          <p className="mt-1 text-sm text-bone/50">
            {mode === "week" ? "Last 10 weeks" : "Last 6 months"} · avg{" "}
            <span className="text-brass">${avg.toLocaleString()}</span> /{" "}
            {mode === "week" ? "wk" : "mo"}
          </p>
        </div>
        <div className="flex rounded-full border border-coal-line p-1 text-xs font-semibold uppercase tracking-widest">
          {(["week", "month"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 transition-colors ${
                mode === m ? "bg-brass text-coal-deep" : "text-bone/55 hover:text-bone"
              }`}
            >
              {m === "week" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 flex h-52 items-end gap-2 sm:gap-3">
        {data.map((d, i) => {
          const isLast = i === data.length - 1;
          return (
            <div key={d.label + i} className="group flex flex-1 flex-col items-center gap-2">
              <div className="relative flex w-full flex-1 items-end">
                <div
                  className={`w-full rounded-t-md transition-all duration-300 ${
                    isLast ? "bg-brass" : "bg-brass/35 group-hover:bg-brass/60"
                  }`}
                  style={{ height: `${Math.max((d.revenue / max) * 100, 2)}%` }}
                >
                  <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-coal-deep px-2 py-1 text-[10px] font-medium text-bone opacity-0 transition-opacity group-hover:opacity-100">
                    ${d.revenue.toLocaleString()} · {d.cuts} cuts
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] uppercase tracking-wider ${
                  isLast ? "text-brass" : "text-bone/40"
                }`}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
