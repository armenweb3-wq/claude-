import { SectionHead } from "./Section";

const shots = [
  { src: "/barber/gallery-1.svg", label: "The Fade" },
  { src: "/barber/gallery-2.svg", label: "Beard Work" },
  { src: "/barber/gallery-3.svg", label: "Hot Towel" },
  { src: "/barber/gallery-4.svg", label: "Classic" },
  { src: "/barber/gallery-5.svg", label: "Texture" },
  { src: "/barber/gallery-6.svg", label: "The Chair" },
];

export default function Gallery() {
  return (
    <section id="gallery" className="mx-auto max-w-editorial px-6 py-24 lg:px-10 lg:py-32">
      <SectionHead
        eyebrow="The Work"
        title="Fresh from the Chair"
        intro="A look at what walks out the door. Swap these for your own shots in /public/barber."
      />

      <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {shots.map((s) => (
          <figure
            key={s.src}
            className="group relative aspect-square overflow-hidden rounded-xl border border-coal-line"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.src}
              alt={s.label}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <figcaption className="absolute bottom-3 left-3 rounded-full bg-coal-deep/70 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-bone/80 backdrop-blur">
              {s.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
