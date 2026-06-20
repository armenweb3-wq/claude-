import { services } from "@/data/barber";
import { SectionHead } from "./Section";

export default function Services() {
  return (
    <section id="services" className="mx-auto max-w-editorial px-6 py-24 lg:px-10 lg:py-32">
      <SectionHead
        eyebrow="The Menu"
        title="Services & Pricing"
        intro="Straightforward pricing, no surprises. Every service includes a consultation and a finish that holds."
      />

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <div
            key={s.id}
            className="group relative flex flex-col rounded-2xl border border-coal-line bg-coal-soft p-6 transition-colors hover:border-brass/50"
          >
            {s.popular && (
              <span className="absolute right-5 top-5 rounded-full bg-brass/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-brass">
                Popular
              </span>
            )}
            <h3 className="font-display text-2xl font-semibold uppercase tracking-wide">
              {s.name}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-bone/55">
              {s.description}
            </p>
            <div className="mt-6 flex items-end justify-between border-t border-coal-line pt-4">
              <span className="text-xs uppercase tracking-widest text-bone/40">
                {s.durationMin} min
              </span>
              <span className="font-display text-3xl font-bold text-brass">
                ${s.price}
              </span>
            </div>
            <a
              href="#book"
              className="mt-4 rounded-full border border-coal-line py-2.5 text-center text-xs font-semibold uppercase tracking-widest text-bone/70 transition-colors group-hover:border-brass group-hover:text-brass"
            >
              Book this
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
