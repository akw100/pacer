import type { VitePWAOptions } from 'vite-plugin-pwa';

// vite-plugin-pwa options for Pacer. The manifest values intentionally
// duplicate two theme tokens in literals (background/theme color hex) — this
// is the ONE place a hex is allowed, because manifest.json must hold concrete
// values for the browser install dialog before any CSS loads. Keep these in
// sync with apps/web/src/theme/tokens.css:
//   theme_color  ← --color-accent
//   background_color ← --color-surface

export const pwaConfig: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  includeAssets: ['offline.html', 'icons/icon.svg'],
  manifest: {
    name: 'Pacer',
    short_name: 'Pacer',
    description: 'Track runs, workouts, and habits — and compete with your family.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAF8F5', // --color-surface
    theme_color: '#FF5A36', // --color-accent
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    // Always serve the app shell offline; fall back to offline.html if even
    // the shell can't be reached (first visit while offline).
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api/, /\/stats\/platform/],
    runtimeCaching: [
      {
        // Web fonts — cache aggressively, they rarely change.
        urlPattern: /^https:\/\/(api\.fontshare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//,
        handler: 'CacheFirst',
        options: {
          cacheName: 'pacer-fonts',
          expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 90 },
        },
      },
    ],
  },
  devOptions: {
    // SW disabled in dev — Vite's HMR doesn't play nicely with one.
    enabled: false,
  },
};
