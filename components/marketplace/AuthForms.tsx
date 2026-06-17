"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { loginAction, registerAction } from "@/app/(marketplace)/auth/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
    >
      {pending ? "Please wait…" : label}
    </button>
  );
}

function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useFormState(loginAction, { error: null });
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
      />
      <ErrorBox error={state.error} />
      <SubmitButton label="Log in" />
    </form>
  );
}

export function RegisterForm({ defaultRole }: { defaultRole: string }) {
  const [role, setRole] = useState(
    defaultRole === "investor" ? "investor" : "founder",
  );
  const [state, action] = useFormState(registerAction, { error: null });

  return (
    <form action={action} className="space-y-4">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          I am a…
        </span>
        <div className="grid grid-cols-2 gap-2">
          {(["founder", "investor"] as const).map((r) => (
            <label
              key={r}
              className={`cursor-pointer rounded-lg border px-3 py-2.5 text-center text-sm font-medium capitalize transition ${
                role === r
                  ? r === "founder"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                className="sr-only"
              />
              {r === "founder" ? "Startup / Founder" : "Investor"}
            </label>
          ))}
        </div>
      </div>
      <Field label="Full name" name="full_name" type="text" autoComplete="name" />
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters"
      />
      <ErrorBox error={state.error} />
      <SubmitButton label="Create account" />
    </form>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  hint,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}
