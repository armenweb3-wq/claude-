"use client";

import { useMemo, useState } from "react";
import { hours, mainService, shop, currency } from "@/data/barber";

type Step = 0 | 1 | 2;
const STEPS = ["Day", "Time", "Details"] as const;

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fmtSlot(min: number) {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  return `${h24.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// Next 21 days for the date picker.
function upcomingDays() {
  const out: { iso: string; weekday: string; day: number; dow: number }[] = [];
  const now = new Date();
  for (let i = 0; i < 21; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
      day: d.getDate(),
      dow: d.getDay(),
    });
  }
  return out;
}

// Deterministic availability so the calendar looks live but stable:
// most days open, some "few left", a rare "full".
type Avail = "open" | "few" | "full" | "closed";
function dayAvailability(iso: string, closed: boolean): Avail {
  if (closed) return "closed";
  let h = 0;
  for (let i = 0; i < iso.length; i++) h = (h * 31 + iso.charCodeAt(i)) >>> 0;
  const r = h % 10;
  if (r === 0) return "full";
  if (r <= 2) return "few";
  return "open";
}

// Deterministic per-slot "taken" flag.
function isTaken(iso: string, slot: number) {
  let h = 0;
  const key = `${iso}-${slot}`;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 4 === 0;
}

const DOT: Record<Avail, string> = {
  open: "bg-green-400",
  few: "bg-amber-400",
  full: "bg-red-400",
  closed: "bg-bone/20",
};

export default function Booking() {
  const [step, setStep] = useState<Step>(0);
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const days = useMemo(upcomingDays, []);
  const day = days.find((d) => d.iso === dateIso);

  const slots = useMemo(() => {
    if (!day) return [];
    const dayHours = hours[(day.dow + 6) % 7]; // hours[] starts Monday
    if (!dayHours?.close) return [];
    const open = toMinutes(dayHours.open);
    const close = toMinutes(dayHours.close);
    const out: number[] = [];
    for (let t = open; t + mainService.durationMin <= close; t += mainService.durationMin)
      out.push(t);
    return out;
  }, [day]);

  const canAdvance =
    (step === 0 && dateIso) || (step === 1 && slot !== null) || step === 2;

  function validate() {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Tell us your name";
    if (!/^[0-9+()\-\s]{7,}$/.test(form.phone)) e.phone = "Enter a valid phone";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setSubmitting(true);
    const payload = {
      service: mainService.name,
      barber: "Marios",
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
          See you at the chair. Show this reference when you arrive.
        </p>
        <div className="mt-6 rounded-xl border border-coal-line bg-coal-deep p-5 text-left">
          <dl className="space-y-2 text-sm">
            <Row k="Reference" v={confirmed} />
            <Row k="Service" v={`${mainService.name} · ${currency}${mainService.price}`} />
            <Row k="Barber" v="Marios" />
            <Row
              k="When"
              v={`${day?.weekday} ${day?.day} · ${slot !== null ? fmtSlot(slot) : ""}`}
            />
            <Row k="Name" v={form.name} />
          </dl>
        </div>
        <p className="mt-4 text-xs text-bone/45">Please arrive 5 minutes early.</p>
        <button
          onClick={() => {
            setConfirmed(null);
            setStep(0);
            setDateIso(null);
            setSlot(null);
            setForm({ name: "", phone: "", notes: "" });
          }}
          className="mt-6 text-sm font-medium uppercase tracking-widest text-brass hover:text-brass-soft"
        >
          Book another →
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="overflow-hidden rounded-2xl border border-coal-line bg-coal-soft">
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
          <div key={step} className="animate-fade-up">
            {/* Step 0 — Day */}
            {step === 0 && (
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-bone/50">
                    Choose a day
                  </p>
                  <div className="flex flex-wrap gap-3 text-[11px] text-bone/45">
                    <Legend dot="bg-green-400" label="Open" />
                    <Legend dot="bg-amber-400" label="Few left" />
                    <Legend dot="bg-red-400" label="Full" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {days.map((d) => {
                    const closed = !hours[(d.dow + 6) % 7]?.close;
                    const avail = dayAvailability(d.iso, closed);
                    const disabled = avail === "closed" || avail === "full";
                    const active = d.iso === dateIso;
                    return (
                      <button
                        key={d.iso}
                        disabled={disabled}
                        onClick={() => {
                          setDateIso(d.iso);
                          setSlot(null);
                        }}
                        className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-3 transition-all ${
                          active
                            ? "border-brass bg-brass/10 text-bone"
                            : disabled
                              ? "cursor-not-allowed border-coal-line text-bone/25"
                              : "border-coal-line text-bone/75 hover:border-bone/30"
                        }`}
                      >
                        <span className="text-[10px] uppercase tracking-widest">{d.weekday}</span>
                        <span className="font-display text-lg">{d.day}</span>
                        <span className={`h-1.5 w-1.5 rounded-full ${DOT[avail]}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 1 — Time */}
            {step === 1 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-bone/50">
                  Available times · {day?.weekday} {day?.day}
                </p>
                {slots.length === 0 ? (
                  <p className="text-sm text-bone/50">No times available — try another day.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((t) => {
                      const taken = isTaken(dateIso!, t);
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
              </div>
            )}

            {/* Step 2 — Details */}
            {step === 2 && (
              <div className="grid gap-4">
                <Field
                  label="Full name"
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  error={errors.name}
                  placeholder="Andreas K."
                />
                <Field
                  label="Phone"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  error={errors.phone}
                  placeholder="+357 96 606 880"
                  type="tel"
                />
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-bone/50">
                    Notes for Marios (optional)
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    placeholder="Skin fade, keep length on top, sharp beard line…"
                    className="w-full rounded-lg border border-coal-line bg-coal-deep px-4 py-3 text-sm text-bone placeholder:text-bone/30 focus:border-brass focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Summary + nav */}
          <div className="mt-6 flex flex-col gap-4 border-t border-coal-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-bone/55">
              <span className="text-bone">{mainService.name}</span> · {mainService.durationMin} min
              {day && slot !== null && (
                <> · {day.weekday} {day.day}, {fmtSlot(slot)}</>
              )}
              <span className="ml-2 font-display text-base text-brass">
                {currency}
                {mainService.price}
              </span>
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
              {step < 2 ? (
                <button
                  onClick={() => canAdvance && setStep((step + 1) as Step)}
                  disabled={!canAdvance}
                  className="shine rounded-full bg-brass px-8 py-3 text-sm font-semibold uppercase tracking-widest text-coal-deep transition-colors hover:bg-brass-soft disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="shine rounded-full bg-brass px-8 py-3 text-sm font-semibold uppercase tracking-widest text-coal-deep transition-colors hover:bg-brass-soft disabled:opacity-50"
                >
                  {submitting ? "Booking…" : "Confirm booking"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Side panel — service + important info */}
      <aside className="flex flex-col gap-4">
        <div className="rounded-2xl border border-coal-line bg-coal-soft p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-brass">
            All cuts · {mainService.durationMin} min
          </p>
          <p className="mt-2 font-display text-2xl font-semibold uppercase tracking-wide">
            {mainService.name}
          </p>
          <p className="mt-1 text-sm text-bone/55">Beard trim included.</p>
          <p className="mt-3 font-display text-4xl font-bold text-brass">
            {currency}
            {mainService.price}
          </p>
        </div>
        <div className="rounded-2xl border border-coal-line bg-coal-soft p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-bone/50">
            Good to know
          </p>
          <ul className="mt-3 space-y-2.5 text-sm text-bone/65">
            {shop.bookingNotes.map((n) => (
              <li key={n} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brass" />
                {n}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
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
