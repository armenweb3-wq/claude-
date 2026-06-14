import Image from "next/image";
import SectionHeading from "@/components/ui/SectionHeading";
import Reveal from "@/components/ui/Reveal";
import { developments } from "@/data/developments";

export default function Portfolio() {
  return (
    <section id="portfolio" className="section-pad bg-stone-100">
      <div className="mx-auto max-w-editorial">
        <SectionHeading
          eyebrow="The Portfolio"
          heading="Every address, at a glance."
          intro="Browse the full collection. Each residence is delivered turnkey and managed for life."
        />

        <Reveal stagger className="mt-16 grid gap-8 sm:grid-cols-2">
          {developments.map((d) => (
            <article
              key={d.slug}
              data-reveal-item
              className={`group relative overflow-hidden rounded-sm bg-ink ${
                d.flagship ? "sm:col-span-2" : ""
              }`}
            >
              <div className={`relative ${d.flagship ? "aspect-[16/7]" : "aspect-[4/3]"}`}>
                <Image
                  src={d.image}
                  alt={`${d.name}, ${d.location}`}
                  fill
                  sizes={d.flagship ? "100vw" : "(min-width: 640px) 50vw, 100vw"}
                  className="object-cover transition-transform duration-700 ease-luxe group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent" />
              </div>

              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-6 text-stone-50 sm:p-8">
                <div>
                  <p className="eyebrow mb-2">
                    {d.flagship ? "Flagship" : d.status} · {d.year}
                  </p>
                  <h3 className="font-serif text-2xl sm:text-3xl">{d.name}</h3>
                  <p className="mt-1 text-sm text-stone-50/70">{d.location}</p>
                </div>
                <p className="shrink-0 font-serif text-lg text-gold-soft">
                  {d.stats.find((s) => s.label === "From")?.value ?? ""}
                </p>
              </div>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
