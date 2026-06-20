"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

type Variant = "up" | "scale" | "left" | "right" | "blur" | "fade";

/**
 * Reveals its children once they scroll into view. Starts hidden (CSS .reveal),
 * eases in via .is-in. Honors reduced-motion (shows instantly) and has a
 * safety timeout so nothing can get stuck invisible.
 */
export default function Reveal({
  children,
  variant = "up",
  delay = 0,
  as,
  className = "",
}: {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  as?: ElementType;
  className?: string;
}) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    const safety = window.setTimeout(() => setShown(true), 1600);
    return () => {
      io.disconnect();
      window.clearTimeout(safety);
    };
  }, []);

  return (
    <Tag
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`reveal reveal-${variant} ${shown ? "is-in" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}
