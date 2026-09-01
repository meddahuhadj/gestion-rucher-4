import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5173 },
  build: {
    // Le bundle grossit (React Query, i18n, Dexie, @google/genai) — on relève le
    // seuil d'avertissement plutôt que de sur-découper.
    chunkSizeWarningLimit: 900,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "favicon.svg",
        "favicon.ico",
        "apple-touch-icon-180.png",
        "pwa-192.png",
        "pwa-512.png",
        "pwa-512-maskable.png",
      ],
      manifest: {
        id: "/",
        name: "MOUMEN Apiary AI",
        short_name: "MOUMEN",
        description: "Copilote numérique intelligent pour apiculteur",
        lang: "fr",
        theme_color: "#b07414",
        background_color: "#f7f4ed",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/?source=pwa",
        categories: ["productivity", "business", "utilities"],
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
        shortcuts: [
          { name: "MOUMEN Assistant", short_name: "MOUMEN", url: "/moumen?source=pwa" },
          { name: "Ruches", short_name: "Ruches", url: "/hives?source=pwa" },
          { name: "Calendrier", short_name: "Agenda", url: "/calendar?source=pwa" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        // SPA : toute navigation non gérée retombe sur index.html (sauf l'API).
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        runtimeCaching: [
          {
            // Appels API (proxifiés same-origin via vercel.json → /api/v1/*).
            urlPattern: ({ url }) => url.pathname.startsWith("/api/v1"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Photos servies par Supabase Storage (URLs signées).
            urlPattern: ({ url }) => url.hostname.endsWith(".supabase.co"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-storage",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
