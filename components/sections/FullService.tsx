import SectionHeading from "@/components/ui/SectionHeading";
import Reveal from "@/components/ui/Reveal";
import { fullService } from "@/data/content";

export default function FullService() {
  return (
    <section id="service" className="section-pad bg-navy text-stone-50">
      <div className="mx-auto max-w-editorial">
        <SectionHeading
          eyebrow={fullService.eyebrow}
          heading={fullService.heading}
          intro={fullService.intro}
          tone="light"
        />

        <Reveal stagger className="mt-16 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {fullService.steps.map((s) => (
            <div key={s.n} data-reveal-item className="border-t border-stone-50/15 pt-6">
              <span className="font-serif text-3xl text-gold">{s.n}</span>
              <h3 className="mt-4 font-serif text-2xl">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-50/65">{s.body}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
