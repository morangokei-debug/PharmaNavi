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
        "pharma-bg": {
          primary: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          tertiary: "var(--bg-tertiary)",
        },
        "pharma-accent": {
          DEFAULT: "var(--accent-primary)",
          secondary: "var(--accent-secondary)",
        },
        "pharma-text": {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        "pharma-success": "var(--color-success)",
        "pharma-error": "var(--color-error)",
        "pharma-warning": "var(--color-warning)",
      },
      fontFamily: {
        heading: ["Rajdhani", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 16px var(--accent-glow)",
        "glow-lg": "0 0 24px var(--accent-glow)",
      },
      borderColor: {
        "pharma": "var(--border-color)",
        "pharma-active": "var(--border-active)",
        "pharma-focus": "var(--border-focus)",
      },
      placeholderColor: {
        "pharma-muted": "var(--text-muted)",
      },
    },
  },
  plugins: [],
};
export default config;
