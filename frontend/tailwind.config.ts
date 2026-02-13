import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        fog: "#f8fafc",
        slateish: "#2b3a55",
        accent: "#0ea5e9",
        accent2: "#22c55e",
        accent3: "#f59e0b",
        border: "#e2e8f0"
      },
      fontFamily: {
        display: ["Space Grotesk", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
        body: ["IBM Plex Sans", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      },
      boxShadow: {
        panel: "0 18px 40px rgba(15, 23, 42, 0.12)",
        glow: "0 0 0 1px rgba(14, 165, 233, 0.3), 0 10px 30px rgba(14, 165, 233, 0.18)"
      },
      backgroundImage: {
        "hero-grid": "radial-gradient(circle at top, rgba(14, 165, 233, 0.15), transparent 60%), radial-gradient(circle at 20% 20%, rgba(34, 197, 94, 0.18), transparent 55%)",
        "pane-noise": "linear-gradient(135deg, rgba(15, 23, 42, 0.02), rgba(15, 23, 42, 0.06))"
      }
    }
  },
  plugins: []
} satisfies Config;
