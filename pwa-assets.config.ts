import { defineConfig, type Preset } from '@vite-pwa/assets-generator/config';

// One-off: `npx pwa-assets-generator` writes the PNGs next to the source SVG; the output is committed.
// No favicon.ico: index.html links the SVG favicon.
const preset: Preset = {
  transparent: { sizes: [192, 512], favicons: [] },
  // Full-bleed brand color behind the star, inside the maskable safe zone.
  maskable: { sizes: [512], padding: 0.3, resizeOptions: { background: '#6b2fd6' } },
  apple: { sizes: [180], padding: 0.3, resizeOptions: { background: '#6b2fd6' } },
};

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset,
  images: ['public/icons/icon.svg'],
});
