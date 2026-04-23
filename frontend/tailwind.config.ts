import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./providers/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)"]
      },
      colors: {
        brand: {
          indigo: "#4f46e5",
          violet: "#7c3aed"
        }
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.08)",
        lift: "0 10px 24px rgba(79, 70, 229, 0.14)"
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.35)", opacity: "0.65" }
        }
      },
      animation: {
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
