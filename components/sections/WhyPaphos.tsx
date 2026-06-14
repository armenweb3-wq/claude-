import SectionHeading from "@/components/ui/SectionHeading";
import Reveal from "@/components/ui/Reveal";
import { whyPaphos } from "@/data/content";

export default function WhyPaphos() {
  return (
    <section id="why-paphos" className="section-pad bg-stone-100">
      <div className="mx-auto max-w-editorial">
        <SectionHeading
          eyebrow={whyPaphos.eyebrow}
          heading={whyPaphos.heading}
          intro={whyPaphos.intro}
        />

        <Reveal stagger className="mt-16 grid gap-px overflow-hidden rounded-sm bg-stone-300 sm:grid-cols-2">
          {whyPaphos.points.map((p) => (
            <div
              key={p.title}
              data-reveal-item
              className="group bg-stone-100 p-8 transition-colors duration-500 ease-luxe hover:bg-stone-50 sm:p-10"
            >
              <span className="hairline mb-6 transition-all duration-500 ease-luxe group-hover:w-24" />
              <h3 className="font-serif text-2xl text-ink">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">{p.body}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
