// Formatting helpers for the CRM UI.

export function usd(n: number, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: opts.compact ? "compact" : "standard",
  });
  const s = fmt.format(Math.abs(n));
  if (opts.sign) return `${n >= 0 ? "+" : "−"}${s}`;
  return n < 0 ? `−${s}` : s;
}

export function pct(n: number, sign = true): string {
  const s = `${Math.abs(n).toFixed(1)}%`;
  if (!sign) return s;
  return `${n >= 0 ? "+" : "−"}${s}`;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relative(iso: string | null): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (abs < min) return "just now";
  if (abs < hour) return rtf.format(Math.round(diff / min), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 7 * day) return rtf.format(Math.round(diff / day), "day");
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function clock(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `Today ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${time}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function avatarTone(seed: string): string {
  const palette = [
    "bg-sky-500/15 text-sky-200 ring-sky-400/20",
    "bg-emerald-500/15 text-emerald-200 ring-emerald-400/20",
    "bg-violet-500/15 text-violet-200 ring-violet-400/20",
    "bg-amber-500/15 text-amber-200 ring-amber-400/20",
    "bg-rose-500/15 text-rose-200 ring-rose-400/20",
    "bg-cyan-500/15 text-cyan-200 ring-cyan-400/20",
    "bg-indigo-500/15 text-indigo-200 ring-indigo-400/20",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 997;
  return palette[h % palette.length];
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function longDate(): string {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
