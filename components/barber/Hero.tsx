import { shop } from "@/data/barber";
import HeroFx from "./HeroFx";
import Reveal from "./Reveal";

export default function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-screen items-center overflow-hidden pt-16"
    >
      <HeroFx />

      <div className="mx-auto w-full max-w-editorial px-6 lg:px-10">
        <Reveal variant="fade">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-coal-line bg-coal-soft/60 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-brass">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            Now taking walk-ins &amp; reservations
          </p>
        </Reveal>

        <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
          <Reveal variant="up" as="span" className="block">
            Look sharp.
          </Reveal>
          <Reveal variant="up" delay={120} as="span" className="block">
            <span className="text-shimmer">Feel unstoppable.</span>
          </Reveal>
        </h1>

        <Reveal variant="up" delay={240}>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-bone/65">{shop.blurb}</p>
        </Reveal>

        <Reveal variant="up" delay={340}>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href="#book"
              className="shine rounded-full bg-brass px-9 py-4 text-sm font-semibold uppercase tracking-widest text-coal-deep transition-transform duration-300 hover:scale-[1.03] hover:bg-brass-soft"
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
        </Reveal>

        <dl className="mt-16 grid max-w-2xl grid-cols-2 gap-6 border-t border-coal-line pt-8 sm:grid-cols-4">
          {shop.stats.map((s, i) => (
            <Reveal key={s.label} variant="up" delay={400 + i * 90}>
              <dt className="font-display text-3xl font-bold text-bone sm:text-4xl">
                {s.value}
              </dt>
              <dd className="mt-1 text-xs uppercase tracking-widest text-bone/45">
                {s.label}
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>

      {/* Scroll cue */}
      <a
        href="#services"
        aria-label="Scroll to services"
        className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-bone/40 transition-colors hover:text-brass sm:flex"
      >
        <span className="text-[10px] uppercase tracking-widest">Scroll</span>
        <span className="flex h-9 w-5 justify-center rounded-full border border-bone/25 pt-1.5">
          <span className="h-1.5 w-1 animate-scroll-cue rounded-full bg-brass" />
        </span>
      </a>
    </section>
  );
}
