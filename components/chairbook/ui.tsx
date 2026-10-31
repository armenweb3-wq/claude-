"use client";

import { useEffect } from "react";
import { eur } from "@/lib/chairbook/format";

type Tone = "neutral" | "good" | "warn" | "bad" | "info";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  title,
  action,
  children,
  className,
  pad = true,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section
      className={cx(
        "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        pad && "p-4 sm:p-5",
        className,
      )}
    >
      {(title || action) && (
        <header className={cx("mb-3 flex items-center justify-between gap-3", !pad && "px-4 pt-4")}>
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
  money = true,
}: {
  label: string;
  value: number | string;
  sub?: React.ReactNode;
  tone?: Tone;
  money?: boolean;
}) {
  const toneCls: Record<Tone, string> = {
    neutral: "text-ink",
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
    info: "text-info",
  };
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-3">{label}</div>
      <div className={cx("mt-1 text-2xl font-semibold tabular-nums tracking-tight", toneCls[tone])}>
        {typeof value === "number" && money ? eur(value) : value}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

export function Money({
  value,
  className,
  signed = false,
}: {
  value: number;
  className?: string;
  signed?: boolean;
}) {
  const s = eur(Math.abs(value));
  return (
    <span className={cx("tabular-nums", className)}>
      {signed && value !== 0 ? (value > 0 ? "+" : "−") : ""}
      {s}
    </span>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "primary", size = "md", className, ...rest }: ButtonProps) {
  const v = {
    primary: "bg-ink text-canvas hover:bg-ink-2 disabled:bg-line-2",
    secondary: "bg-surface text-ink border border-line-2 hover:bg-surface-2 disabled:text-ink-3",
    ghost: "bg-transparent text-ink-2 hover:bg-surface-2",
    danger: "bg-bad text-canvas hover:bg-bad/100",
  }[variant];
  const s = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  }[size];
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed",
        v,
        s,
        className,
      )}
      {...rest}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cx("inline-flex rounded-xl bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
            o.value === value ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  const cls: Record<Tone, string> = {
    neutral: "bg-surface-2 text-ink-2",
    good: "bg-good/10 text-good",
    warn: "bg-warn/10 text-warn",
    bad: "bg-bad/10 text-bad",
    info: "bg-info/10 text-info",
  };
  return (
    <span className={cx("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium", cls[tone])}>
      {children}
    </span>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-11 w-full rounded-xl border border-line-2 bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-ink focus:ring-2 focus:ring-ink/10";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, "pr-8", props.className)} />;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <button aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-xl sm:max-w-lg sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-3 hover:bg-surface-2" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-2 p-6 text-center text-sm text-ink-3">
      {children}
    </div>
  );
}

export function Row({
  left,
  right,
  sub,
  dot,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  sub?: React.ReactNode;
  dot?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
      {dot && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot }} />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-ink">{left}</div>
        {sub && <div className="truncate text-xs text-ink-3">{sub}</div>}
      </div>
      {right && <div className="shrink-0 text-right text-sm tabular-nums text-ink">{right}</div>}
    </div>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-ink-3">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
