import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        alabaster: {
          50: "#FAFAF9",
          100: "#F6F6F4",
          200: "#EFEFED",
          300: "#E4E4E0",
          400: "#D3D3CD",
        },
        ink: {
          50: "#F8F8F8",
          100: "#F0F0F0",
          200: "#E2E2E2",
          300: "#C6C6C6",
          400: "#8E8E8E",
          500: "#606060",
          600: "#3E3E3E",
          700: "#262626",
          800: "#141414",
          900: "#0A0A0A",
          950: "#050505",
        },
        editorial: {
          border: "#E2E2DE",
          borderDark: "#262626",
          stone: "#737370",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Plus Jakarta Sans", "Inter", "sans-serif"],
        display: ["var(--font-display)", "Space Grotesk", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      letterSpacing: {
        widestEditorial: "0.22em",
        tighterEditorial: "-0.04em",
      },
      boxShadow: {
        editorial: "0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 4px 12px 0 rgba(0, 0, 0, 0.02)",
        editorialLg: "0 10px 30px -5px rgba(0, 0, 0, 0.06), 0 4px 12px -2px rgba(0, 0, 0, 0.03)",
        editorialDark: "0 10px 30px -5px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
