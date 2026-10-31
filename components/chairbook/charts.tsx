"use client";

import { useState } from "react";
import { eur } from "@/lib/chairbook/format";

// Reference categorical palette, slots 1 & 2 (validated: CVD ΔE 37, normal 44).
export const SERIES = { booked: "#2a78d6", walkIn: "#eb6834", single: "#2a78d6", muted: "rgb(var(--cb-line-2))" };

export interface StackRow {
  label: string;
  parts: { key: string; value: number; color: string }[];
  note?: string;
}

/** Stacked vertical bars with per-bar hover tooltip and a 2px surface gap between segments. */
export function StackedBars({
  rows,
  height = 160,
  format = (v: number) => String(v),
  highlight,
}: {
  rows: StackRow[];
  height?: number;
  format?: (v: number) => string;
  highlight?: (row: StackRow) => boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.parts.reduce((a, p) => a + p.value, 0)));
  const w = 100 / rows.length;
  const barW = Math.min(w * 0.62, 14);
  const cols = { gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` };
  return (
    <div className="relative">
      {rows.length <= 8 && (
        <div className="grid text-center text-[11px] font-semibold tabular-nums text-ink-2" style={cols}>
          {rows.map((r) => (
            <span key={r.label}>{format(r.parts.reduce((a, p) => a + p.value, 0))}</span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-36 w-full" role="img">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1="0"
            x2="100"
            y1={height - g * height}
            y2={height - g * height}
            stroke="rgb(var(--cb-line))"
            strokeWidth="0.3"
          />
        ))}
        {rows.map((r, i) => {
          let y = height;
          const x = i * w + w / 2 - barW / 2;
          return (
            <g
              key={r.label}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover(hover === i ? null : i)}
            >
              <rect x={i * w} y="0" width={w} height={height} fill="transparent" />
              {r.parts.map((p, j) => {
                const h = (p.value / max) * (height - 4);
                y -= h;
                const isLast = j === r.parts.length - 1;
                return (
                  <rect
                    key={p.key}
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(0, h - (isLast ? 0 : 0.8))}
                    rx={isLast ? 1.2 : 0}
                    fill={p.color}
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                );
              })}
              {highlight?.(r) && (
                <rect x={i * w + 1} y={height - 1.5} width={w - 2} height="1.5" rx="0.75" fill={SERIES.walkIn} />
              )}
            </g>
          );
        })}
      </svg>
      <div className="grid text-center text-[11px] text-ink-3" style={cols}>
        {rows.map((r) => (
          <span key={r.label} className={highlight?.(r) ? "font-semibold text-ink" : undefined}>
            {r.label}
          </span>
        ))}
      </div>
      {hover !== null && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
          <div className="font-semibold text-ink">{rows[hover].label}</div>
          {rows[hover].parts.map((p) => (
            <div key={p.key} className="flex items-center gap-2 text-ink-2">
              <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
              {p.key}: <span className="tabular-nums text-ink">{format(p.value)}</span>
            </div>
          ))}
          {rows[hover].note && <div className="mt-1 text-ink-3">{rows[hover].note}</div>}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Single-series daily bars (money). */
export function DailyBars({
  points,
  height = 120,
}: {
  points: { label: string; value: number; sub?: number }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const w = 100 / points.length;
  const barW = w * 0.6;
  return (
    <div className="relative">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-24 w-full" role="img">
        {points.map((p, i) => {
          const h = (p.value / max) * (height - 4);
          const subH = p.sub !== undefined ? (p.sub / max) * (height - 4) : 0;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * w} y="0" width={w} height={height} fill="transparent" />
              <rect
                x={i * w + (w - barW) / 2}
                y={height - h}
                width={barW}
                height={h}
                rx="1"
                fill={SERIES.muted}
                opacity={hover === null || hover === i ? 1 : 0.6}
              />
              {p.sub !== undefined && (
                <rect
                  x={i * w + (w - barW) / 2}
                  y={height - subH}
                  width={barW}
                  height={subH}
                  rx="1"
                  fill={SERIES.single}
                  opacity={hover === null || hover === i ? 1 : 0.6}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="grid text-center text-[10px] text-ink-3" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((p, i) => (
          <span key={i}>{p.label}</span>
        ))}
      </div>
      {hover !== null && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
          <div className="font-semibold text-ink">{points[hover].label}</div>
          <div className="text-ink-2">
            Gross <span className="tabular-nums text-ink">{eur(points[hover].value)}</span>
          </div>
          {points[hover].sub !== undefined && (
            <div className="text-ink-2">
              Shop net <span className="tabular-nums text-ink">{eur(points[hover].sub!)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Horizontal share bar (e.g. cash vs card). */
export function ShareBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {parts.map((p) => (
          <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            {p.label}{" "}
            <span className="tabular-nums text-ink">
              {eur(p.value)} · {Math.round((p.value / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
