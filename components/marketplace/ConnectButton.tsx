"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { sendConnection } from "@/app/(marketplace)/connections/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send request"}
    </button>
  );
}

export default function ConnectButton({
  toId,
  toName,
  signedIn,
  accent = "indigo",
}: {
  toId: string;
  toName: string;
  signedIn: boolean;
  accent?: "indigo" | "emerald";
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(sendConnection, { error: null });

  const color =
    accent === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : "bg-indigo-600 hover:bg-indigo-700";

  if (!signedIn) {
    return (
      <a
        href="/login"
        className={`inline-block rounded-lg ${color} px-5 py-2.5 font-semibold text-white`}
      >
        Log in to connect
      </a>
    );
  }

  if (state.ok) {
    return (
      <p className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
        ✓ Request sent to {toName}. You&apos;ll see the status in your dashboard.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`rounded-lg ${color} px-5 py-2.5 font-semibold text-white`}
      >
        Connect with {toName}
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <input type="hidden" name="to_id" value={toId} />
      <label className="block text-sm font-medium text-slate-700">
        Add a short note (optional)
        <textarea
          name="message"
          rows={3}
          placeholder={`Hi ${toName}, I'd love to connect because…`}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <Submit />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
