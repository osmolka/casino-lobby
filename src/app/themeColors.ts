// No imports: also loaded by vite.config.ts (Node) through src/pwa/manifest.ts.

/**
 * Browser UI color per theme (`<meta name="theme-color">`): the header's --surface in tokens.css. Also in the
 * index.html boot script; both are checked against tokens.css in tests.
 */
export const THEME_COLORS = { light: '#fff', dark: '#1a1d27' } as const;

/** Page background of the default (light) theme, --bg in tokens.css: the manifest's splash background. */
export const LIGHT_PAGE_BACKGROUND = '#f5f6fa';
