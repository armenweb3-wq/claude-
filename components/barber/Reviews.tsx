import { reviews } from "@/data/barber";
import { SectionHead } from "./Section";

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5 text-brass" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} aria-hidden className={i < n ? "" : "text-coal-line"}>
          ★
        </span>
      ))}
    </div>
  );
}

export default function Reviews() {
  return (
    <section className="border-y border-coal-line bg-coal-soft/40">
      <div className="mx-auto max-w-editorial px-6 py-24 lg:px-10 lg:py-32">
        <SectionHead eyebrow="The Word" title="What Clients Say" />

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {reviews.map((r) => (
            <blockquote
              key={r.name}
              className="rounded-2xl border border-coal-line bg-coal-deep p-7"
            >
              <Stars n={r.rating} />
              <p className="mt-4 text-lg leading-relaxed text-bone/80">
                &ldquo;{r.text}&rdquo;
              </p>
              <footer className="mt-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brass/15 font-display text-sm font-bold text-brass">
                  {r.name.charAt(0)}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-bone">{r.name}</span>
                  <span className="block text-xs uppercase tracking-widest text-bone/40">
                    {r.handle}
                  </span>
                </span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
