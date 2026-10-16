import { describe, expect, it } from 'vitest';
import { THUMB_VIEWBOX, thumbnailSpec } from './thumbnail';

describe('thumbnailSpec', () => {
  it('is deterministic for the same id and hue', () => {
    expect(thumbnailSpec('pixel-oak-book-of-dawn', 120)).toEqual(thumbnailSpec('pixel-oak-book-of-dawn', 120));
  });

  it('differs between ids with the same hue', () => {
    expect(thumbnailSpec('game-a', 120)).not.toEqual(thumbnailSpec('game-b', 120));
  });

  it('uses the game hue as the base color', () => {
    expect(thumbnailSpec('game-a', 120).hueA).toBe(120);
  });

  it('keeps hues as integers in 0–359, even for out-of-range input', () => {
    for (const hue of [0, 359, -10, 725, 12.7]) {
      const { hueA, hueB } = thumbnailSpec('game-a', hue);
      for (const h of [hueA, hueB]) {
        expect(Number.isInteger(h)).toBe(true);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(359);
      }
    }
  });

  it('places every shape inside the viewBox with a positive size and opacity', () => {
    for (const id of ['a', 'b', 'c', 'long-id-with-many-parts']) {
      const { shapes } = thumbnailSpec(id, 200);
      expect(shapes.length).toBeGreaterThanOrEqual(3);
      for (const s of shapes) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(THUMB_VIEWBOX.width);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(THUMB_VIEWBOX.height);
        expect(s.size).toBeGreaterThan(0);
        expect(s.opacity).toBeGreaterThan(0);
        expect(s.opacity).toBeLessThan(1);
      }
    }
  });
});
