import { barber, shop } from "@/data/barber";
import { SectionHead } from "./Section";
import Reveal from "./Reveal";

export default function Team() {
  return (
    <section id="team" className="border-y border-coal-line bg-coal-soft/40">
      <div className="mx-auto max-w-editorial px-6 py-24 lg:px-10 lg:py-32">
        <SectionHead eyebrow="The Barber" title="Meet Marios" />

        <div className="mt-14 grid items-center gap-10 lg:grid-cols-2">
          <Reveal variant="left" as="div" className="relative">
            <div className="absolute -inset-3 -z-10 rounded-3xl bg-brass/10 blur-2xl" />
            <div className="overflow-hidden rounded-2xl border border-coal-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={barber.photo}
                alt={`${barber.name}, ${barber.role}`}
                className="aspect-[4/5] w-full object-cover"
              />
            </div>
          </Reveal>

          <Reveal variant="right" as="div">
            <h3 className="font-display text-4xl font-bold uppercase tracking-wide">
              {barber.name}
            </h3>
            <p className="mt-1 text-sm uppercase tracking-widest text-brass">{barber.role}</p>
            <p className="mt-5 text-lg leading-relaxed text-bone/70">{barber.bio}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              {barber.specialties.map((sp) => (
                <span
                  key={sp}
                  className="rounded-full border border-coal-line px-4 py-1.5 text-xs uppercase tracking-widest text-bone/60"
                >
                  {sp}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#book"
                className="shine rounded-full bg-brass px-8 py-3.5 text-sm font-semibold uppercase tracking-widest text-coal-deep transition-colors hover:bg-brass-soft"
              >
                Book with Marios
              </a>
              <a
                href={shop.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-coal-line px-8 py-3.5 text-sm font-semibold uppercase tracking-widest text-bone/80 transition-colors hover:border-brass hover:text-brass"
              >
                {shop.instagramHandle}
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
