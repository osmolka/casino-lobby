import { defineConfig, devices } from '@playwright/test';

// Default: build + preview (production bundle). E2E_BASE_URL=http://localhost:5173 runs against a running dev server.
const external = process.env.E2E_BASE_URL;
const PREVIEW_PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  use: {
    baseURL: external ?? `http://localhost:${PREVIEW_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(external
    ? {}
    : {
        webServer: {
          command: `npm run build && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
          url: `http://localhost:${PREVIEW_PORT}`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
