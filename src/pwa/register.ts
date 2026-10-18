/**
 * Registers the service worker (H2) in production builds only: `npm start` has no SW, so the dev console
 * stays clean and dev never serves stale precached files. `autoUpdate`: a new version activates at once and
 * reloads open tabs (pending deposits are never persisted, so the wallet stays consistent).
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}
