import type { Config } from "tailwindcss";

/**
 * Design tokens — §19. Registre : miel/ambre, propolis/vert, bois de ruche,
 * neutres chauds. Cohérent avec docs/ARCHITECTURE.html.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ground: "rgb(var(--c-ground) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--c-surface-2) / <alpha-value>)",
        border: "rgb(var(--c-border) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        "ink-soft": "rgb(var(--c-ink-soft) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        honey: {
          DEFAULT: "rgb(var(--c-honey) / <alpha-value>)",
          ink: "rgb(var(--c-honey-ink) / <alpha-value>)",
          wash: "rgb(var(--c-honey-wash) / <alpha-value>)",
        },
        propolis: "rgb(var(--c-propolis) / <alpha-value>)",
        ok: "rgb(var(--c-ok) / <alpha-value>)",
        warn: "rgb(var(--c-warn) / <alpha-value>)",
        attn: "rgb(var(--c-attn) / <alpha-value>)",
        danger: "rgb(var(--c-danger) / <alpha-value>)",
      },
      fontFamily: {
        // "IBM Plex Sans Arabic" en repli : le navigateur y bascule pour les
        // glyphes arabes que Fraunces / IBM Plex Sans ne couvrent pas (RTL — §38).
        display: ['"Fraunces"', '"IBM Plex Sans Arabic"', "Georgia", "serif"],
        sans: ['"IBM Plex Sans"', '"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', '"IBM Plex Sans Arabic"', "ui-monospace", "monospace"],
      },
      borderRadius: { xl: "0.875rem", "2xl": "1.125rem" },
    },
  },
  plugins: [],
} satisfies Config;
