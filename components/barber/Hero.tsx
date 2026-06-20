import { shop } from "@/data/barber";

export default function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-screen items-center overflow-hidden pt-16"
    >
      {/* Ambient backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#1A1A1F_0%,#0A0A0C_60%)]" />
        <div className="absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-brass/10 blur-3xl" />
        <div className="absolute left-1/4 top-1/2 h-72 w-72 rounded-full bg-brass/5 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg,#C8A24C 0 1px,transparent 1px 14px)",
          }}
        />
      </div>

      <div className="mx-auto w-full max-w-editorial px-6 lg:px-10">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-coal-line bg-coal-soft/60 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-brass">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          Now taking walk-ins &amp; reservations
        </p>

        <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
          Look sharp.
          <br />
          <span className="text-brass">Feel unstoppable.</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-bone/65">
          {shop.blurb}
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <a
            href="#book"
            className="rounded-full bg-brass px-9 py-4 text-sm font-semibold uppercase tracking-widest text-coal-deep transition-transform hover:scale-[1.02] hover:bg-brass-soft"
          >
            Book your chair
          </a>
          <a
            href="#services"
            className="rounded-full border border-coal-line px-9 py-4 text-sm font-semibold uppercase tracking-widest text-bone/80 transition-colors hover:border-brass hover:text-brass"
          >
            View services
          </a>
        </div>

        <dl className="mt-16 grid max-w-2xl grid-cols-2 gap-6 border-t border-coal-line pt-8 sm:grid-cols-4">
          {shop.stats.map((s) => (
            <div key={s.label}>
              <dt className="font-display text-3xl font-bold text-bone sm:text-4xl">
                {s.value}
              </dt>
              <dd className="mt-1 text-xs uppercase tracking-widest text-bone/45">
                {s.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
