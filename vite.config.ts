import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    // tokens.css is read with ?raw by the contrast test; other CSS stays stubbed.
    css: { include: [/tokens\.css/], modules: { classNameStrategy: 'non-scoped' } },
  },
});
