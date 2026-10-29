import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Fonts are bundled in public/fonts so renders never depend on a network fetch.
const families = [
  { family: "Inter", file: "inter", weights: [300, 400, 500, 600, 700] },
  { family: "Inter Tight", file: "inter-tight", weights: [500, 600, 700, 800] },
  { family: "JetBrains Mono", file: "jetbrains-mono", weights: [400, 500, 700] },
  { family: "Caveat", file: "caveat", weights: [600, 700] },
  { family: "Playfair Display", file: "playfair", weights: [700, 900] },
  { family: "Patrick Hand", file: "patrick-hand", weights: [400] },
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
  // Midnight-blue documentary palette with teal light; NVIDIA green stays the accent.
  ink: "#061A2E",
  charcoal: "#0C2742",
  charcoal2: "#123556",
  line: "rgba(170,215,255,0.16)",
  white: "#FFFFFF",
  text: "#F3F7FB",
  muted: "#A8BBCD",
  dim: "#6D86A0",
  red: "#FF5C5C",
  teal: "#2EC4C9",
  gold: "#F6C451",
};

export const VIDEO = { width: 1080, height: 1920, fps: 30, durationInFrames: 1800 };

/** Layout safe zones for vertical social video (px). */
export const SAFE = { x: 72, top: 150, subtitleTop: 1430, bottom: 300 };
