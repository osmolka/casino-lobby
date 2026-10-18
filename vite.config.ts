import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { MANIFEST } from './src/pwa/manifest.ts';

export default defineConfig({
  plugins: [
    react(),
    // H2. Registered by src/pwa/register.ts in production builds only.
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: false,
      devOptions: { enabled: false },
      manifest: MANIFEST,
      includeManifestIcons: false, // already matched by globPatterns; avoids duplicate precache entries
      workbox: {
        // Shell, JS, CSS, fonts, icons, and the static promos (they change only with a deploy, which revises
        // them). api/games.json is neither precached nor runtime-cached: the app owns that data (catalog:v1)
        // and shows the offline banner itself. No runtimeCaching at all.
        globPatterns: ['**/*.{html,js,css,woff2,svg,png}', 'api/promos.json'],
        globIgnores: ['api/games.json', 'icons/icon.svg'], // icon.svg: source of the generated PNGs only
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // injectRegister: false skips the plugin's own autoUpdate defaults; set them here.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    // tokens.css is read with ?raw by the contrast test; other CSS stays stubbed.
    css: { include: [/tokens\.css/], modules: { classNameStrategy: 'non-scoped' } },
  },
});
