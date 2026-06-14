"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

/**
 * Drives Lenis smooth scrolling and bridges it to GSAP's ScrollTrigger so
 * pinned/scrubbed timelines stay in sync with the eased scroll position.
 * Disabled entirely when the user prefers reduced motion (native scroll).
 */
export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Drive touch scrolling too, so phones get the same eased scroll
      // (and ScrollTrigger stays in sync on touch devices). Keep the touch
      // multiplier at/under 1 so a swipe doesn't fling the page too fast.
      syncTouch: true,
      touchMultiplier: 0.9,
    });

    // Keep ScrollTrigger informed of Lenis-driven scroll updates.
    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
