import "../theme"; // registers the bundled fonts (shared with the other cuts)

export const fonts = {
  body: "Inter, sans-serif",
  display: "'Inter Tight', Inter, sans-serif",
  mono: "'JetBrains Mono', monospace",
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
