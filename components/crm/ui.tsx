"use client";

// Shared presentational atoms for the CRM.

import { avatarTone, initials } from "@/lib/crm/format";
import {
  PRIORITY_META,
  STATUS_META,
  type ClientStatus,
  type Priority,
} from "@/lib/crm/types";

export function StatusBadge({ status }: { status: ClientStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${m.tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority];
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset ${m.tone}`}
    >
      {m.label}
    </span>
  );
}

export function Avatar({
  name,
  flag,
  size = "md",
}: {
  name: string;
  flag?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <div className="relative shrink-0">
      <div
        className={`grid place-items-center rounded-full font-semibold ${dim} ${avatarTone(name)}`}
      >
        {initials(name)}
      </div>
      {flag && (
        <span className="absolute -bottom-1 -right-1 text-sm leading-none">
          {flag}
        </span>
      )}
    </div>
  );
}
