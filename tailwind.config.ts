import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./data/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
        ink: "#0E1622",
        gold: {
          DEFAULT: "#B8995A", // accent
          soft: "#CDB984",
          muted: "#9C8049",
        },
        // Hustle Blends — barbershop palette (dark, warm, premium)
        coal: {
          DEFAULT: "#121215",
          deep: "#0A0A0C",
          soft: "#1A1A1F",
          line: "#2A2A31",
        },
        brass: {
          DEFAULT: "#C8A24C", // signature gold
          soft: "#E2C572",
          deep: "#9A7A33",
        },
        bone: "#F1ECE1", // warm off-white text
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Oswald", "Impact", "sans-serif"],
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
