import type { ManifestOptions } from 'vite-plugin-pwa';
import { LIGHT_PAGE_BACKGROUND, THEME_COLORS } from '../app/themeColors.ts';

/**
 * Web app manifest (H2), static: it does not follow the chosen language or theme. Names = en `app.title` /
 * `app.name`, colors from tokens.css (manifest.test.ts). Icons generated once by `npx pwa-assets-generator`.
 */
export const MANIFEST = {
  name: 'Lucky Lobby — Casino games',
  short_name: 'Lucky Lobby',
  description: 'Casino lobby: games catalog, wallet and live wins.',
  lang: 'en',
  dir: 'ltr',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  theme_color: THEME_COLORS.light,
  background_color: LIGHT_PAGE_BACKGROUND,
  icons: [
    { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
} satisfies Partial<ManifestOptions>;
