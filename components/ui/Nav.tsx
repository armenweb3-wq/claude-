"use client";

import { useEffect, useState } from "react";

const links = [
  { href: "#journey", label: "Portfolio" },
  { href: "#why-paphos", label: "Why Paphos" },
  { href: "#service", label: "Service" },
  { href: "#contact", label: "Enquire" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ease-luxe ${
        scrolled
          ? "bg-ink/80 backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-editorial items-center justify-between px-6 py-5 sm:px-10 lg:px-16"
      >
        <a
          href="#top"
          className="font-serif text-lg tracking-wide text-stone-50"
        >
          Mkhitaryan
          <span className="ml-2 text-gold">Developers</span>
        </a>
        <ul className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="font-sans text-xs uppercase tracking-widest text-stone-50/70 transition-colors hover:text-gold"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <a href="#contact" className="md:hidden text-xs uppercase tracking-widest text-gold">
          Enquire
        </a>
      </nav>
    </header>
  );
}
