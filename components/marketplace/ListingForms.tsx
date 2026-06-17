"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveInvestor, saveStartup } from "@/app/(marketplace)/dashboard/actions";
import { sectors, stages } from "@/data/site";
import type { Investor, Startup } from "@/lib/types";

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function Status({ state }: { state: { error: string | null; ok?: boolean } }) {
  if (state.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state.ok)
    return <p className="text-sm text-emerald-600">✓ Saved. Your listing is live.</p>;
  return null;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        {...rest}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </label>
  );
}

function Select({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: readonly string[];
  defaultValue?: string | null;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Published({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        name="published"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-slate-300"
      />
      Visible in the public directory
    </label>
  );
}

export function StartupForm({ startup }: { startup: Startup | null }) {
  const [state, action] = useFormState(saveStartup, { error: null });
  return (
    <form action={action} className="space-y-4">
      <Input label="Startup name" name="name" defaultValue={startup?.name ?? ""} required />
      <Input
        label="One-line tagline"
        name="tagline"
        defaultValue={startup?.tagline ?? ""}
        placeholder="The Stripe for…"
      />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Description
        </span>
        <textarea
          name="description"
          rows={5}
          defaultValue={startup?.description ?? ""}
          placeholder="What you're building, traction so far, the team, and why now."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Sector" name="sector" options={sectors} defaultValue={startup?.sector} />
        <Select label="Stage" name="stage" options={stages} defaultValue={startup?.stage} />
        <Input label="Location" name="location" defaultValue={startup?.location ?? ""} />
        <Input
          label="Raising (USD)"
          name="funding_goal"
          defaultValue={startup?.funding_goal ?? ""}
          placeholder="500000"
          inputMode="numeric"
        />
      </div>
      <Input
        label="Website"
        name="website"
        type="url"
        defaultValue={startup?.website ?? ""}
        placeholder="https://"
      />
      <Published defaultChecked={startup?.published ?? true} />
      <div className="flex items-center gap-4 pt-2">
        <Save label="Save startup" />
        <Status state={state} />
      </div>
    </form>
  );
}

export function InvestorForm({ investor }: { investor: Investor | null }) {
  const [state, action] = useFormState(saveInvestor, { error: null });
  return (
    <form action={action} className="space-y-4">
      <Input
        label="Name or firm"
        name="name"
        defaultValue={investor?.name ?? ""}
        required
      />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Investment thesis
        </span>
        <textarea
          name="thesis"
          rows={5}
          defaultValue={investor?.thesis ?? ""}
          placeholder="What you invest in, what excites you, and how you help founders."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">
          Sectors you back
        </legend>
        <div className="flex flex-wrap gap-2">
          {sectors.map((s) => (
            <CheckChip
              key={s}
              name="sectors"
              value={s}
              defaultChecked={investor?.sectors?.includes(s) ?? false}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">
          Stages you back
        </legend>
        <div className="flex flex-wrap gap-2">
          {stages.map((s) => (
            <CheckChip
              key={s}
              name="stages"
              value={s}
              defaultChecked={investor?.stages?.includes(s) ?? false}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Min check (USD)"
          name="check_min"
          defaultValue={investor?.check_min ?? ""}
          placeholder="25000"
          inputMode="numeric"
        />
        <Input
          label="Max check (USD)"
          name="check_max"
          defaultValue={investor?.check_max ?? ""}
          placeholder="250000"
          inputMode="numeric"
        />
        <Input label="Location" name="location" defaultValue={investor?.location ?? ""} />
        <Input
          label="Website"
          name="website"
          type="url"
          defaultValue={investor?.website ?? ""}
          placeholder="https://"
        />
      </div>
      <Published defaultChecked={investor?.published ?? true} />
      <div className="flex items-center gap-4 pt-2">
        <Save label="Save investor profile" />
        <Status state={state} />
      </div>
    </form>
  );
}

function CheckChip({
  name,
  value,
  defaultChecked,
}: {
  name: string;
  value: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="cursor-pointer select-none rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-700">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
      />
      {value}
    </label>
  );
}
