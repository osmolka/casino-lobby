import css from './tokens.css?raw';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../shared/contrast';


function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)].map((m): [string, string] => [m[1] ?? '', m[2] ?? '']));
}

const TEXT = 4.5;
const UI = 3;
const PAIRS: [fg: string, bg: string, min: number][] = [
  ['fg', 'bg', TEXT],
  ['fg', 'surface', TEXT],
  ['fg-muted', 'bg', TEXT],
  ['fg-muted', 'surface', TEXT],
  ['accent', 'bg', TEXT],
  ['accent', 'surface', TEXT],
  ['accent-fg', 'accent', TEXT],
  ['danger', 'bg', TEXT],
  ['danger', 'surface', TEXT],
  ['success', 'bg', TEXT],
  ['success', 'surface', TEXT],
  ['focus', 'bg', UI],
  ['focus', 'surface', UI],
  ['border', 'bg', UI],
  ['border', 'surface', UI],
];

describe.each(["[data-theme='light']", "[data-theme='dark']"])('tokens %s', (selector) => {
  const t = tokens(selector);

  it.each(PAIRS)('%s on %s ≥ %s:1', (fg, bg, min) => {
    const a = t[fg];
    const b = t[bg];
    expect(a, fg).toBeDefined();
    expect(b, bg).toBeDefined();
    expect(contrastRatio(a ?? '', b ?? '')).toBeGreaterThanOrEqual(min);
  });
});
