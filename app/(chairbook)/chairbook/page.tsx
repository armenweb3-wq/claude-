"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Input, Field } from "@/components/chairbook/ui";
import { ThemeToggle } from "@/components/chairbook/theme";
import { useChairbook } from "@/lib/chairbook/store";

const HOME: Record<string, string> = {
  owner: "/chairbook/dashboard",
  barber: "/chairbook/chair",
  client: "/chairbook/book",
};

const DEMO = [
  { username: "owner", pin: "1234", label: "Owner", sub: "Both shops, team, insights" },
  { username: "andreas", pin: "1111", label: "Andreas", sub: "Barber · Makariou" },
  { username: "kyriakos", pin: "1111", label: "Kyriakos", sub: "Barber · Makariou" },
  { username: "marios", pin: "1111", label: "Marios", sub: "Barber · Harbour" },
  { username: "stelios", pin: "1111", label: "Stelios", sub: "Barber · Harbour" },
  { username: "nikos", pin: "0000", label: "Nikos", sub: "Client · books online" },
];

export default function LoginPage() {
  const { ready, user, login, resetDemo } = useChairbook();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) router.replace(HOME[user.role]);
  }, [ready, user, router]);

  const submit = (u = username, p = pin) => {
    const err = login(u, p);
    setError(err);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-ink text-lg font-bold text-canvas">
            C
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Chairbook</h1>
          <p className="mt-1 text-sm text-ink-3">Bookings, till and barber deals in one ledger.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-3 rounded-2xl border border-line bg-surface p-5"
        >
          <Field label="Username">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="e.g. andreas"
            />
          </Field>
          <Field label="PIN">
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="••••"
            />
          </Field>
          {error && <p className="text-sm text-bad">{error}</p>}
          <Button type="submit" className="w-full" size="lg">
            Sign in
          </Button>
        </form>

        <div className="mt-6">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-ink-3">
            Demo accounts · tap to sign in, use &quot;switch&quot; top-right to come back here
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <button
                key={d.username}
                onClick={() => submit(d.username, d.pin)}
                className="rounded-xl border border-line bg-surface px-3 py-2.5 text-left hover:border-ink"
              >
                <div className="text-sm font-medium text-ink">{d.label}</div>
                <div className="text-xs text-ink-3">{d.sub}</div>
              </button>
            ))}
          </div>
          <button
            onClick={resetDemo}
            className="mt-4 w-full text-center text-xs text-ink-3 underline-offset-2 hover:underline"
          >
            Reset demo data
          </button>
        </div>
      </div>
    </div>
  );
}
