// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        // The registration wrapper is the only registrar (guarded for preview/dev).
        injectRegister: null,
        // Never emit a SW in dev / Lovable preview.
        devOptions: { enabled: false },
        filename: "sw.js",
        includeAssets: [
          "favicon.ico",
          "favicon.png",
          "apple-touch-icon.png",
          "pwa-192.png",
          "pwa-512.png",
          "pwa-maskable-192.png",
          "pwa-maskable-512.png",
        ],
        manifest: {
          name: "NUTRI – Deine persönliche Rezeptsammlung",
          short_name: "NUTRI",
          description:
            "Sammle, teile und entdecke Rezepte in einer schönen, modernen App.",
          lang: "de",
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          background_color: "#FFF7ED",
          theme_color: "#F97316",
          categories: ["food", "lifestyle", "productivity"],
          icons: [
            { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/pwa-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          // Never precache HTML — SSR pages are dynamic.
          globPatterns: ["**/*.{js,css,woff,woff2,ttf,otf,png,jpg,jpeg,svg,ico,webp,avif}"],
          navigateFallback: null,
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/_serverFn\//],
          runtimeCaching: [
            {
              // Server functions (TanStack RPC) must never be cached or intercepted.
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && url.pathname.startsWith("/_serverFn/"),
              handler: "NetworkOnly",
              method: "GET",
            },
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && url.pathname.startsWith("/_serverFn/"),
              handler: "NetworkOnly",
              method: "POST",
            },
            {
              // API routes: never cache.
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && url.pathname.startsWith("/api/"),
              handler: "NetworkOnly",
            },
            {
              // HTML navigations: NetworkFirst so users always get fresh content when online.
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" &&
                !url.pathname.startsWith("/~oauth") &&
                !url.pathname.startsWith("/api/") &&
                !url.pathname.startsWith("/_serverFn/"),
              handler: "NetworkFirst",
              options: {
                cacheName: "pages-v2",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              // Same-origin hashed JS/CSS/workers/fonts: StaleWhileRevalidate so a stale
              // chunk after deploy gets replaced on next load instead of sticking around.
              urlPattern: ({ sameOrigin, request }) =>
                sameOrigin && ["style", "script", "worker", "font"].includes(request.destination),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "assets-v2",
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "images-v2",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],

        },
      }),
    ],
  },
});
