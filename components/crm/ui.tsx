"use client";

import { avatarTone, initials } from "@/lib/crm/format";
import {
  KYC_META,
  RISK_META,
  STATUS_META,
  TIER_META,
  type Kyc,
  type LeadStatus,
  type Risk,
  type Tier,
} from "@/lib/crm/types";

// ---- badges ----------------------------------------------------------------

export function StatusBadge({ status, className = "" }: { status: LeadStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${m.bg} ${m.fg} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function TierBadge({ tier }: { tier: Tier }) {
  const m = TIER_META[tier];
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${m.cls}`}>
      {m.label}
    </span>
  );
}

export function KycBadge({ kyc }: { kyc: Kyc }) {
  const m = KYC_META[kyc];
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${m.cls}`}>
      {m.label}
    </span>
  );
}

export function RiskDot({ risk }: { risk: Risk }) {
  const m = RISK_META[risk];
  const dot = risk === "high" ? "bg-rose-400" : risk === "medium" ? "bg-amber-400" : "bg-emerald-400";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {m.label}
    </span>
  );
}

export function CountryTag({ code, name }: { code: string; name?: string }) {
  return (
    <span title={name} className="inline-flex items-center rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-slate-300 ring-1 ring-inset ring-white/10">
      {code}
    </span>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <div className={`grid shrink-0 place-items-center rounded-full font-semibold ring-1 ring-inset ${dim} ${avatarTone(name)}`}>
      {initials(name)}
    </div>
  );
}

// ---- sparkline -------------------------------------------------------------

export function Sparkline({ data, positive, className = "" }: { data: number[]; positive?: boolean; className?: string }) {
  if (!data.length) return null;
  const w = 96;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  const up = positive ?? data[data.length - 1] >= data[0];
  const stroke = up ? "#34d399" : "#fb7185";
  const gid = `sg_${Math.round(min)}_${data.length}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`h-7 w-24 ${className}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ---- icons (inline, 1.6px stroke, consistent) ------------------------------

type I = React.SVGProps<SVGSVGElement>;
const base = (p: I) => ({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, ...p });

export const Icon = {
  dashboard: (p: I) => <svg {...base(p)}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>,
  phone: (p: I) => <svg {...base(p)}><path d="M2.5 5.5C2.5 4 3.5 3 5 3h1.6c.6 0 1.1.4 1.3 1l1 3c.2.5 0 1.1-.4 1.4l-1.3 1a12 12 0 0 0 5.7 5.7l1-1.3c.3-.4.9-.6 1.4-.4l3 1c.6.2 1 .7 1 1.3V19c0 1.5-1 2.5-2.5 2.5C10.5 21.5 2.5 13.5 2.5 5.5Z" /></svg>,
  users: (p: I) => <svg {...base(p)}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2A3.2 3.2 0 0 1 16 11M17.5 19a5.5 5.5 0 0 0-2.5-4.6" /></svg>,
  board: (p: I) => <svg {...base(p)}><rect x="3" y="4" width="5" height="16" rx="1.3" /><rect x="9.5" y="4" width="5" height="11" rx="1.3" /><rect x="16" y="4" width="5" height="14" rx="1.3" /></svg>,
  bell: (p: I) => <svg {...base(p)}><path d="M6 9a6 6 0 0 1 12 0c0 5 1.5 6 1.5 6h-15S6 14 6 9Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>,
  search: (p: I) => <svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.2-3.2" /></svg>,
  logout: (p: I) => <svg {...base(p)}><path d="M15 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" /><path d="M10 8 6 12l4 4M6 12h11" /></svg>,
  x: (p: I) => <svg {...base(p)}><path d="m6 6 12 12M18 6 6 18" /></svg>,
  check: (p: I) => <svg {...base(p)}><path d="m5 12 5 5L20 7" /></svg>,
  arrow: (p: I) => <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  chevron: (p: I) => <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>,
  clock: (p: I) => <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>,
  mail: (p: I) => <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>,
  trend: (p: I) => <svg {...base(p)}><path d="M3 17l5-5 3 3 7-7" /><path d="M15 8h4v4" /></svg>,
  bolt: (p: I) => <svg {...base(p)}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>,
  shield: (p: I) => <svg {...base(p)}><path d="M12 3 5 6v5c0 5 3.5 8 7 10 3.5-2 7-5 7-10V6l-7-3Z" /></svg>,
  report: (p: I) => <svg {...base(p)}><path d="M7 3h7l5 5v13a0 0 0 0 1 0 0H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></svg>,
  plus: (p: I) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>,
};
