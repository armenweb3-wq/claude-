"use client";

import { useEffect, useState } from "react";
import { shop } from "@/data/barber";

const links = [
  { href: "#services", label: "Services" },
  { href: "#team", label: "Barber" },
  { href: "#gallery", label: "Gallery" },
  { href: "#visit", label: "Visit" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || open
          ? "border-b border-coal-line bg-coal-deep/90 backdrop-blur"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-editorial items-center justify-between px-6 lg:px-10">
        <a href="#top" className="flex items-center gap-2">
          <BrassPole />
          <span className="font-display text-xl font-bold uppercase tracking-widest">
            {shop.name}
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-xs font-medium uppercase tracking-widest text-bone/65 transition-colors hover:text-brass"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#book"
            className="rounded-full bg-brass px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-coal-deep transition-colors hover:bg-brass-soft"
          >
            Book now
          </a>
        </nav>

        <button
          className="md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <div className="space-y-1.5">
            <span
              className={`block h-0.5 w-6 bg-bone transition-transform ${open ? "translate-y-2 rotate-45" : ""}`}
            />
            <span className={`block h-0.5 w-6 bg-bone transition-opacity ${open ? "opacity-0" : ""}`} />
            <span
              className={`block h-0.5 w-6 bg-bone transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`}
            />
          </div>
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-coal-line px-6 py-4 md:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="py-2 text-sm font-medium uppercase tracking-widest text-bone/75"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#book"
            onClick={() => setOpen(false)}
            className="mt-2 rounded-full bg-brass px-6 py-3 text-center text-sm font-semibold uppercase tracking-widest text-coal-deep"
          >
            Book now
          </a>
        </nav>
      )}
    </header>
  );
}

function BrassPole() {
  return (
    <span className="relative inline-flex h-6 w-3 overflow-hidden rounded-full border border-brass/40">
      <span className="absolute inset-x-0 top-0 h-[200%] animate-[barber_2.5s_linear_infinite] bg-[repeating-linear-gradient(45deg,#C8A24C_0_4px,#0A0A0C_4px_8px)]" />
    </span>
  );
}
