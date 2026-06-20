"use client";

import { useEffect, useRef } from "react";

// Ambient hero backdrop: drifting brass glows + a cursor-following spotlight.
// Pointer tracking is disabled for touch / reduced-motion.
export default function HeroFx() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
      });
    };
    el.addEventListener("pointermove", onMove);
    return () => {
      el.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#1A1A1F_0%,#0A0A0C_60%)]" />
      <div className="drift absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-brass/10 blur-3xl" />
      <div className="drift-slow absolute left-1/4 top-1/2 h-72 w-72 rounded-full bg-brass/5 blur-3xl" />
      {/* Cursor spotlight */}
      <div
        className="absolute inset-0 opacity-60 transition-opacity duration-500"
        style={{
          background:
            "radial-gradient(420px circle at var(--mx,50%) var(--my,30%), rgba(200,162,76,0.10), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg,#C8A24C 0 1px,transparent 1px 14px)",
        }}
      />
    </div>
  );
}
