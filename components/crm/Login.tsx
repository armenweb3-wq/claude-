"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/crm/session";
import { PRIMARY_AGENT } from "@/lib/crm/seed";
import { Icon } from "./ui";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState(PRIMARY_AGENT.email);
  const [password, setPassword] = useState(PRIMARY_AGENT.password);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = signIn(email, password);
    if (res.ok) {
      router.replace("/crm");
    } else {
      setError(res.error);
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.06] bg-slate-900/40 p-12 lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-teal-500/[0.07] blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-lg font-black text-slate-950">V</span>
          <div className="leading-none">
            <p className="text-sm font-semibold tracking-tight text-slate-100">VANTAGE</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">Trading CRM</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-100">
            Work your book one call at a time.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            Vantage lines up exactly who to call next from your notes and follow-ups.
            Log the outcome, schedule the callback, hit Save &amp; Next — and the desk
            keeps moving.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-400">
            {["Auto-prioritised call queue", "Keyboard-driven dispositioning", "Live pipeline & AUM"].map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <Icon.check className="h-3 w-3" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-600">© {new Date().getFullYear()} Vantage Markets · Internal use only</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-lg font-black text-slate-950">V</span>
            <p className="text-sm font-semibold tracking-tight text-slate-100">VANTAGE <span className="text-slate-500">Trading CRM</span></p>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-100">Sign in</h2>
          <p className="mt-1.5 text-sm text-slate-500">Access your desk and today&apos;s queue.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Work email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-500/50"
                placeholder="you@vantage.io"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-500/50"
                placeholder="••••••••"
              />
            </Field>

            {error && <p className="text-sm text-rose-400">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in"} <Icon.arrow className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-white/5 bg-white/[0.02] px-3.5 py-3 text-xs text-slate-500">
            <span className="font-medium text-slate-400">Demo access</span> — prefilled above.
            Email <span className="font-mono text-slate-300">{PRIMARY_AGENT.email}</span>, password{" "}
            <span className="font-mono text-slate-300">{PRIMARY_AGENT.password}</span>.
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}
