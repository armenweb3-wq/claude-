import { shop } from "@/data/barber";
import { SectionHead } from "./Section";
import Reveal from "./Reveal";

const shots = [
  { src: "/barber/gallery-1.svg", label: "Skin Fade" },
  { src: "/barber/gallery-2.svg", label: "Beard Work" },
  { src: "/barber/gallery-3.svg", label: "Taper" },
  { src: "/barber/gallery-4.svg", label: "Classic" },
  { src: "/barber/gallery-5.svg", label: "Texture" },
  { src: "/barber/gallery-6.svg", label: "The Chair" },
];

export default function Gallery() {
  return (
    <section id="gallery" className="mx-auto max-w-editorial px-6 py-24 lg:px-10 lg:py-32">
      <SectionHead
        eyebrow="Latest Cuts"
        title="Fresh from the Chair"
        intro={`Real work, straight from Instagram. Follow ${shop.instagramHandle} for the latest.`}
      />

      <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {shots.map((s, i) => (
          <Reveal
            key={s.src}
            variant="scale"
            delay={(i % 3) * 80}
            as="figure"
            className="group relative aspect-square overflow-hidden rounded-xl border border-coal-line"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.src}
              alt={s.label}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <a
              href={shop.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-end bg-gradient-to-t from-coal-deep/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            >
              <span className="m-3 inline-flex items-center gap-1.5 rounded-full bg-coal-deep/70 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-bone/90 backdrop-blur">
                {s.label} · View
              </span>
            </a>
          </Reveal>
        ))}
      </div>

      <div className="mt-10 text-center">
        <a
          href={shop.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-coal-line px-7 py-3.5 text-sm font-semibold uppercase tracking-widest text-bone/80 transition-colors hover:border-brass hover:text-brass"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
          View more on Instagram
        </a>
      </div>
    </section>
  );
}
