"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { developments } from "@/data/developments";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

/**
 * The cinematic centerpiece. A pinned stage cross-dissolves through each
 * development as you scroll, scaling and parallaxing toward a held climax on
 * the flagship. Reduced-motion users get an accessible static stack instead.
 */
export default function Journey() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // Use the static stacked layout when we can't pin reliably: reduced-motion
  // users and small/touch screens (mobile ScrollTrigger pinning desyncs with
  // the browser's collapsing address bar and causes overlap).
  const [staticLayout, setStaticLayout] = useState(false);

  useEffect(() => {
    const canPin = !prefersReducedMotion() && window.innerWidth >= 1024;
    if (!canPin) {
      setStaticLayout(true);
      return;
    }

    const sectionEl = section.current;
    const stageEl = stage.current;
    if (!sectionEl || !stageEl) return;

    const panels = gsap.utils.toArray<HTMLElement>("[data-panel]", stageEl);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionEl,
          start: "top top",
          end: () => `+=${panels.length * 90}%`,
          pin: stageEl,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      panels.forEach((panel, i) => {
        const media = panel.querySelector<HTMLElement>("[data-panel-media]");
        const copy = panel.querySelectorAll<HTMLElement>("[data-panel-copy] > *");
        const isFlagship = panel.dataset.flagship === "true";

        if (i > 0) {
          // Cross-dissolve from the previous panel into this one.
          tl.fromTo(
            panel,
            { autoAlpha: 0, scale: 1.12 },
            { autoAlpha: 1, scale: 1, duration: 1, ease: "power2.out" }
          );
          tl.fromTo(
            copy,
            { autoAlpha: 0, y: 40 },
            { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08, ease: "power3.out" },
            "<0.15"
          );
        }

        // Gentle parallax drift + slow zoom while the panel is on screen.
        if (media) {
          tl.to(media, { scale: isFlagship ? 1.06 : 1.04, ease: "none", duration: 1 }, "<");
        }

        // Hold the flagship a beat longer at the climax.
        if (isFlagship) tl.to({}, { duration: 0.6 });
        else if (i < panels.length - 1) tl.to({}, { duration: 0.25 });
      });
    }, sectionEl);

    return () => {
      ctx.revert();
      ScrollTrigger.refresh();
    };
  }, []);

  // ---- Static stack: reduced-motion, small/touch screens, and no-JS ----
  if (staticLayout) {
    return (
      <section id="journey" aria-label="Our developments">
        {developments.map((d) => (
          <article key={d.slug} className="relative h-[80vh] min-h-[520px] overflow-hidden">
            <Image src={d.image} alt={`${d.name}, ${d.location}`} fill sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
            <PanelCopy index={developments.indexOf(d)} dev={d} />
          </article>
        ))}
      </section>
    );
  }

  return (
    <section id="journey" ref={section} aria-label="Our developments">
      <div ref={stage} className="relative h-[100svh] min-h-[600px] overflow-hidden bg-ink">
        {developments.map((d, i) => (
          <article
            key={d.slug}
            data-panel
            data-flagship={d.flagship ? "true" : "false"}
            className="absolute inset-0"
            style={{ opacity: i === 0 ? 1 : 0, visibility: i === 0 ? "visible" : "hidden" }}
          >
            <div data-panel-media className="absolute inset-0 will-change-transform">
              <Image
                src={d.image}
                alt={`${d.name}, ${d.location}`}
                fill
                sizes="100vw"
                className="object-cover"
                priority={i === 0}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent" />
            </div>
            <PanelCopy index={i} dev={d} />
          </article>
        ))}
      </div>
    </section>
  );
}

function PanelCopy({
  index,
  dev,
}: {
  index: number;
  dev: (typeof developments)[number];
}) {
  return (
    <div className="relative z-10 mx-auto flex h-full max-w-editorial flex-col justify-end px-6 pb-20 sm:px-10 lg:px-16">
      <div data-panel-copy className="max-w-2xl text-stone-50">
        <p className="eyebrow mb-4">
          {dev.flagship ? "The Flagship" : `0${index + 1} · ${dev.status}`}
        </p>
        <h3 className="display text-4xl sm:text-6xl md:text-7xl">{dev.name}</h3>
        <p className="mt-3 font-serif text-xl italic text-gold-soft sm:text-2xl">
          {dev.tagline}
        </p>
        <p className="mt-5 max-w-xl text-sm text-stone-50/75 sm:text-base">
          {dev.description}
        </p>
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
          {dev.stats.map((s) => (
            <div key={s.label}>
              <dt className="text-[0.65rem] uppercase tracking-widest text-stone-50/50">
                {s.label}
              </dt>
              <dd className="font-serif text-2xl text-stone-50">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
