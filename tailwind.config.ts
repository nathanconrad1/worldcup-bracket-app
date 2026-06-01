import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0a",
        surface: "#161616",
        surface2: "#1f1f1f",
        edge: "#2a2a2a",
        cream: "#f0ebe0",
        muted: "#8a8580",
        pitch: "#00d756",
        sunset: "#ff5a36",
        gold: "#f5b400",
      },
      fontFamily: {
        display: ["var(--font-display)", "Anton", "Impact", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
