/// <reference types="node" />
// Node APIs: Vitest stubs `?raw` CSS imports (only tokens.css is processed, see vite.config.ts).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');
const files = (ext: RegExp) =>
  readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((name) => ext.test(name) && !name.endsWith('cssPolish.test.ts'))
    .map((name) => ({ name, text: readFileSync(join(SRC, name), 'utf8') }));
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const CSS = files(/\.css$/).map(({ name, text }) => ({ name, text: stripComments(text) }));

// Animating these re-runs layout every frame; animate transform/opacity/colors/shadows instead.
const LAYOUT = /^(all|(min-|max-)?(width|height|inline-size|block-size)|(margin|padding|inset|border)(-.+)?|top|right|bottom|left|font-size|line-height|gap|row-gap|column-gap|grid(-.+)?|flex(-.+)?|letter-spacing)$/;
const TIMING = /^(-?[\d.]+m?s|ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|(cubic-bezier|steps|linear)\(.*\)|normal|allow-discrete|infinite)$/;

/** Property names a `transition` or `transition-property` value animates; no name means `all`. */
function transitioned(prop: string, value: string): string[] {
  return value.split(/,(?![^(]*\))/).map((item) => {
    const tokens = item.trim().split(/\s+(?![^(]*\))/);
    if (prop === 'transition-property') return tokens[0] ?? 'all';
    return tokens.find((t) => !TIMING.test(t)) ?? 'all';
  });
}

describe('CSS polish', () => {
  it('finds the stylesheets', () => {
    expect(CSS.length).toBeGreaterThan(10);
  });

  it('no transition on layout properties (or `all`)', () => {
    const offending = CSS.flatMap(({ name, text }) =>
      [...text.matchAll(/(transition(?:-property)?)\s*:\s*([^;}]+)/g)].flatMap(([, prop = '', value = '']) =>
        transitioned(prop, value)
          .filter((p) => LAYOUT.test(p))
          .map((p) => `${name}: ${p}`),
      ),
    );
    expect(offending).toEqual([]);
  });

  it('the reduced-motion rule in global.css covers every animation and transition', () => {
    const global = CSS.find((f) => f.name.endsWith('global.css'))?.text ?? '';
    const block = /@media \(prefers-reduced-motion: reduce\)\s*{([\s\S]*?)\n}/.exec(global)?.[1] ?? '';
    expect(block).toMatch(/\*,\s*\*::before,\s*\*::after/);
    for (const decl of ['animation-duration', 'animation-iteration-count', 'transition-duration', 'scroll-behavior']) {
      expect(block, decl).toContain(decl);
    }
  });

  it('every infinite animation also stops under reduced motion in its own file', () => {
    const missing = CSS.filter(({ text }) => /animation[^;]*infinite/.test(text) && !/prefers-reduced-motion: reduce/.test(text));
    expect(missing.map((f) => f.name)).toEqual([]);
  });

  it('no spinners: no spin/rotate keyframes, no spinner classes or components', () => {
    const keyframes = CSS.flatMap(({ name, text }) =>
      [...text.matchAll(/@keyframes\s+([\w-]+)/g)].filter(([, k = '']) => /spin|rotat|load/i.test(k)).map(([, k]) => `${name}: ${k}`),
    );
    const named = files(/\.(css|tsx?)$/)
      .filter(({ text }) => /spinner/i.test(text))
      .map((f) => f.name);
    expect([...keyframes, ...named]).toEqual([]);
  });
});
