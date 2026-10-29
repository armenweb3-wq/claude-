import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Fonts are bundled in public/fonts so renders never depend on a network fetch.
const families = [
  { family: "Inter", file: "inter", weights: [300, 400, 500, 600, 700] },
  { family: "Inter Tight", file: "inter-tight", weights: [500, 600, 700, 800] },
  { family: "JetBrains Mono", file: "jetbrains-mono", weights: [400, 500, 700] },
  { family: "Caveat", file: "caveat", weights: [600, 700] },
];
for (const f of families) {
  for (const w of f.weights) {
    loadFont({ family: f.family, url: staticFile(`fonts/${f.file}-${w}.woff2`), weight: String(w), format: "woff2" });
  }
}

export const fonts = {
  body: "Inter, sans-serif",
  display: "'Inter Tight', Inter, sans-serif",
  mono: "'JetBrains Mono', monospace",
  /** Hand-drawn annotation voice for circles, arrows and call-outs. */
  hand: "Caveat, cursive",
};

export const colors = {
  green: "#76B900",
  greenBright: "#9BE12A",
  greenDeep: "#3E6300",
  black: "#000000",
  ink: "#07090A",
  charcoal: "#141617",
  charcoal2: "#1E2122",
  line: "rgba(255,255,255,0.12)",
  white: "#FFFFFF",
  text: "#F2F4F1",
  muted: "#9EA3A0",
  dim: "#5E6361",
  red: "#E5484D",
};

export const VIDEO = { width: 1080, height: 1920, fps: 30, durationInFrames: 1800 };

/** Layout safe zones for vertical social video (px). */
export const SAFE = { x: 72, top: 150, subtitleTop: 1430, bottom: 300 };
