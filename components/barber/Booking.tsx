"use client";

import { useMemo, useState } from "react";
import { services, barbers, hours, type Service } from "@/data/barber";

type Step = 0 | 1 | 2 | 3;
const STEPS = ["Service", "Barber", "Time", "Details"] as const;

function money(n: number) {
  return `$${n}`;
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fmtSlot(min: number) {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

// Next 14 days, formatted for the date picker.
function upcomingDays() {
  const out: { iso: string; weekday: string; label: string; dow: number }[] = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      dow: d.getDay(),
    });
  }
  return out;
}

// Deterministic "is this slot already taken" so the grid looks live but stable.
function isTaken(dateIso: string, slot: number) {
  let h = 0;
  const key = `${dateIso}-${slot}`;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 5 === 0;
}

export default function Booking() {
  const [step, setStep] = useState<Step>(0);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const days = useMemo(upcomingDays, []);
  const service: Service | undefined = services.find((s) => s.id === serviceId);
  const barber = barbers.find((b) => b.id === barberId);
  const day = days.find((d) => d.iso === dateIso);

  const slots = useMemo(() => {
    if (!day || !service) return [];
    const dayHours = hours[(day.dow + 6) % 7]; // hours[] starts Monday
    if (!dayHours?.close) return [];
    const open = toMinutes(dayHours.open);
    const close = toMinutes(dayHours.close);
    const out: number[] = [];
    for (let t = open; t + service.durationMin <= close; t += 30) out.push(t);
    return out;
  }, [day, service]);

  const canAdvance =
    (step === 0 && serviceId) ||
    (step === 1 && barberId) ||
    (step === 2 && dateIso && slot !== null) ||
    step === 3;

  function validate() {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Tell us your name";
    if (!/^[0-9+()\-\s]{7,}$/.test(form.phone)) e.phone = "Enter a valid phone";
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))
      e.email = "Enter a valid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setSubmitting(true);
    const payload = {
      service: service?.name,
      barber: barber?.name,
      date: dateIso,
      time: slot !== null ? fmtSlot(slot) : null,
      ...form,
    };
    try {
      await fetch("/api/barber/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
      // Confirmation reference — purely client-side for this demo flow.
      const ref =
        "HB-" +
        (dateIso?.replace(/-/g, "").slice(4) ?? "") +
        "-" +
        Math.random().toString(36).slice(2, 6).toUpperCase();
      setConfirmed(ref);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-coal-line bg-coal-soft p-8 text-center sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brass/15 text-brass">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h3 className="mt-6 font-display text-3xl font-semibold uppercase tracking-wide">
          You&apos;re booked in
        </h3>
        <p className="mt-2 text-bone/60">
          A confirmation is on its way. Show this reference at the shop.
        </p>
        <div className="mt-6 rounded-xl border border-coal-line bg-coal-deep p-5 text-left">
          <dl className="space-y-2 text-sm">
            <Row k="Reference" v={confirmed} />
            <Row k="Service" v={`${service?.name} · ${money(service?.price ?? 0)}`} />
            <Row k="Barber" v={barber?.name ?? ""} />
            <Row
              k="When"
              v={`${day?.weekday}, ${day?.label} · ${slot !== null ? fmtSlot(slot) : ""}`}
            />
            <Row k="Name" v={form.name} />
          </dl>
        </div>
        <button
          onClick={() => {
            setConfirmed(null);
            setStep(0);
            setServiceId(null);
            setBarberId(null);
            setDateIso(null);
            setSlot(null);
            setForm({ name: "", phone: "", email: "", notes: "" });
          }}
          className="mt-6 text-sm font-medium uppercase tracking-widest text-brass hover:text-brass-soft"
        >
          Book another →
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-coal-line bg-coal-soft">
      {/* Progress */}
      <div className="flex border-b border-coal-line">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => i < step && setStep(i as Step)}
            disabled={i > step}
            className={`flex-1 px-2 py-4 text-center text-[11px] font-semibold uppercase tracking-widest transition-colors sm:text-xs ${
              i === step
                ? "text-brass"
                : i < step
                  ? "text-bone/60 hover:text-bone"
                  : "text-bone/25"
            }`}
          >
            <span className="hidden sm:inline">{i + 1}. </span>
            {label}
          </button>
        ))}
      </div>

      <div className="p-5 sm:p-8">
        {/* Step 0 — Service */}
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((s) => {
              const active = s.id === serviceId;
              return (
                <button
                  key={s.id}
                  onClick={() => setServiceId(s.id)}
                  className={`group rounded-xl border p-4 text-left transition-all ${
                    active
                      ? "border-brass bg-brass/10"
                      : "border-coal-line hover:border-bone/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-display text-lg font-medium uppercase tracking-wide">
                      {s.name}
                    </span>
                    <span className="whitespace-nowrap font-display text-lg text-brass">
                      {money(s.price)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-bone/55">{s.description}</p>
                  <p className="mt-3 text-xs uppercase tracking-widest text-bone/40">
                    {s.durationMin} min
                    {s.popular && (
                      <span className="ml-2 rounded-full bg-brass/15 px-2 py-0.5 text-brass">
                        Popular
                      </span>
                    )}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 1 — Barber */}
        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {barbers.map((b) => {
              const active = b.id === barberId;
              return (
                <button
                  key={b.id}
                  onClick={() => setBarberId(b.id)}
                  className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                    active
                      ? "border-brass bg-brass/10"
                      : "border-coal-line hover:border-bone/30"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.photo}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                  <span>
                    <span className="block font-display text-lg font-medium uppercase tracking-wide">
                      {b.name}
                    </span>
                    <span className="block text-xs uppercase tracking-widest text-brass">
                      {b.role}
                    </span>
                    <span className="mt-1 block text-sm text-bone/55">{b.bio}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2 — Date & time */}
        {step === 2 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-bone/50">
              Pick a day
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {days.map((d) => {
                const closed = !hours[(d.dow + 6) % 7]?.close;
                const active = d.iso === dateIso;
                return (
                  <button
                    key={d.iso}
                    disabled={closed}
                    onClick={() => {
                      setDateIso(d.iso);
                      setSlot(null);
                    }}
                    className={`flex min-w-[64px] shrink-0 flex-col items-center rounded-xl border px-3 py-3 transition-all ${
                      active
                        ? "border-brass bg-brass/10 text-bone"
                        : closed
                          ? "cursor-not-allowed border-coal-line text-bone/20"
                          : "border-coal-line text-bone/70 hover:border-bone/30"
                    }`}
                  >
                    <span className="text-xs uppercase tracking-widest">
                      {d.weekday}
                    </span>
                    <span className="mt-1 font-display text-lg">{d.label}</span>
                    {closed && <span className="text-[10px] uppercase">Closed</span>}
                  </button>
                );
              })}
            </div>

            {dateIso && (
              <>
                <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-widest text-bone/50">
                  Available times
                </p>
                {slots.length === 0 ? (
                  <p className="text-sm text-bone/50">No times available — try another day.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((t) => {
                      const taken = isTaken(dateIso, t);
                      const active = slot === t;
                      return (
                        <button
                          key={t}
                          disabled={taken}
                          onClick={() => setSlot(t)}
                          className={`rounded-lg border py-2.5 text-sm font-medium transition-all ${
                            active
                              ? "border-brass bg-brass text-coal-deep"
                              : taken
                                ? "cursor-not-allowed border-coal-line text-bone/20 line-through"
                                : "border-coal-line text-bone/75 hover:border-brass hover:text-brass"
                          }`}
                        >
                          {fmtSlot(t)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3 — Details */}
        {step === 3 && (
          <div className="grid gap-4">
            <Field
              label="Full name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              error={errors.name}
              placeholder="Jordan Rivera"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Phone"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                error={errors.phone}
                placeholder="(305) 555-0142"
                type="tel"
              />
              <Field
                label="Email (optional)"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
                error={errors.email}
                placeholder="you@email.com"
                type="email"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-bone/50">
                Notes for your barber (optional)
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Skin fade, keep length on top, beard line-up…"
                className="w-full rounded-lg border border-coal-line bg-coal-deep px-4 py-3 text-sm text-bone placeholder:text-bone/30 focus:border-brass focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Summary + nav */}
        <div className="mt-6 flex flex-col gap-4 border-t border-coal-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-bone/55">
            {service ? (
              <>
                <span className="text-bone">{service.name}</span>
                {barber && <> · {barber.name}</>}
                {day && slot !== null && (
                  <> · {day.weekday} {day.label}, {fmtSlot(slot)}</>
                )}
                <span className="ml-2 font-display text-base text-brass">
                  {money(service.price)}
                </span>
              </>
            ) : (
              "Select a service to begin"
            )}
          </p>
          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep((step - 1) as Step)}
                className="rounded-full border border-coal-line px-6 py-3 text-sm font-medium uppercase tracking-widest text-bone/70 transition-colors hover:border-bone/40 hover:text-bone"
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => canAdvance && setStep((step + 1) as Step)}
                disabled={!canAdvance}
                className="rounded-full bg-brass px-8 py-3 text-sm font-semibold uppercase tracking-widest text-coal-deep transition-colors hover:bg-brass-soft disabled:cursor-not-allowed disabled:opacity-30"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting}
                className="rounded-full bg-brass px-8 py-3 text-sm font-semibold uppercase tracking-widest text-coal-deep transition-colors hover:bg-brass-soft disabled:opacity-50"
              >
                {submitting ? "Booking…" : "Confirm booking"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-bone/45">{k}</dt>
      <dd className="text-right font-medium text-bone">{v}</dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-bone/50">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border bg-coal-deep px-4 py-3 text-sm text-bone placeholder:text-bone/30 focus:outline-none ${
          error ? "border-red-500/70" : "border-coal-line focus:border-brass"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
