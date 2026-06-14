"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

type RevealProps = {
  children: React.ReactNode;
  /** Stagger children that carry the `data-reveal-item` attribute. */
  stagger?: boolean;
  delay?: number;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
};

/**
 * Fades / lifts content into view on scroll. Falls back to a static, fully
 * visible render when reduced motion is requested.
 */
export default function Reveal({
  children,
  stagger = false,
  delay = 0,
  className,
  as: Tag = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    const targets = stagger
      ? el.querySelectorAll<HTMLElement>("[data-reveal-item]")
      : [el];

    const ctx = gsap.context(() => {
      gsap.from(targets, {
        opacity: 0,
        y: 36,
        duration: 1,
        delay,
        ease: "power3.out",
        stagger: stagger ? 0.12 : 0,
        scrollTrigger: {
          trigger: el,
          start: "top 82%",
          once: true,
        },
      });
    }, el);

    return () => ctx.revert();
  }, [stagger, delay]);

  return (
    // @ts-expect-error — dynamic tag with a ref is safe here.
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
