import Reveal from "./Reveal";

export function SectionHead({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <Reveal variant="fade">
        <p className="text-xs font-semibold uppercase tracking-widest text-brass">{eyebrow}</p>
      </Reveal>
      <Reveal variant="up" delay={80}>
        <h2 className="mt-3 font-display text-4xl font-bold uppercase leading-tight tracking-tight sm:text-5xl">
          {title}
        </h2>
      </Reveal>
      {intro && (
        <Reveal variant="up" delay={160}>
          <p className="mt-4 text-bone/60">{intro}</p>
        </Reveal>
      )}
    </div>
  );
}
