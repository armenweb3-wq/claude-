import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./data/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Chairbook semantic tokens — values live in app/globals.css and flip
        // with [data-theme="dark"]. Use these (not slate-*) inside chairbook.
        canvas: "rgb(var(--cb-canvas) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--cb-surface) / <alpha-value>)",
          2: "rgb(var(--cb-surface-2) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--cb-line) / <alpha-value>)",
          2: "rgb(var(--cb-line-2) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--cb-ink) / <alpha-value>)",
          2: "rgb(var(--cb-ink-2) / <alpha-value>)",
          3: "rgb(var(--cb-ink-3) / <alpha-value>)",
        },
        good: "rgb(var(--cb-good) / <alpha-value>)",
        warn: "rgb(var(--cb-warn) / <alpha-value>)",
        bad: "rgb(var(--cb-bad) / <alpha-value>)",
        info: "rgb(var(--cb-info) / <alpha-value>)",
        stone: {
          DEFAULT: "#F4F0E9", // warm canvas
          50: "#FBFAF6",
          100: "#F4F0E9",
          200: "#E8E0D3",
          300: "#D8CCB8",
          400: "#BCAB8E",
        },
        navy: {
          DEFAULT: "#16243B", // cinematic dark
          light: "#1F3350",
          deep: "#101B2D",
        },
        gold: {
          DEFAULT: "#B8995A", // accent
          soft: "#CDB984",
          muted: "#9C8049",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        widest: "0.28em",
      },
      maxWidth: {
        editorial: "76rem",
      },
      transitionTimingFunction: {
        luxe: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scroll-cue": {
          "0%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "50%": { transform: "translateY(8px)", opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.9s cubic-bezier(0.22,1,0.36,1) both",
        "scroll-cue": "scroll-cue 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
