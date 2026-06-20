import { barbers } from "@/data/barber";
import { SectionHead } from "./Section";

export default function Team() {
  // Drop the synthetic "First Available" option from the showcase.
  const crew = barbers.filter((b) => b.id !== "any");

  return (
    <section id="team" className="border-y border-coal-line bg-coal-soft/40">
      <div className="mx-auto max-w-editorial px-6 py-24 lg:px-10 lg:py-32">
        <SectionHead
          eyebrow="The Crew"
          title="Master Barbers"
          intro="Seven seasoned hands, one standard: you leave looking better than you imagined."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {crew.map((b) => (
            <article
              key={b.id}
              className="group overflow-hidden rounded-2xl border border-coal-line bg-coal-deep"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.photo}
                  alt={`${b.name}, ${b.role}`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-coal-deep via-transparent to-transparent" />
              </div>
              <div className="p-6">
                <h3 className="font-display text-2xl font-semibold uppercase tracking-wide">
                  {b.name}
                </h3>
                <p className="text-xs uppercase tracking-widest text-brass">{b.role}</p>
                <p className="mt-3 text-sm leading-relaxed text-bone/55">{b.bio}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {b.specialties.map((sp) => (
                    <span
                      key={sp}
                      className="rounded-full border border-coal-line px-3 py-1 text-[11px] uppercase tracking-widest text-bone/50"
                    >
                      {sp}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
