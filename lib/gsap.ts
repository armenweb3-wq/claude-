// Centralized GSAP setup. Import { gsap, ScrollTrigger } from here so the
// plugin is only registered once and reduced-motion is handled in one place.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/** True when the user has asked the OS to minimize non-essential motion. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export { gsap, ScrollTrigger };
