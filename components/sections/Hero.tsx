"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

export default function Hero() {
  const root = useRef<HTMLDivElement>(null);
  const bg = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      // Intro timeline (runs once on load).
      if (!prefersReducedMotion()) {
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .from("[data-hero='eyebrow']", { opacity: 0, y: 20, duration: 0.9, delay: 0.2 })
          .from("[data-hero='title']", { opacity: 0, y: 40, duration: 1.2 }, "-=0.5")
          .from("[data-hero='tagline']", { opacity: 0, y: 24, duration: 1 }, "-=0.7")
          .from("[data-hero='cue']", { opacity: 0, duration: 1 }, "-=0.4");

        // Background parallax + slow zoom-out tied to scroll.
        gsap.to(bg.current, {
          yPercent: 18,
          scale: 1.08,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      }
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="top"
      ref={root}
      className="relative flex h-[100svh] min-h-[640px] items-center justify-center overflow-hidden bg-ink text-stone-50"
    >
      {/* Background media — swap hero.svg for a real photo, or drop in a <video>. */}
      <div ref={bg} className="absolute inset-0 will-change-transform">
        <Image
          src="/assets/hero.svg"
          alt="Aerial view of the Paphos coastline at dusk"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/20 to-ink/80" />
      </div>

      <div className="relative z-10 mx-auto max-w-editorial px-6 text-center">
        <p data-hero="eyebrow" className="eyebrow mb-6">
          Paphos · Cyprus
        </p>
        <h1
          data-hero="title"
          className="display text-5xl sm:text-7xl md:text-8xl"
        >
          Mkhitaryan
          <span className="block text-gold">Developers</span>
        </h1>
        <p
          data-hero="tagline"
          className="mx-auto mt-8 max-w-xl text-lg font-light text-stone-50/80 sm:text-xl"
        >
          A curated portfolio of luxury residences along the Mediterranean
          coast — owned without compromise, handled end to end.
        </p>
      </div>

      <a
        href="#journey"
        data-hero="cue"
        className="absolute bottom-10 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-stone-50/70 hover:text-gold"
        aria-label="Scroll to explore the portfolio"
      >
        <span className="text-[0.65rem] uppercase tracking-widest">Explore</span>
        <span className="h-10 w-px animate-scroll-cue bg-current" />
      </a>
    </section>
  );
}
